// services/newJobNotifier.js
const User = require('../models/User');
const { matchJobsForUser } = require('../utils/jobMatch');

/**
 * jobs: array of job objects (title, company, url, description)
 * bot: node-telegram-bot-api instance
 */
async function notifyUsersForNewJobs(bot, jobs) {
  if (!bot || !jobs?.length) return;

  const users = await User.find();
  if (!users.length) return;

  for (const user of users) {
    // skills ke hisaab se match
    const matched = matchJobsForUser(user, jobs);
    if (!matched.length) continue;

    const seen = user.seenJobs || [];

    // sirf new jobs
    const newJobs = matched.filter((j) => !seen.includes(j.url));
    if (!newJobs.length) continue;

    let msg = '🔥 New Job Update\n\n';

    newJobs.slice(0, 5).forEach((job) => {
      msg += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
    });

    try {
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
    } catch (err) {
      console.log(`Error sending to ${user.chatId}`, err.message);
    }
  }
}

module.exports = { notifyUsersForNewJobs };