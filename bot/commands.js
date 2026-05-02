// bot/commands.js
const User = require('../models/User');
const { fetchJobsForUser } = require('../services/JobServices');
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

// --------- Detect level & domain from resume text ---------
const levelKeywords = {
  fresher: ['fresher', 'recent graduate', 'entry level', '0-1 year', '0-6 months', '0-1 years'],
  junior: ['junior', 'associate'],
  senior: ['senior', 'lead', 'principal'],
  manager: ['manager', 'head of', 'director'],
};

const domainKeywords = {
  it: ['developer', 'engineer', 'programmer', 'software', 'frontend', 'backend', 'full stack', 'web development'],
  marketing: ['marketing', 'seo', 'content writer', 'social media', 'digital marketing'],
  sales: ['sales', 'business development', 'bdm', 'account executive'],
  finance: ['accountant', 'accounts', 'finance', 'ca', 'cfa'],
  hr: ['hr', 'human resources', 'recruiter', 'talent acquisition'],
  design: ['designer', 'ui ux', 'graphic designer', 'product designer'],
  operations: ['operations', 'ops', 'supply chain', 'logistics'],
};

function detectLevel(text) {
  const t = text.toLowerCase();
  for (const [level, words] of Object.entries(levelKeywords)) {
    if (words.some((w) => t.includes(w))) return level;
  }
  return null;
}

function detectDomain(text) {
  const t = text.toLowerCase();
  for (const [domain, words] of Object.entries(domainKeywords)) {
    if (words.some((w) => t.includes(w))) return domain;
  }
  return null;
}

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

  // ---------------- MORE (NEW LOGIC) ----------------
  bot.onText(/\/more/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const user = await User.findOne({ chatId });
      if (!user) return;

      // 1) Pehle stored lastJobs se try karo
      let start = user.currentJobIndex || 0;
      let end = start + 10;

      let nextJobs = (user.lastJobs || []).slice(start, end);

      if (nextJobs.length) {
        await User.updateOne(
          { chatId },
          { $set: { currentJobIndex: end } }
        );

        let message = '🔥 More Jobs\n\n';
        nextJobs.forEach((job) => {
          message += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
        });

        return bot.sendMessage(chatId, message);
      }

      // 2) Agar stored jobs khatam ho gayi, to AB fresh fetch karo (user-specific)
      const jobs = await fetchJobsForUser(user);
      if (!jobs?.length) {
        return bot.sendMessage(chatId, 'No more jobs');
      }

      const matched = matchJobsForUser(user, jobs);
      const finalMatched = matched.length ? matched : jobs;

      const seen = user.seenJobs || [];
      const trulyNew = finalMatched.filter(
        (j) => !seen.includes(j.url)
      );

      if (!trulyNew.length) {
        return bot.sendMessage(chatId, 'No more jobs');
      }

      await User.updateOne(
        { chatId },
        {
          $set: {
            lastJobs: trulyNew,
            currentJobIndex: 10,
          },
          $addToSet: {
            seenJobs: {
              $each: trulyNew.map((j) => j.url),
            },
          },
        }
      );

      let message = '🔥 More New Jobs\n\n';
      trulyNew.slice(0, 10).forEach((job) => {
        message += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
      });

      message += '\nUse /more for more jobs';

      return bot.sendMessage(chatId, message);
    } catch (err) {
      console.log('Error in /more', err);
      return bot.sendMessage(
        msg.chat.id,
        'Something went wrong with /more'
      );
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

      // Level + domain detect karo
      const detectedLevel = detectLevel(resumeText);   // fresher/junior/senior/manager/null
      const detectedDomain = detectDomain(resumeText); // it/marketing/sales/.../null

      await User.updateOne(
        { chatId },
        {
          $set: {
            skills: foundSkills,
            step: 'ready',
            level: detectedLevel || user.experience || null,
            domain: detectedDomain || user.domain || null,
          },
        }
      );

      // Latest user (updated) le lo
      const updatedUser = await User.findOne({ chatId });

      // User-specific jobs fetch
      const jobs = await fetchJobsForUser(updatedUser);
      if (!jobs?.length) {
        return bot.sendMessage(chatId, 'No jobs found');
      }

      // 1) Skill + domain based matching
      const matched = matchJobsForUser(updatedUser, jobs);
      const finalMatched = matched.length ? matched : jobs;

      // 2) Purane seenJobs ke against filter
      const seen = updatedUser.seenJobs || [];
      const trulyNew = finalMatched.filter(
        (j) => !seen.includes(j.url)
      );

      if (!trulyNew.length) {
        return bot.sendMessage(
          chatId,
          'No new jobs based on your resume'
        );
      }

      // 3) DB update: lastJobs = ye new list, currentJobIndex = 10
      await User.updateOne(
        { chatId },
        {
          $set: {
            lastJobs: trulyNew,
            currentJobIndex: 10,
          },
          $addToSet: {
            seenJobs: {
              $each: trulyNew.map((j) => j.url),
            },
          },
        }
      );

      let message = '🔥 Jobs For You\n\n';

      trulyNew.slice(0, 10).forEach((job) => {
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