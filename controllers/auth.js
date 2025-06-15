const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Register user
const register = async (req, res) => {
    try {
        const { username, walletId, avatarId, bannerId, favoriteChain } = req.body;

        // Check if user already exists by username or walletId
        let user = await User.findOne({ $or: [{ username }, { walletId }] });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Generate unique userId
        const timestamp = Date.now().toString();
        const randomString = crypto.randomBytes(4).toString('hex');
        const userId = `${timestamp}-${randomString}`;

        // Create new user
        user = new User({
            userId,
            username,
            walletId,
            avatarId: avatarId || "1",
            bannerId: bannerId || "1",
            favoriteChain: favoriteChain || [],
            friendList: [],
            rank: 1000, // Initial rank
            score: 0    // Initial score
        });

        await user.save();

        // Create JWT token
        const payload = {
            id: user.userId
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { userId, walletId } = req.body;
        console.log({ userId, walletId });

        // Find user by userId or walletId
        let user = null;
        if (userId) {
            user = await User.findOne({ userId });
        } else if (walletId) {
            user = await User.findOne({ walletId });
        }
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const payload = {
            id: user.userId
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Logout user
const logout = async (req, res) => {
    try {
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.log('Logout error');
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Only allow updating allowed fields
        const allowedFields = ['avatarId', 'bannerId', 'friendList', 'rank', 'score', 'favoriteChain'];
        Object.keys(updateData).forEach(key => {
            if (!allowedFields.includes(key)) {
                delete updateData[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Update user points/score
const updateUserPoints = async (req, res) => {
    try {
        const { userId, points, operation = 'add' } = req.body;

        if (!userId || points === undefined) {
            return res.status(400).json({ message: 'userId and points are required' });
        }

        if (typeof points !== 'number') {
            return res.status(400).json({ message: 'Points must be a number' });
        }

        // Find user
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update points based on operation
        let newScore;
        switch (operation) {
            case 'add':
                newScore = user.score + points;
                break;
            case 'subtract':
                newScore = Math.max(0, user.score - points); // Don't go below 0
                break;
            case 'set':
                newScore = Math.max(0, points); // Don't allow negative scores
                break;
            default:
                return res.status(400).json({ message: 'Invalid operation. Use "add", "subtract", or "set"' });
        }

        // Update user score
        user.score = newScore;
        await user.save();

        res.json({
            success: true,
            message: 'User points updated successfully',
            data: {
                userId: user.userId,
                username: user.username,
                previousScore: operation === 'set' ? points - newScore : user.score - points,
                newScore: newScore,
                pointsChanged: operation === 'set' ? newScore : points,
                operation: operation
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Add friend to user's friend list
const addFriend = async (req, res) => {
    try {
        const { userId, friendId } = req.body;

        if (!userId || !friendId) {
            return res.status(400).json({ message: 'userId and friendId are required' });
        }

        if (userId === friendId) {
            return res.status(400).json({ message: 'Cannot add yourself as a friend' });
        }

        // Check if both users exist
        const user = await User.findOne({ userId });
        const friend = await User.findOne({ userId: friendId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!friend) {
            return res.status(404).json({ message: 'Friend not found' });
        }

        // Check if friend is already in the list
        if (user.friendList.includes(friendId)) {
            return res.status(400).json({ message: 'User is already in friend list' });
        }

        // Add friend to user's friend list
        user.friendList.push(friendId);
        await user.save();

        // Optionally add user to friend's friend list (mutual friendship)
        if (!friend.friendList.includes(userId)) {
            friend.friendList.push(userId);
            await friend.save();
        }

        res.json({
            success: true,
            message: 'Friend added successfully',
            data: {
                userId: user.userId,
                friendList: user.friendList
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Remove friend from user's friend list
const removeFriend = async (req, res) => {
    try {
        const { userId, friendId } = req.body;

        if (!userId || !friendId) {
            return res.status(400).json({ message: 'userId and friendId are required' });
        }

        // Find user
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if friend is in the list
        if (!user.friendList.includes(friendId)) {
            return res.status(400).json({ message: 'User is not in friend list' });
        }

        // Remove friend from user's friend list
        user.friendList = user.friendList.filter(id => id !== friendId);
        await user.save();

        // Optionally remove user from friend's friend list (mutual removal)
        const friend = await User.findOne({ userId: friendId });
        if (friend && friend.friendList.includes(userId)) {
            friend.friendList = friend.friendList.filter(id => id !== userId);
            await friend.save();
        }

        res.json({
            success: true,
            message: 'Friend removed successfully',
            data: {
                userId: user.userId,
                friendList: user.friendList
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-__v') // Exclude version field
            .sort({ score: -1 }); // Sort by score descending (leaderboard style)

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// Get user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ userId: id }).select('-__v');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// Get current user (me)
const getMe = async (req, res) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user by userId from token payload
        const user = await User.findOne({ userId: decoded.id }).select('-__v');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        console.error(err.message);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
};

// Get user's friends with details
const getUserFriends = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        // Find user
        const user = await User.findOne({ userId }).select('friendList');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get friend details
        const friends = await User.find({ 
            userId: { $in: user.friendList } 
        }).select('userId username avatarId rank score');

        res.json({
            success: true,
            count: friends.length,
            data: friends
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    updateUser,
    getAllUsers,
    getUserById,
    getMe,
    addFriend,
    removeFriend,
    updateUserPoints,
    getUserFriends
};