const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const http = require('http');

const app = express();
const server = http.createServer(app);

const User = require('./models/User');
const Game = require('./models/Game');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const { initializeSocketIO } = require('./controllers/socketController');

app.use(cors());
app.use(express.json());

// Mount auth routes
app.use('/api/auth', authRoutes);
// Mount profile routes
app.use('/api/profile', profileRoutes);

const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*" },
});

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// Initialize Socket.IO
initializeSocketIO(io);

server.listen(3001, () => console.log("Socket.IO server on port 3001"));