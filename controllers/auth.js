const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Register user
const register = async (req, res) => {
    try {
        const { username, walletId, avatarId } = req.body;

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
            avatarId,
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
        const allowedFields = ['avatarId', 'friendList', 'rank', 'score', 'favoriteChain'];
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

module.exports = {
    register,
    login,
    logout,
    updateUser,
    getAllUsers,
    getUserById,
    getMe
};