// utils/jobMatch.js
function matchJobsForUser(user, jobs) {
  if (!user || !Array.isArray(jobs)) return [];

  const skills = (user.skills || []).map((s) => s.toLowerCase().trim());

  const uniqueJobs = Array.from(
    new Map(jobs.map((j) => [j.url, j])).values()
  );

  let matched;

  if (!skills.length) {
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