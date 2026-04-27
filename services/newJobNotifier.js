// services/newJobNotifier.js
const User = require('../models/User');
const { matchJobsForUser } = require('../utils/jobMatch');

async function notifyUsersForNewJobs(bot, jobs) {
  if (!bot || !jobs?.length) return;

  const users = await User.find();
  if (!users.length) return;

  for (const user of users) {
    const matched = matchJobsForUser(user, jobs);
    if (!matched.length) continue;

    const seen = user.seenJobs || [];

    const newJobs = matched.filter((j) => !seen.includes(j.url));
    if (!newJobs.length) continue;

    // yahan store karte hain taaki /more se yahi list lagi rahe
    // append or overwrite: yahan hum overwrite kar rahe daily batch se
    await User.updateOne(
      { chatId: user.chatId },
      {
        $set: {
          lastJobs: newJobs,
          currentJobIndex: 10, // subah ke message me pehle 10 bhejne ke baad index 10 pe
        },
        $addToSet: {
          seenJobs: {
            $each: newJobs.map((j) => j.url),
          },
        },
      }
    );

    let msg = '🔥 New Jobs Update (Daily)\n\n';

    newJobs.slice(0, 10).forEach((job) => {
      msg += `Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
    });

    msg += '\nUse /more for more jobs';

    try {
      await bot.sendMessage(user.chatId, msg);
    } catch (err) {
      console.log(`Error sending to ${user.chatId}`, err.message);
    }
  }
}

module.exports = { notifyUsersForNewJobs };