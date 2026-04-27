// bot/commands.js
const User = require('../models/User');
const { fetchJobs } = require('../services/JobServices');
const { matchJobsForUser } = require('../utils/jobMatch');
const pdf = require('pdf-parse');
const axios = require('axios');

const helpText = `
🤖 Commands

/start - Start
/help - Commands
/more - More jobs

Flow:
1 Type fresher or experienced
2 Upload PDF Resume
3 Get jobs
`;

function setupCommands(bot) {
  // ---------------- COMMANDS LIST ----------------
  bot.setMyCommands([
    { command: '/start', description: 'Start bot' },
    { command: '/help', description: 'Show commands' },
    { command: '/more', description: 'More jobs' },
  ]);

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
          step: 'ask_experience',
        });
      } else {
        await User.updateOne(
          { chatId },
          {
            $set: {
              step: 'ask_experience',
            },
          }
        );
      }

      await bot.sendMessage(
        chatId,
        'Welcome 🚀\n\nType fresher OR experienced\n\n' + helpText
      );
    } catch (err) {
      console.log('Error in /start', err);
    }
  });

  // ---------------- HELP ----------------
  bot.onText(/\/help/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id, helpText);
    } catch (err) {
      console.log('Error in /help', err);
    }
  });

  // ---------------- MORE ----------------
  bot.onText(/\/more/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const user = await User.findOne({ chatId });
      if (!user) return;

      if (!user.lastJobs?.length) {
        return bot.sendMessage(chatId, 'No jobs yet');
      }

      const start = user.currentJobIndex || 0;
      const end = start + 10;

      const nextJobs = user.lastJobs.slice(start, end);

      if (!nextJobs.length) {
        return bot.sendMessage(chatId, 'No more jobs');
      }

      await User.updateOne(
        { chatId },
        {
          $set: {
            currentJobIndex: end,
          },
        }
      );

      let message = '🔥 More Jobs\n\n';

      nextJobs.forEach((job) => {
        message += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
      });

      return bot.sendMessage(chatId, message);
    } catch (err) {
      console.log('Error in /more', err);
    }
  });

  // ---------------- MESSAGE (experience only) ----------------
  bot.on('message', async (msg) => {
    try {
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const text = msg.text.toLowerCase();

      if (text.startsWith('/')) return; // commands already handled

      const user = await User.findOne({ chatId });
      if (!user) return;

      // experience
      if (user.step === 'ask_experience') {
        if (text === 'fresher' || text === 'experienced') {
          await User.updateOne(
            { chatId },
            {
              $set: {
                experience: text,
                step: 'ask_resume',
              },
            }
          );

          return bot.sendMessage(chatId, 'Upload resume PDF');
        } else {
          return bot.sendMessage(
            chatId,
            'Please type fresher OR experienced'
          );
        }
      }
    } catch (err) {
      console.log('Error in message handler', err);
    }
  });

  // ---------------- RESUME ----------------
  bot.on('document', async (msg) => {
    try {
      const chatId = msg.chat.id;

      const user = await User.findOne({ chatId });
      if (!user) return;

      if (msg.document.mime_type !== 'application/pdf') {
        return bot.sendMessage(chatId, 'Only PDF allowed');
      }

      await bot.sendMessage(chatId, 'Processing Resume...');

      const fileLink = await bot.getFileLink(msg.document.file_id);

      const fileRes = await axios.get(fileLink, {
        responseType: 'arraybuffer',
      });

      const data = await pdf(fileRes.data);

      const resumeText = (data.text || '').toLowerCase();

      const skillsList = [
        'react',
        'node',
        'mongodb',
        'javascript',
        'html',
        'css',
        'angular',
        'typescript',
        'express',
        'sql',
        'nextjs',
      ];

      const foundSkills = skillsList.filter((s) =>
        resumeText.includes(s)
      );

      await User.updateOne(
        { chatId },
        {
          $set: {
            skills: foundSkills,
            step: 'ready',
          },
        }
      );

      const jobs = await fetchJobs();

      if (!jobs?.length) {
        return bot.sendMessage(chatId, 'No jobs found');
      }

      // Reuse jobMatch helper instead of duplicate logic
      const matched = matchJobsForUser(
        { skills: foundSkills },
        jobs
      );

      const finalMatched = matched.length ? matched : jobs;

      await User.updateOne(
        { chatId },
        {
          $set: {
            lastJobs: finalMatched,
            currentJobIndex: 10,
          },
          $addToSet: {
            seenJobs: {
              $each: finalMatched.map((j) => j.url),
            },
          },
        }
      );

      let message = '🔥 Jobs For You\n\n';

      finalMatched.slice(0, 10).forEach((job) => {
        message += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
      });

      message += '\nUse /more for more jobs';

      await bot.sendMessage(chatId, message);
    } catch (err) {
      console.log('Error in resume handler', err);
      bot.sendMessage(msg.chat.id, 'Resume failed');
    }
  });
}

module.exports = setupCommands;