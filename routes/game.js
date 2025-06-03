const express = require('express');
const { createGame, joinGame, getGame, submitMove } = require('../controllers/gameController');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Game routes
router.post('/create', protect, createGame);
router.post('/join/:gameId', protect, joinGame);
router.get('/:gameId', protect, getGame);
router.post('/:gameId/move', protect, submitMove);

module.exports = router; 