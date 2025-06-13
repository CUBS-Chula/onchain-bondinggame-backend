const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Get user profile by userId - Protected Route
router.get('/:userId', protect, async (req, res) => {
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

// Update user profile - Protected Route
router.put('/:userId', protect, async (req, res) => {
    try {
        // Check if the authenticated user is updating their own profile
        if (req.user.id !== req.params.userId) {
            return res.status(403).json({ message: 'Not authorized to update this profile' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: req.body },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 