// utils/jobMatch.js

function matchJobsForUser(user, jobs) {
  if (!user || !Array.isArray(jobs)) return [];

  const skills = (user.skills || []).map((s) => s.toLowerCase().trim());
  const domain = (user.domain || '').toLowerCase();

  const uniqueJobs = Array.from(
    new Map(jobs.map((j) => [j.url, j])).values()
  );

  return uniqueJobs.filter((job) => {
    const combined = (
      (job.title || '') +
      ' ' +
      (job.description || '')
    ).toLowerCase();

    // 1) Skills match (common for all domains)
    if (skills.length && skills.some((s) => combined.includes(s))) {
      return true;
    }

    // 2) Domain-based fallback matching
    if (domain === 'it') {
      return (
        combined.includes('developer') ||
        combined.includes('engineer') ||
        combined.includes('software') ||
        combined.includes('programmer')
      );
    }

    if (domain === 'marketing') {
      return (
        combined.includes('marketing') ||
        combined.includes('seo') ||
        combined.includes('content writer') ||
        combined.includes('social media')
      );
    }

    if (domain === 'sales') {
      return (
        combined.includes('sales') ||
        combined.includes('business development') ||
        combined.includes('bdm') ||
        combined.includes('account executive')
      );
    }

    if (domain === 'finance') {
      return (
        combined.includes('accountant') ||
        combined.includes('accounts') ||
        combined.includes('finance')
      );
    }

    if (domain === 'hr') {
      return (
        combined.includes('hr') ||
        combined.includes('human resources') ||
        combined.includes('recruiter') ||
        combined.includes('talent acquisition')
      );
    }

    if (domain === 'design') {
      return (
        combined.includes('designer') ||
        combined.includes('ui') ||
        combined.includes('ux') ||
        combined.includes('graphic')
      );
    }

    if (domain === 'operations') {
      return (
        combined.includes('operations') ||
        combined.includes('logistics') ||
        combined.includes('supply chain')
      );
    }

    // 3) Agar domain set hi nahi hai, toh thoda loose filter:
    // aise case me job ko remove mat karo, kyunki pata nahi user kis domain ka hai.
    if (!domain) {
      return true;
    }

    // Known domain hai but upar kuch match nahi hua → skip
    return false;
  });
}

module.exports = { matchJobsForUser };