require('dotenv').config();

const express = require('express');
const app = express();

const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/db');
const User = require('./models/User');
const { fetchJobs } = require('./services/JobServices');

const pdf = require('pdf-parse');
const axios = require('axios');
const cron = require('node-cron');

// ---------------- ENV CHECK ----------------
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

// ---------------- DB ----------------
connectDB();

// ---------------- BOT ----------------
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    autoStart: true,
    interval: 3000
  }
});

bot.deleteWebHook();

bot.on('polling_error', (err)=>{
 console.log('Polling Error:', err.message);
});

// ---------------- HELP TEXT ----------------
const helpText = `🤖 Available Commands:

/start - Start bot
/help - Show commands
/more - Get more jobs

Flow:
1. Type fresher or experienced
2. Upload Resume PDF
3. Get jobs
4. Use /more for more jobs`;

// ---------------- START ----------------
bot.onText(/\/start/, async(msg)=>{

try{

const chatId = msg.chat.id;

let user = await User.findOne({chatId});

if(!user){
 user = await User.create({
  chatId,
  seenJobs:[],
  lastJobs:[],
  currentJobIndex:0,
  step:'ask_experience'
 });
}else{
 user.step='ask_experience';
 await user.save();
}

await bot.sendMessage(
 chatId,
 'Welcome to Job Finder Bot 🚀\n\nType: fresher OR experienced\n\n'+helpText
);

}catch(err){
 console.log(err);
}

});

// ---------------- HELP COMMAND ----------------
bot.onText(/\/help/, async(msg)=>{
 await bot.sendMessage(
   msg.chat.id,
   helpText
 );
});

// ---------------- MESSAGE ----------------
bot.on('message', async(msg)=>{

try{

if(!msg.text) return;

const chatId = msg.chat.id;
const text = msg.text.toLowerCase();

if(text==='/start' || text==='/help') return;

const user = await User.findOne({chatId});
if(!user) return;

// experience
if(user.step==='ask_experience'){

 if(text==='fresher' || text==='experienced'){

  user.experience=text;
  user.step='ask_resume';
  await user.save();

  return bot.sendMessage(
   chatId,
   'Upload your resume PDF'
  );
 }
}

// more jobs
if(text==='/more'){

 if(!user.lastJobs?.length){
  return bot.sendMessage(
   chatId,
   'No jobs yet. Upload resume first. Use /start'
  );
 }

 const start = user.currentJobIndex || 0;
 const end = start + 10;

 const nextJobs = user.lastJobs.slice(start,end);

 if(!nextJobs.length){
  return bot.sendMessage(
   chatId,
   'No more jobs available.'
  );
 }

 user.currentJobIndex=end;
 await user.save();

 let message='🔥 More Jobs:\n\n';

 nextJobs.forEach(job=>{
 message +=
`Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
 });

 return bot.sendMessage(chatId,message);
}

}catch(err){
 console.log(err);
}

});

// ---------------- DOCUMENT ----------------
bot.on('document', async(msg)=>{

try{

const chatId=msg.chat.id;
const user=await User.findOne({chatId});
if(!user) return;

if(msg.document.mime_type!=='application/pdf'){
 return bot.sendMessage(chatId,'Only PDF allowed');
}

bot.sendMessage(chatId,'Processing Resume...');

const fileLink = await bot.getFileLink(msg.document.file_id);
const fileRes = await axios.get(fileLink,{responseType:'arraybuffer'});
const data = await pdf(fileRes.data);

const resumeText=(data.text||'').toLowerCase();

const skillsList=[
'react','node','mongodb','javascript','html','css',
'angular','typescript','express','sql','nextjs'
];

const foundSkills=skillsList.filter(
skill=>resumeText.includes(skill)
);

user.skills=foundSkills;
user.step='ready';
await user.save();

const jobs = await fetchJobs();

if(!jobs?.length){
 return bot.sendMessage(chatId,'No jobs found');
}

const uniqueJobs = Array.from(
new Map(
jobs.map(j=>[j.url,j])
).values()
);

let matched=uniqueJobs.filter(job=>{

const combined=((job.title||'')+' '+(job.description||'')).toLowerCase();

return (
 foundSkills.some(s=>combined.includes(s)) ||
 combined.includes('developer') ||
 combined.includes('engineer')
);

});

if(!matched.length){
 matched=uniqueJobs;
}

user.lastJobs=matched;
user.currentJobIndex=10;

user.seenJobs=[
...new Set([
...(user.seenJobs||[]),
...matched.map(j=>j.url)
])
];

await user.save();

let message='🔥 Jobs For You:\n\n';

matched.slice(0,10).forEach(job=>{
message +=
`Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
});

message += '\nUse /more for more jobs\nUse /help for commands';

bot.sendMessage(chatId,message);

}catch(err){
console.log('Resume Error:',err);
bot.sendMessage(msg.chat.id,'Resume processing failed');
}

});

// ---------------- DAILY JOB ALERT ----------------
cron.schedule(
'0 9 * * *',
async()=>{

try{

console.log('Running daily job notification...');

const users=await User.find();

for(const user of users){

const jobs=await fetchJobs();
if(!jobs?.length) continue;

const seen=user.seenJobs||[];

const newJobs=jobs.filter(
job=>!seen.includes(job.url)
);

if(!newJobs.length){
continue;
}

let msg='🔥 New Jobs Update (Today)\n\n';

newJobs.slice(0,5).forEach(job=>{
msg +=
`Title: ${job.title}
Company: ${job.company}
Apply: ${job.url}

`;
});

msg += '\nUse /more for older saved jobs';

await bot.sendMessage(
user.chatId,
msg
);

user.seenJobs=[
...new Set([
...seen,
...newJobs.map(j=>j.url)
])
];

await user.save();

console.log(`Sent daily jobs to ${user.chatId}`);

}

}catch(err){
console.log('Daily notification error:',err);
}

},
{
timezone:'Asia/Kolkata'
}
);

// ---------------- EXPRESS ----------------
app.get('/',(req,res)=>{
res.send('Job Finder Bot Running');
});

const PORT=process.env.PORT || 4000;

app.listen(PORT,()=>{
console.log(`Server running on ${PORT}`);
});
bot.setMyCommands([
{ command: '/start', description: 'Start bot' },
{ command: '/help', description: 'Show commands' },
{ command: '/more', description: 'More jobs' }
]);
