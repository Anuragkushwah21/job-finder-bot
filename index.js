require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/db');
const User = require('./models/User');
const { fetchJobs } = require('./services/JobServices');

const pdf = require('pdf-parse');
const axios = require('axios');
const cron = require('node-cron');

connectDB();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });


// ================= START =================

bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  let user = await User.findOne({ chatId });

  if (!user) {

    user = await User.create({
      chatId,
      seenJobs: [],
      lastJobs: [],
      currentJobIndex: 0,
      step: "ask_experience"
    });

  } else {

    user.step = "ask_experience";

  }

  await user.save();

  bot.sendMessage(
    chatId,
    "Type: fresher OR experienced"
  );

});


// ================= EXPERIENCE =================

bot.on('message', async (msg) => {

  if (!msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.toLowerCase();

  const user = await User.findOne({ chatId });

  if (!user) return;


  // EXPERIENCE FLOW

  if (user.step === "ask_experience") {

    if (
      text === "fresher" ||
      text === "experienced"
    ) {

      user.experience = text;

      user.step = "ask_resume";

      await user.save();

      return bot.sendMessage(
        chatId,
        "Upload your resume (PDF)"
      );
    }
  }



  // ================= /MORE =================

  if (text === "/more") {

    if (!user.lastJobs?.length) {

      return bot.sendMessage(
        chatId,
        "No jobs yet. Upload resume first."
      );

    }

    const start =
      user.currentJobIndex || 0;

    const end = start + 10;

    const nextJobs =
      user.lastJobs.slice(start, end);

    if (!nextJobs.length) {

      return bot.sendMessage(
        chatId,
        "No more jobs available."
      );

    }

    user.currentJobIndex = end;

    await user.save();

    let message =
      "🔥 More Jobs:\n\n";

    nextJobs.forEach(job => {

      message +=
        `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;

    });

    return bot.sendMessage(
      chatId,
      message
    );

  }

});




// ================= RESUME =================

bot.on('document', async (msg) => {

  const chatId = msg.chat.id;

  const user =
    await User.findOne({ chatId });

  if (!user) return;


  if (
    msg.document.mime_type !==
    "application/pdf"
  ) {

    return bot.sendMessage(
      chatId,
      "Only PDF allowed ❌"
    );

  }



  try {

    bot.sendMessage(
      chatId,
      "Processing resume... ⏳"
    );


    const fileLink =
      await bot.getFileLink(
        msg.document.file_id
      );

    const fileRes =
      await axios.get(
        fileLink,
        { responseType: 'arraybuffer' }
      );


    const data =
      await pdf(fileRes.data);

    const text =
      (data.text || "")
        .toLowerCase();



    const skillsList = [
      "react",
      "node",
      "mongodb",
      "javascript",
      "html",
      "css",
      "angular",
      "typescript",
      "express",
      "sql",
      "nextjs"
    ];


    const foundSkills =
      skillsList.filter(skill =>
        text.includes(skill)
      );


    user.skills = foundSkills;

    user.step = "ready";

    await user.save();



    bot.sendMessage(
      chatId,
      `Skills: ${foundSkills.length
        ? foundSkills.join(", ")
        : "General profile"
      }`
    );



    // ================= FETCH JOBS =================

    const jobs =
      await fetchJobs();

    if (!jobs?.length) {

      return bot.sendMessage(
        chatId,
        "No jobs available"
      );

    }



    const uniqueJobs =
      Array.from(
        new Map(
          jobs.map(
            j => [j.url, j]
          )
        ).values()
      );



    // ================= SOFT MATCH =================

    let matched =
      uniqueJobs.filter(job => {

        const title =
          (job.title || "")
            .toLowerCase();

        const desc =
          (job.description || "")
            .toLowerCase();

        return (

          foundSkills.some(skill =>
            title.includes(skill) ||
            desc.includes(skill)
          )

          ||

          title.includes("developer")
          ||
          title.includes("engineer")
          ||
          title.includes("software")
          ||
          title.includes("web")

        );

      });



    // ================= FRESHER FIXED =================

    if (
      user.experience === "fresher"
    ) {

      const fresherKeywords = [
        "intern",
        "internship",
        "junior",
        "entry",
        "entry level",
        "trainee",
        "associate"
      ];


      const blockedKeywords = [
        "senior",
        "lead",
        "staff",
        "principal",
        "manager",
        "architect",
        "3+ years",
        "5+ years"
      ];


      let fresherPool =
        uniqueJobs.filter(job => {

          const combined =
            (
              (job.title || "")
              +
              " "
              +
              (job.description || "")
            )
              .toLowerCase();

          return (

            fresherKeywords.some(
              k =>
                combined.includes(k)
            )

            &&

            !blockedKeywords.some(
              k =>
                combined.includes(k)
            )

          );

        });



      let skillMatchedFreshers =
        fresherPool.filter(job => {

          const combined =
            (
              (job.title || "")
              +
              " "
              +
              (job.description || "")
            )
              .toLowerCase();

          return foundSkills.some(
            skill =>
              combined.includes(skill)
          );

        });



      if (
        skillMatchedFreshers.length
      ) {

        matched =
          skillMatchedFreshers;

      }

      else if (
        fresherPool.length
      ) {

        matched =
          fresherPool;

      }

    }




    // ================= FALLBACK EXPERIENCED ONLY =================

    if (

      user.experience !== "fresher"

      &&

      matched.length < 15

    ) {

      const extra =
        uniqueJobs.filter(
          j =>
            !matched.some(
              m =>
                m.url === j.url
            )
        );


      matched = [
        ...matched,
        ...extra
      ];

    }




    // ================= SHUFFLE =================

    const shuffled =
      matched.sort(
        () =>
          Math.random() - 0.5
      );



    user.lastJobs = shuffled;

    user.currentJobIndex = 5;


    user.seenJobs = [

      ...new Set([

        ...(user.seenJobs || []),

        ...shuffled.map(
          j => j.url
        )

      ])

    ];


    await user.save();




    // ================= FIRST 10 =================

    const firstJobs =
      shuffled.slice(0, 10);


    let message =
      "🔥 Jobs for you:\n\n";


    firstJobs.forEach(job => {

      message +=
        `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;

    });


    bot.sendMessage(
      chatId,
      message
    );


  }

  catch (err) {

    console.log(
      "ERROR:",
      err
    );

    bot.sendMessage(
      chatId,
      "Error processing resume ❌"
    );

  }

});




// ================= DAILY JOBS =================

cron.schedule(
  '0 9 * * *',

  async () => {

    const users =
      await User.find();


    for (
      let user of users
    ) {

      if (!user.seenJobs)
        user.seenJobs = [];


      const jobs =
        await fetchJobs();

      if (!jobs?.length)
        continue;


      const uniqueJobs =
        Array.from(
          new Map(
            jobs.map(
              j => [j.url, j]
            )
          ).values()
        );


      const newJobs =
        uniqueJobs.filter(
          job =>
            !user.seenJobs.includes(
              job.url
            )
        );


      if (!newJobs.length)
        continue;


      const shuffled =
        newJobs.sort(
          () => Math.random() - 0.5
        );


      let msgText =
        "🔥 Today's Jobs:\n\n";


      shuffled
        .slice(0, 10)
        .forEach(job => {

          msgText +=
            `Title: ${job.title}
Apply: ${job.url}

`;

        });


      bot.sendMessage(
        user.chatId,
        msgText
      );


      user.seenJobs = [

        ...new Set([

          ...(user.seenJobs || []),

          ...newJobs.map(
            j => j.url
          )

        ])

      ];


      await user.save();

    }

  },

  {
    timezone: "Asia/Kolkata"
  }

);