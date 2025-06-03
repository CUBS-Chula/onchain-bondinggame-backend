const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get user stats
router.get('/stats', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('rank score favoriteChain');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Update favorite chain
router.put('/favorite-chain', protect, async (req, res) => {
    try {
        const { chains } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { favoriteChain: chains } },
            { new: true }
        ).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router; 