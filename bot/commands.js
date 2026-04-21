const { fetchJobs } = require('../services/JobServices');

bot.onText(/\/jobs/, async (msg) => {
  const jobs = await fetchJobs();

  if (!jobs || jobs.length === 0) {
    return bot.sendMessage(msg.chat.id, "No jobs found 😕");
  }

  let message = "🔥 Jobs:\n\n";

  jobs.slice(0, 5).forEach(job => {
    message += `Title: ${job.title}\nCompany: ${job.company}\nApply: ${job.url}\n\n`;
  });

  bot.sendMessage(msg.chat.id, message);
});