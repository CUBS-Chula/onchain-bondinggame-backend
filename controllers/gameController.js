const Game = require('../models/Game');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');

// Create a new game
const createGame = async (req, res) => {
  try {
    const gameId = uuidv4();
    
    // Create game with only the creator initially
    const game = new Game({
      gameId,
      userIds: [req.user.userId],
      ranks: [req.user.rank],
      scores: [req.user.score],
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // Expires in 15 minutes
    });
    
    await game.save();
    
    // Generate QR code with the game join URL
    const gameUrl = `${req.protocol}://${req.get('host')}/games/join/${gameId}`;
    const qrCodeDataUrl = await qrcode.toDataURL(gameUrl);
    
    res.status(201).send({ game, qrCodeDataUrl, gameUrl });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Join a game via QR code
const joinGame = async (req, res, io) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findOne({ gameId });
    
    if (!game) {
      return res.status(404).send({ error: 'Game not found' });
    }
    
    if (game.status !== 'pending') {
      return res.status(400).send({ error: 'Game already started or completed' });
    }
    
    if (game.userIds.length >= 2) {
      return res.status(400).send({ error: 'Game is already full' });
    }
    
    if (game.userIds.includes(req.user.userId)) {
      return res.status(400).send({ error: 'You are already in this game' });
    }
    
    // Add second player
    game.userIds.push(req.user.userId);
    game.ranks.push(req.user.rank);
    game.scores.push(req.user.score);
    game.status = 'active';
    await game.save();
    
    // Notify first player that someone joined
    io.to(game.gameId).emit('player-joined', {
      gameId: game.gameId,
      userIds: game.userIds
    });
    
    // Redirect to game page
    res.send({ message: 'Joined game successfully', game });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Get game by ID
const getGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findOne({ gameId });
    
    if (!game) {
      return res.status(404).send({ error: 'Game not found' });
    }
    
    // Check if user is part of the game
    if (!game.userIds.includes(req.user.userId)) {
      return res.status(403).send({ error: 'Not authorized to view this game' });
    }
    
    res.send(game);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Submit move in a game
const submitMove = async (req, res, io) => {
  try {
    const { gameId } = req.params;
    const { move } = req.body;
    
    // Validate move
    if (!['rock', 'paper', 'scissors'].includes(move)) {
      return res.status(400).send({ error: 'Invalid move' });
    }
    
    const game = await Game.findOne({ gameId });
    
    if (!game) {
      return res.status(404).send({ error: 'Game not found' });
    }
    
    // Check if user is part of the game
    const playerIndex = game.userIds.indexOf(req.user.userId);
    if (playerIndex === -1) {
      return res.status(403).send({ error: 'Not authorized to play this game' });
    }
    
    // Check if game is active
    if (game.status !== 'active') {
      return res.status(400).send({ error: 'Game is not active' });
    }
    
    // Check if user already made a move
    const moveCount = game.moves.length;
    if (moveCount === 0 || moveCount === 1 && game.moves[0].split(':')[0] !== req.user.userId) {
      game.moves.push(`${req.user.userId}:${move}`);
      await game.save();
      
      // Notify other player that a move has been made
      io.to(game.gameId).emit('move-made', {
        gameId: game.gameId,
        userId: req.user.userId
      });
      
      // If both players have made their moves, determine the winner
      if (game.moves.length === 2) {
        await determineWinner(game, io);
      }
      
      res.send({ message: 'Move submitted successfully', game });
    } else {
      res.status(400).send({ error: 'You have already made a move' });
    }
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Helper function to determine the winner
const determineWinner = async (game, io) => {
  const [move1, move2] = game.moves.map(m => m.split(':')[1]);
  const [userId1, userId2] = game.userIds;
  
  let winner = null;
  
  if (move1 === move2) {
    // It's a tie
    winner = 'tie';
  } else if (
    (move1 === 'rock' && move2 === 'scissors') ||
    (move1 === 'paper' && move2 === 'rock') ||
    (move1 === 'scissors' && move2 === 'paper')
  ) {
    // Player 1 wins
    winner = userId1;
    await updateRankAndScore(userId1, userId2);
  } else {
    // Player 2 wins
    winner = userId2;
    await updateRankAndScore(userId2, userId1);
  }
  
  game.winner = winner;
  game.status = 'completed';
  await game.save();
  
  // Notify both players of the game result
  io.to(game.gameId).emit('game-completed', {
    gameId: game.gameId,
    winner: game.winner
  });
};

// Helper function to update ranks and scores
const updateRankAndScore = async (winnerId, loserId) => {
  const winner = await User.findOne({ userId: winnerId });
  const loser = await User.findOne({ userId: loserId });
  
  // ELO-style ranking
  const K = 32;
  const winnerExpected = 1 / (1 + Math.pow(10, (loser.rank - winner.rank) / 400));
  const loserExpected = 1 - winnerExpected;
  
  winner.rank = Math.round(winner.rank + K * (1 - winnerExpected));
  loser.rank = Math.round(loser.rank + K * (0 - loserExpected));
  
  // Update scores
  winner.score += 10;
  
  await winner.save();
  await loser.save();
};

// Clean up expired games
const cleanupExpiredGames = async () => {// File: controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

// Register new user
const register = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send({ error: 'Username already taken' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      userId: uuidv4(),
      username,
      password: hashedPassword,
      friends: 0,
      rank: 1000,
      score: 0,
      favoriteChain: []
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).send({ user, token });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).send({ error: 'Invalid login credentials' });
    }
    
    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ error: 'Invalid login credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '7d' });
    
    res.send({ user, token });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Logout user
const logout = (req, res) => {
  res.send({ message: 'Logged out successfully' });
};

// Get user profile
const getProfile = (req, res) => {
  res.send(req.user);
};

// Update user profile
const updateProfile = async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['username', 'favoriteChain'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));
  
  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates' });
  }
  
  try {
    updates.forEach(update => req.user[update] = req.body[update]);
    await req.user.save();
    res.send(req.user);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Get leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ score: -1 })
      .select('userId username score rank')
      .limit(20);
    
    res.send(users);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  getLeaderboard,
}};