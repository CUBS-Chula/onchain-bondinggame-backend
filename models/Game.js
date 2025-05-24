// models/Game.js

const mongoose = require('mongoose');

// Validator to ensure at most 2 players for active/completed games
function arrayMaxTwo(val) {
  return val.length <= 2;
}

const gameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true,
  },
  userIds: {
    type: [String],
    required: true,
    validate: [arrayMaxTwo, '{PATH} must have at most 2 players'],
  },
  ranks: {
    type: [Number],
    default: [],
    validate: [arrayMaxTwo, '{PATH} must have at most 2 ranks'],
  },
  scores: {
    type: [Number],
    default: [],
    validate: [arrayMaxTwo, '{PATH} must have at most 2 scores'],
  },
  moves: {
    type: [String], // Format: ["userId:move"]
    default: [],
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending',
  },
  winner: {
    type: String, // userId of winner or 'tie'
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // Auto-set 15 mins ahead
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// TTL index for auto-cleanup of expired games
gameSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Game', gameSchema);
