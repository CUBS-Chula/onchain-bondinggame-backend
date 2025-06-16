const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const qrcode = require("qrcode");
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { xss } = require("express-xss-sanitizer");
const hpp = require("hpp");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

const User = require("./models/User");
const Game = require("./models/Game");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const { initializeSocketIO } = require("./controllers/socketController");

// Security Middleware
app.use(helmet()); // Security headers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 9999999, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" })); // Body parser with size limit

// Mount routes
app.use("/api/auth", authRoutes);
// Mount profile routes
app.use("/api/profile", profileRoutes);

const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },
  // Performance optimizations
  transports: ["websocket", "polling"],
  pingTimeout: 60000, // Increase ping timeout to 60 seconds
  pingInterval: 25000, // Check connection every 25 seconds
  maxHttpBufferSize: 1e6, // 1 MB
  // Connection throttling
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// Connect to MongoDB
connectDB();

// Initialize Socket.IO
initializeSocketIO(io);

const PORT = 4001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
