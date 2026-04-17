const axios = require('axios');

// 🔹 1. Remotive API
const fetchRemotive = async () => {
  const res = await axios.get('https://remotive.com/api/remote-jobs');

  return res.data.jobs.map(job => ({
    title: job.title,
    company: job.company_name,
    url: job.url,
    description: job.description || ""
  }));
};


// 🔹 2. ArbeitNow API
const fetchArbeit = async () => {
  const res = await axios.get('https://arbeitnow.com/api/job-board-api');

  return res.data.data.map(job => ({
    title: job.title,
    company: job.company_name,
    url: job.url,
    description: job.description || ""
  }));
};


// 🔹 3. JSearch API
const fetchRapid = async () => {
  const res = await axios.get(
    'https://jsearch.p.rapidapi.com/search',
    {
      params: {
        query: 'developer jobs',
        page: 1,
        num_pages: 1,
        country: 'in'
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPID_API_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    }
  );

  return res.data.data.map(job => ({
    title: job.job_title,
    company: job.employer_name,
    url: job.job_apply_link,
    description: job.job_description || ""
  }));
};


// 🔥 FINAL EXPORT
const fetchJobs = async () => {
  const results = await Promise.allSettled([
    fetchRemotive(),
    fetchArbeit(),
    fetchRapid()
  ]);

  return results
    .filter(r => r.status === "fulfilled")
    .flatMap(r => r.value);
};

module.exports = { fetchJobs };