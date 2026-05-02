// services/JobServices.js
const axios = require('axios');

// ---------------- QUERY HELPER (BY USER DOMAIN + LEVEL) ----------------
function buildQueryForUser(user = {}) {
  const domain = (user.domain || '').toLowerCase();
  const level = (user.level || user.experience || '').toLowerCase();

  let base;

  // Domain based base query
  switch (domain) {
    case 'marketing':
      base = 'marketing jobs';
      break;
    case 'sales':
      base = 'sales executive';
      break;
    case 'finance':
      base = 'accountant';
      break;
    case 'hr':
      base = 'hr jobs';
      break;
    case 'design':
      base = 'designer';
      break;
    case 'operations':
      base = 'operations executive';
      break;
    case 'it':
    default:
      base = 'software developer';
      break;
  }

  // Level / experience ka flavour
  if (level === 'fresher') {
    base = 'entry level ' + base;
  } else if (level === 'junior') {
    base = 'junior ' + base;
  } else if (level === 'senior' || level === 'experienced') {
    base = 'senior ' + base;
  }

  return base;
}

// ================= 1 REMOTIVE =================
// Mostly remote jobs, zyada tar IT/tech; isko generic hi rehne dete hain. [web:76][web:79]
const fetchRemotive = async () => {
  const res = await axios.get('https://remotive.com/api/remote-jobs');
  if (!res.data?.jobs) return [];
  return res.data.jobs.map((job) => ({
    title: job.title,
    company: job.company_name,
    url: job.url,
    description: job.description || '',
  }));
};

// ================= 2 ARBEIT =================
const fetchArbeit = async () => {
  const res = await axios.get('https://arbeitnow.com/api/job-board-api');
  if (!res.data?.data) return [];
  return res.data.data.map((job) => ({
    title: job.title,
    company: job.company_name,
    url: job.url,
    description: job.description || '',
  }));
};

// ================= 3 JSEARCH (RapidAPI) =================
// Generic (IT heavy) version
const fetchRapid = async () => {
  if (!process.env.RAPID_API_KEY) return [];
  const res = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: {
      query: 'developer jobs',
      page: 1,
      num_pages: 1,
      country: 'in',
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPID_API_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });

  if (!res.data?.data) return [];
  return res.data.data.map((job) => ({
    title: job.job_title,
    company: job.employer_name,
    url: job.job_apply_link,
    description: job.job_description || '',
  }));
};

// User-specific version (domain + level based)
const fetchRapidForUser = async (user) => {
  if (!process.env.RAPID_API_KEY) return [];
  const queryText = buildQueryForUser(user);

  const res = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: {
      query: queryText,
      page: 1,
      num_pages: 1,
      country: 'in',
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPID_API_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });

  if (!res.data?.data) return [];
  return res.data.data.map((job) => ({
    title: job.job_title,
    company: job.employer_name,
    url: job.job_apply_link,
    description: job.job_description || '',
  }));
};

// ================= 4 ADZUNA =================
// Generic (IT heavy) version
const fetchAdzuna = async () => {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) return [];
  const res = await axios.get(
    'https://api.adzuna.com/v1/api/jobs/in/search/1',
    {
      params: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: 'developer',
      },
    }
  );

  if (!res.data?.results) return [];
  return res.data.results.map((job) => ({
    title: job.title,
    company: job.company?.display_name,
    url: job.redirect_url,
    description: job.description || '',
  }));
};

// User-specific version (domain + level based)
const fetchAdzunaForUser = async (user) => {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) return [];
  const queryText = buildQueryForUser(user);

  const res = await axios.get(
    'https://api.adzuna.com/v1/api/jobs/in/search/1',
    {
      params: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        what: queryText,
      },
    }
  );

  if (!res.data?.results) return [];
  return res.data.results.map((job) => ({
    title: job.title,
    company: job.company?.display_name,
    url: job.redirect_url,
    description: job.description || '',
  }));
};

// ================= FINAL: GENERIC (cron, etc.) =================
const fetchJobs = async () => {
  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeit(),
    fetchRapid(),
    fetchAdzuna(),
  ]);

  let jobs = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value || []);

  jobs = Array.from(new Map(jobs.map((j) => [j.url, j])).values());

  return jobs;
};

// ================= FINAL: USER-SPECIFIC (resume, /more) =================
const fetchJobsForUser = async (user) => {
  const results = await Promise.allSettled([
    fetchRemotive(),            // still generic remote jobs
    fetchArbeit(),              // generic
    fetchRapidForUser(user),    // domain + level based [web:43]
    fetchAdzunaForUser(user),   // domain + level based [web:81]
  ]);

  let jobs = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value || []);

  jobs = Array.from(new Map(jobs.map((j) => [j.url, j])).values());

  return jobs;
};

module.exports = { fetchJobs, fetchJobsForUser };