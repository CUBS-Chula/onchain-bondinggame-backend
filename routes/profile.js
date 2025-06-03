const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get user profile by userId
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .select('-password'); // Exclude password from the response
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 