const mongoose = require('mongoose');

const GameHistorySchema = new mongoose.Schema({
  opponentId: { type: String, required: true },
  opponentName: { type: String, required: true },
  opponentAvatarId: { type: String, default: "1" },
  result: { type: String, enum: ['win', 'lose', 'draw'], required: true },
  pointsEarned: { type: Number, required: true },
  playerChoice: { type: String, enum: ['rock', 'paper', 'scissors'], required: true },
  opponentChoice: { type: String, enum: ['rock', 'paper', 'scissors'], required: true },
  timestamp: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  walletId: { type: String, required: true, unique: true },
  friendList: { type: [String], default: [] },
  gameHistory: { type: [GameHistorySchema], default: [] }, // Detailed game history
  avatarId: { type: String, default: "1" },
  bannerId: { type: String, default: "1" },
  rank: { type: Number, required: true},
  score: { type: Number, required: true, default: 0 },
  favoriteChain: { type: [String], default: [] }
});

module.exports = mongoose.model('User', UserSchema);