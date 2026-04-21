// index.js
require('dotenv').config();

const express = require('express');
const app = express();
app.use(express.json());

const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/db');
const User = require('./models/User');
const { fetchJobs } = require('./services/JobServices');
const { matchJobsForUser } = require('./utils/jobMatch');
const cron = require('node-cron');

const setupCommands = require('./bot/commands');

// ---------------- ENV ----------------
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

if (!process.env.RENDER_EXTERNAL_URL) {
  console.error('RENDER_EXTERNAL_URL missing');
  process.exit(1);
}

// ---------------- DB ----------------
connectDB();

// ---------------- BOT (WEBHOOK ONLY) ----------------
// NO POLLING
const bot = new TelegramBot(process.env.BOT_TOKEN);

// ---------------- WEBHOOK ----------------
const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.BOT_TOKEN}`;

app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot
  .setWebHook(webhookUrl)
  .then(() => {
    console.log('Webhook set');
  })
  .catch(console.log);

// ---------------- COMMANDS + HANDLERS ----------------
setupCommands(bot);

// ---------------- DAILY ALERT (NEW JOBS ONLY) ----------------
cron.schedule(
  '0 9 * * *',
  async () => {
    try {
      console.log('Running daily jobs');

      const users = await User.find();

      for (const user of users) {
        const jobs = await fetchJobs();
        if (!jobs?.length) continue;

        // skills + title/description matching (helper se)
        const matched = matchJobsForUser(user, jobs);

        const seen = user.seenJobs || [];

        // sirf new jobs jo pehle seenJobs me nahi hain
        const newJobs = matched.filter((j) => !seen.includes(j.url));
        if (!newJobs.length) continue;

        let msg = '🔥 New Jobs Update (Daily)\n\n';

        newJobs.slice(0, 5).forEach((job) => {
          msg += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
        });

        await bot.sendMessage(user.chatId, msg);

        await User.updateOne(
          { chatId: user.chatId },
          {
            $addToSet: {
              seenJobs: {
                $each: newJobs.map((j) => j.url),
              },
            },
          }
        );
      }
    } catch (err) {
      console.log('Cron error', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  }
);

// ---------------- EXPRESS ----------------
app.get('/', (req, res) => {
  res.send('Bot Running');
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server ${PORT}`);
});