// utils/jobMatch.js

function matchJobsForUser(user, jobs) {
  const skills = user.skills || [];

  const uniqueJobs = Array.from(
    new Map(jobs.map((j) => [j.url, j])).values()
  );

  let matched;

  if (!skills.length) {
    // skills nahi hain → generic jobs
    matched = uniqueJobs;
  } else {
    matched = uniqueJobs.filter((job) => {
      const combined = (
        (job.title || '') +
        ' ' +
        (job.description || '')
      ).toLowerCase();

      return (
        skills.some((s) => combined.includes(s)) ||
        combined.includes('developer') ||
        combined.includes('engineer')
      );
    });
  }

  return matched;
}

module.exports = { matchJobsForUser };