// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      unique: true,
    },

    step: {
      type: String,
      default: 'ask_experience', // ask_experience, ask_resume, ready
    },

    // user ne /fresher ya /experienced type kiya
    experience: {
      type: String, // fresher / experienced
    },

    // resume se nikali gayi skills
    skills: {
      type: [String],
      default: [],
    },

    // NEW: resume / profile se nikala gaya level
    // e.g. fresher, junior, senior, manager
    level: {
      type: String,
      default: null,
    },

    // NEW: domain / field of work
    // e.g. it, marketing, sales, finance, hr, design, operations
    domain: {
      type: String,
      default: null,
    },

    // jitni jobs user ko kabhi dikh chuki hain (URLs)
    seenJobs: {
      type: [String], // job URLs
      default: [],
    },

    // latest batch of jobs jo pagination ke liye use ho rahi hain
    lastJobs: {
      type: [
        {
          title: String,
          company: String,
          url: String,
          description: String,
        },
      ],
      default: [],
    },

    currentJobIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);