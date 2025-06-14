const express = require('express');
const { register, login, logout, updateUser, getAllUsers, getUserById, getMe, addFriend, removeFriend, updateUserPoints, getUserFriends } = require('../controllers/auth');
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

// Friend management routes
router.post('/add-friend', addFriend);
router.post('/remove-friend', removeFriend);
router.get('/friends/:userId', getUserFriends);

// Points management routes
router.post('/update-points', updateUserPoints);

module.exports = router;