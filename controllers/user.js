const User = require('../models/User');

// Update user information
const updateUserInfo = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const { username, avatarId, favoriteChain } = req.body;

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prepare update object
        const updateFields = {};

        // Update username if provided
        if (username) {
            // Check if username is already taken by another user
            const existingUser = await User.findOne({ 
                username, 
                userId: { $ne: userId } 
            });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
            updateFields.username = username;
        }

        // Update avatarId if provided
        if (avatarId !== undefined) {
            updateFields.avatarId = avatarId;
        }

        // Update favoriteChain if provided
        if (favoriteChain !== undefined) {
            if (Array.isArray(favoriteChain)) {
                updateFields.favoriteChain = favoriteChain;
            } else {
                return res.status(400).json({ message: 'favoriteChain must be an array' });
            }
        }

        // Check if there are fields to update
        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        // Update the user
        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        // Return updated user info (excluding sensitive data)
        const userResponse = {
            userId: updatedUser.userId,
            username: updatedUser.username,
            walletId: updatedUser.walletId,
            friendList: updatedUser.friendList,
            avatarId: updatedUser.avatarId,
            rank: updatedUser.rank,
            score: updatedUser.score,
            favoriteChain: updatedUser.favoriteChain
        };

        res.json({
            message: 'User information updated successfully',
            user: userResponse
        });

    } catch (err) {
        console.error('Error updating user info:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update user score (for game-related score updates)
const updateUserScore = async (req, res) => {
    try {
        const userId = req.user.id;
        const { score, operation = 'set' } = req.body;

        if (typeof score !== 'number') {
            return res.status(400).json({ message: 'Score must be a number' });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let newScore;
        switch (operation) {
            case 'add':
                newScore = user.score + score;
                break;
            case 'subtract':
                newScore = Math.max(0, user.score - score); // Prevent negative scores
                break;
            case 'set':
            default:
                newScore = score;
                break;
        }

        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { $set: { score: newScore } },
            { new: true }
        );

        res.json({
            message: 'User score updated successfully',
            score: updatedUser.score
        });

    } catch (err) {
        console.error('Error updating user score:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add friend to user's friend list
const addFriend = async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendUserId } = req.body;

        if (!friendUserId) {
            return res.status(400).json({ message: 'Friend user ID is required' });
        }

        // Check if friend exists
        const friendUser = await User.findOne({ userId: friendUserId });
        if (!friendUser) {
            return res.status(404).json({ message: 'Friend user not found' });
        }

        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already friends
        if (user.friendList.includes(friendUserId)) {
            return res.status(400).json({ message: 'User is already in friend list' });
        }

        // Add friend to user's friend list
        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { $addToSet: { friendList: friendUserId } },
            { new: true }
        );

        res.json({
            message: 'Friend added successfully',
            friendList: updatedUser.friendList
        });

    } catch (err) {
        console.error('Error adding friend:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Remove friend from user's friend list
const removeFriend = async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendUserId } = req.body;

        if (!friendUserId) {
            return res.status(400).json({ message: 'Friend user ID is required' });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove friend from user's friend list
        const updatedUser = await User.findOneAndUpdate(
            { userId },
            { $pull: { friendList: friendUserId } },
            { new: true }
        );

        res.json({
            message: 'Friend removed successfully',
            friendList: updatedUser.friendList
        });

    } catch (err) {
        console.error('Error removing friend:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    updateUserInfo,
    updateUserScore,
    addFriend,
    removeFriend
};