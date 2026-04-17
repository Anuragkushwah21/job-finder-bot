const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  experience: String,
  skills: [String],
  step: String,

  seenJobs: { type: [String], default: [] },
  lastJobs: { type: Array, default: [] },
  currentJobIndex: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);