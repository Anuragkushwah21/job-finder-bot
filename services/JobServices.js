// services/JobServices.js
const axios = require('axios');

// ================= 1 REMOTIVE =================
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

// ================= 4 ADZUNA =================
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

// ================= FINAL =================
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

module.exports = { fetchJobs };