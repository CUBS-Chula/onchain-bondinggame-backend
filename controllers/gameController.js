// controllers/gameController.js

const Game = require('../models/Game');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');

// Create a new game
const createGame = async (req, res) => {
  try {
    const gameId = uuidv4();
    const game = new Game({
      gameId,
      userIds: [req.user.userId],
      ranks: [req.user.rank],
      scores: [req.user.score],
      moves: [],
      status: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });
    await game.save();

    const gameUrl = `${req.protocol}://${req.get('host')}/games/join/${gameId}`;
    const qrCodeDataUrl = await qrcode.toDataURL(gameUrl);

    res.status(201).send({ game, qrCodeDataUrl, gameUrl });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const joinGame = async (req, res, io) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findOne({ gameId });

    if (!game || game.status !== 'pending' || game.userIds.length >= 2 || game.userIds.includes(req.user.userId)) {
      return res.status(400).send({ error: 'Invalid join attempt' });
    }

    game.userIds.push(req.user.userId);
    game.ranks.push(req.user.rank);
    game.scores.push(req.user.score);
    game.status = 'active';
    await game.save();

    io.to(game.gameId).emit('player-joined', { gameId: game.gameId, userIds: game.userIds });

    res.send({ message: 'Joined game successfully', game });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findOne({ gameId });

    if (!game || !game.userIds.includes(req.user.userId)) {
      return res.status(403).send({ error: 'Not authorized or game not found' });
    }

    res.send(game);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const submitMove = async (req, res, io) => {
  try {
    const { gameId } = req.params;
    const { move } = req.body;

    if (!['rock', 'paper', 'scissors'].includes(move)) {
      return res.status(400).send({ error: 'Invalid move' });
    }

    const game = await Game.findOne({ gameId });
    const playerIndex = game?.userIds.indexOf(req.user.userId);

    if (!game || playerIndex === -1 || game.status !== 'active') {
      return res.status(400).send({ error: 'Invalid game state or not authorized' });
    }

    const alreadyMoved = game.moves.find(m => m.startsWith(req.user.userId));
    if (alreadyMoved) {
      return res.status(400).send({ error: 'You have already made a move' });
    }

    game.moves.push(`${req.user.userId}:${move}`);
    await game.save();
    io.to(game.gameId).emit('move-made', { gameId, userId: req.user.userId });

    if (game.moves.length === 2) {
      await determineWinner(game, io);
    }

    res.send({ message: 'Move submitted successfully', game });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const determineWinner = async (game, io) => {
  const [move1, move2] = game.moves.map(m => m.split(':')[1]);
  const [userId1, userId2] = game.userIds;

  let winner = null;
  if (move1 === move2) {
    winner = 'tie';
  } else if ((move1 === 'rock' && move2 === 'scissors') ||
             (move1 === 'paper' && move2 === 'rock') ||
             (move1 === 'scissors' && move2 === 'paper')) {
    winner = userId1;
    await updateRankAndScore(userId1, userId2);
  } else {
    winner = userId2;
    await updateRankAndScore(userId2, userId1);
  }

  game.winner = winner;
  game.status = 'completed';
  await game.save();
  io.to(game.gameId).emit('game-completed', { gameId: game.gameId, winner });
};

const updateRankAndScore = async (winnerId, loserId) => {
  const winner = await User.findOne({ userId: winnerId });
  const loser = await User.findOne({ userId: loserId });

  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.rank - winner.rank) / 400));
  const expectedLoser = 1 - expectedWinner;

  winner.rank = Math.round(winner.rank + K * (1 - expectedWinner));
  loser.rank = Math.round(loser.rank + K * (0 - expectedLoser));
  winner.score += 10;

  await winner.save();
  await loser.save();
};

const cleanupExpiredGames = async () => {
  try {
    const result = await Game.deleteMany({ expiresAt: { $lt: new Date() }, status: 'pending' });
    console.log(`Cleaned up ${result.deletedCount} expired games.`);
  } catch (error) {
    console.error('Error cleaning up expired games:', error);
  }
};

module.exports = {
  createGame,
  joinGame,
  getGame,
  submitMove,
  cleanupExpiredGames
};
