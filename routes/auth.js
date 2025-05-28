const express = require('express');
const { register, login, logout, updateUser } = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/logout', protect, logout);
router.put('/:id', protect, updateUser);

module.exports = router;