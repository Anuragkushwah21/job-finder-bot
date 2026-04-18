require('dotenv').config();

const express = require('express');
const app = express();

const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/db');
const User = require('./models/User');
const { fetchJobs } = require('./services/JobServices');

const pdf = require('pdf-parse');
const axios = require('axios');
const cron = require('node-cron');


// ---------------- ENV CHECK ----------------

if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN missing in environment variables");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI missing");
  process.exit(1);
}


// ---------------- DB ----------------

connectDB();


// ---------------- TELEGRAM BOT ----------------

// only ONE polling instance
const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
     polling: {
      autoStart: true,
      interval: 3000
   }
  }
);
bot.deleteWebHook();
bot.on("polling_error", (err) => {
 console.log("Polling Error:", err.message);
});


// ---------------- START ----------------

bot.onText(/\/start/, async (msg) => {

 try {

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

      user.step="ask_experience";
      await user.save();

   }

   bot.sendMessage(
      chatId,
      "Type: fresher OR experienced"
   );

 } catch(err){
   console.log(err);
 }

});


// ---------------- MESSAGE ----------------

bot.on('message', async (msg)=>{

try{

 if(!msg.text) return;

 const chatId = msg.chat.id;
 const text=msg.text.toLowerCase();

 if(text==="/start") return;

 const user=await User.findOne({chatId});

 if(!user) return;


 // experience

 if(user.step==="ask_experience"){

   if(
      text==="fresher" ||
      text==="experienced"
   ){

     user.experience=text;
     user.step="ask_resume";

     await user.save();

     return bot.sendMessage(
       chatId,
       "Upload your resume PDF"
     );
   }

 }


 // /more

 if(text==="/more"){

    if(!user.lastJobs?.length){
      return bot.sendMessage(
       chatId,
       "No jobs available yet."
      );
    }

    const start=user.currentJobIndex||0;

    const end=start+10;

    const nextJobs=
       user.lastJobs.slice(start,end);

    if(!nextJobs.length){
      return bot.sendMessage(
       chatId,
       "No more jobs found."
      );
    }

    user.currentJobIndex=end;

    await user.save();

    let message="More Jobs:\n\n";

    nextJobs.forEach(job=>{

      message +=
`Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;

    });

    return bot.sendMessage(chatId,message);

 }

}catch(err){

 console.log(err);

}

});



// ---------------- DOCUMENT ----------------

bot.on("document", async(msg)=>{

try{

 const chatId=msg.chat.id;

 const user=
   await User.findOne({chatId});

 if(!user) return;


 if(
   msg.document.mime_type!=="application/pdf"
 ){

   return bot.sendMessage(
    chatId,
    "Only PDF allowed"
   );

 }


 bot.sendMessage(
   chatId,
   "Processing Resume..."
 );


 const fileLink=
   await bot.getFileLink(
      msg.document.file_id
   );


 const fileRes=
    await axios.get(
      fileLink,
      {
        responseType:"arraybuffer"
      }
    );


 const data=
    await pdf(fileRes.data);

 const resumeText=
    (data.text || "").toLowerCase();


 const skillsList=[
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


 const foundSkills=
   skillsList.filter(
     skill=>resumeText.includes(skill)
   );


 user.skills=foundSkills;

 user.step="ready";

 await user.save();



 const jobs=await fetchJobs();

 if(!jobs?.length){

   return bot.sendMessage(
    chatId,
    "No jobs found"
   );

 }


 const uniqueJobs=
   Array.from(
    new Map(
      jobs.map(
       j=>[j.url,j]
      )
    ).values()
   );


 let matched=
   uniqueJobs.filter(job=>{

     const combined=
      (
        (job.title||"")+
        " "+
        (job.description||"")
      ).toLowerCase();


     return(

      foundSkills.some(
       s=>combined.includes(s)
      )

      ||

      combined.includes("developer")
      ||
      combined.includes("engineer")

     )

   });


 if(!matched.length){
   matched=uniqueJobs;
 }


 user.lastJobs=matched;

 user.currentJobIndex=10;

 await user.save();


 let message=
   "Jobs For You:\n\n";


 matched
  .slice(0,10)
  .forEach(job=>{

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

}catch(err){

 console.log("Resume Error:",err);

 bot.sendMessage(
   msg.chat.id,
   "Resume processing failed"
 );

}

});




// ---------------- CRON ----------------

cron.schedule(
 '0 9 * * *',
 async()=>{

  try{

   const users=
     await User.find();

   for(let user of users){

    const jobs=
      await fetchJobs();

    if(!jobs?.length)
      continue;

    let msg=
     "Today's Jobs\n\n";

    jobs
     .slice(0,5)
     .forEach(job=>{

      msg+=
`Title:${job.title}
Apply:${job.url}

`;

     });

    bot.sendMessage(
      user.chatId,
      msg
    );

   }

  }catch(err){

   console.log(
    "Cron Error:",
     err
   );

  }

 },
 {
   timezone:"Asia/Kolkata"
 }
);



// ---------------- EXPRESS (Render Fix) ----------------

app.get("/",(req,res)=>{
 res.send(
  "Job Finder Bot Running"
 );
});

const PORT=
 process.env.PORT || 4000;

app.listen(PORT,()=>{

 console.log(
   `Server running on ${PORT}`
 );

});