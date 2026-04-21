// utils/jobMatch.js

// user.skills ke hisaab se jobs filter karne ka helper
function matchJobsForUser(user, jobs) {
  const skills = user.skills || [];

  const uniqueJobs = Array.from(
    new Map(jobs.map((j) => [j.url, j])).values()
  );

  let matched = uniqueJobs.filter((job) => {
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

  // agar skills se kuch nahi mila, sabhi uniqueJobs de do
  if (!matched.length) {
    matched = uniqueJobs;
  }

  return matched;
}

module.exports = { matchJobsForUser };