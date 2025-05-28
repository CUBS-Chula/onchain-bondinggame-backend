const rooms = {};

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

function handleJoinRoom(socket, roomId) {
  if (!rooms[roomId]) rooms[roomId] = [];
  if (rooms[roomId].length >= 2) {
    socket.emit("room_full");
    return;
  }

  rooms[roomId].push({ id: socket.id, choice: null });
  socket.join(roomId);
  socket.to(roomId).emit("player_joined", rooms[roomId].length);
}

function handleMakeChoice(socket, { roomId, choice }) {
  const players = rooms[roomId];
  if (!players) return;
  const player = players.find((p) => p.id === socket.id);
  if (player) player.choice = choice;

  if (players.length === 2 && players.every((p) => p.choice)) {
    const [p1, p2] = players;
    socket.to(roomId).emit("game_result", {
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
}

function handleDisconnect(socket) {
  for (const roomId in rooms) {
    rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id);
    if (rooms[roomId].length === 0) delete rooms[roomId];
    else socket.to(roomId).emit("player_left");
  }
}

function initializeSocketIO(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join_room", (roomId) => handleJoinRoom(socket, roomId));
    socket.on("make_choice", (data) => handleMakeChoice(socket, data));
    socket.on("disconnect", () => handleDisconnect(socket));
  });
}

module.exports = {
  initializeSocketIO
}; 