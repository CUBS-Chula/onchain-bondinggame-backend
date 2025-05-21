const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  userIds: { type: [String], required: true, validate: [arrayLimit, '{PATH} must have exactly 2 players'] },
  ranks: { type: [Number], required: true, validate: [arrayLimit, '{PATH} must have exactly 2 ranks'] },
  scores: { type: [Number], required: true, validate: [arrayLimit, '{PATH} must have exactly 2 scores'] },
  moves: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  winner: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

function arrayLimit(val) {
  return val.length === 2;
}

module.exports = mongoose.model('Game', GameSchema);