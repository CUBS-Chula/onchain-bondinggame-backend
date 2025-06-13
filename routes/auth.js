const express = require('express');
const { register, login, logout, updateUser, getAllUsers, getUserById, getMe } = require('../controllers/auth');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.put('/:id', protect, updateUser);
router.get('/users', getAllUsers);
router.get('/user/:id', getUserById);
router.get('/me', getMe);

module.exports = router;