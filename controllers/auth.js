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

module.exports = {
    register,
    login,
    logout,
    updateUser
}; 