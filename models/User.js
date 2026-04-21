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

    experience: {
      type: String, // fresher / experienced
    },

    skills: {
      type: [String],
      default: [],
    },

    // jobs already dikhaye gaye (url list)
    seenJobs: {
      type: [String],
      default: [],
    },

    // last time resume se jo jobs nikli thi
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