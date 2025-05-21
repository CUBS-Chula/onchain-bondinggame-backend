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

app.use(cors());
app.use(express.json());

const { Server } = require("socket.io");

const rooms = {};
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].length >= 2) {
      socket.emit("room_full");
      return;
    }

    rooms[roomId].push({ id: socket.id, choice: null });
    socket.join(roomId);
    io.to(roomId).emit("player_joined", rooms[roomId].length);
  });

  socket.on("make_choice", ({ roomId, choice }) => {
    const players = rooms[roomId];
    if (!players) return;
    const player = players.find((p) => p.id === socket.id);
    if (player) player.choice = choice;

    if (players.length === 2 && players.every((p) => p.choice)) {
      const [p1, p2] = players;
      const result = getResult(p1.choice, p2.choice);
      io.to(roomId).emit("game_result", {
        results: players.map((p) => {
          const opponent = players.find((x) => x.id !== p.id);
          return {
            socketId: p.id,
            yourChoice: p.choice,
            opponentChoice: opponent.choice,
            result: getResult(p.choice, opponent.choice), // 0: draw, 1: win, 2: lose
          };
        }),
      });
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
      else io.to(roomId).emit("player_left");
    }
  });
});

function getResult(a, b) {
  if (a === b) return 0;
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  )
    return 1;
  return 2;
}

server.listen(3001, () => console.log("Socket.IO server on port 3001"));