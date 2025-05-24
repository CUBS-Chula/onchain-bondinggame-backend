const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rank: { type: Number, required: true},
  score: { type: Number, required: true, default: 0 },
  favoriteChain: { type: [String], default: [] }
});

module.exports = mongoose.model('User', UserSchema);