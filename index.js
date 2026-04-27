// index.js
require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const connectDB = require('./config/db');
const User = require('./models/User');
const { fetchJobs } = require('./services/JobServices');
const { notifyUsersForNewJobs } = require('./services/newJobNotifier');
const setupCommands = require('./bot/commands');

// ---------------- ENV VALIDATION ----------------
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

// ---------------- DB CONNECT ----------------
connectDB();

// ---------------- EXPRESS APP ----------------
const app = express();
app.use(express.json());

// ---------------- TELEGRAM BOT (WEBHOOK) ----------------
// NOTE: NO polling, only webhook
const bot = new TelegramBot(process.env.BOT_TOKEN);

// webhook URL (Render external URL + /bot<TOKEN>)
const webhookPath = `/bot${process.env.BOT_TOKEN}`;
const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}${webhookPath}`;

// Set webhook
bot
  .setWebHook(webhookUrl)
  .then(() => {
    console.log('Webhook set to:', webhookUrl);
  })
  .catch((err) => {
    console.error('Error setting webhook', err.message);
  });

// Express route to receive updates from Telegram
app.post(webhookPath, (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error processing update', err);
    res.sendStatus(500);
  }
});

// ---------------- COMMANDS + HANDLERS ----------------
setupCommands(bot);

// ---------------- DAILY ALERT (NEW JOBS ONLY) ----------------
cron.schedule(
  '0 9 * * *', // every day 9:00 AM
  async () => {
    try {
      console.log('Running daily jobs cron...');

      const jobs = await fetchJobs();
      if (!jobs?.length) {
        console.log('No jobs fetched from APIs');
        return;
      }

      // Yeh helper har user ke liye sirf NEW + MATCHED jobs bhejta hai
      await notifyUsersForNewJobs(bot, jobs);
    } catch (err) {
      console.log('Cron error', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  }
);

// ---------------- OPTIONAL: MANUAL REFRESH ROUTE ----------------
// Agar tum browser se /refresh-jobs hit karke manually trigger karna chaho
app.get('/refresh-jobs', async (req, res) => {
  try {
    const jobs = await fetchJobs();
    if (!jobs?.length) {
      return res.status(200).send('No jobs fetched');
    }

    await notifyUsersForNewJobs(bot, jobs);
    res.status(200).send('Jobs fetched & users notified');
  } catch (err) {
    console.error('Error in /refresh-jobs', err);
    res.status(500).send('Error refreshing jobs');
  }
});

// ---------------- HEALTH / ROOT ----------------
app.get('/', (req, res) => {
  res.send('Job Bot Running');
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { bot };