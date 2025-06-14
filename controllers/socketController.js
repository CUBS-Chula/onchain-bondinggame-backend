// Socket.IO Controller for Rock Paper Scissors Game
const activeRooms = new Map();
const playerChoices = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  
  const winConditions = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper'
  };
  
  return winConditions[choice1] === choice2 ? 'player1' : 'player2';
}

function handleCreateRoom(socket, { roomId, ...userData }) {
  // Check if room already exists
  if (activeRooms.has(roomId)) {
    socket.emit('room-error', 'Room ID already exists');
    return;
  }
  
  const room = {
    id: roomId,
    host: { ...userData, socketId: socket.id },
    guest: null,
    gameState: 'waiting-for-player',
    createdAt: new Date()
  };
  
  activeRooms.set(roomId, room);
  socket.join(roomId);
  
  socket.emit('room-created', { roomId, hostId: userData.userId });
  console.log(`Room ${roomId} created by ${userData.username}`);
}

function handleJoinRoom(socket, { roomId, guestData }) {
  const room = activeRooms.get(roomId);
  
  if (!room) {
    // Room doesn't exist, so this person becomes the host
    console.log(`Room ${roomId} doesn't exist, creating it for ${guestData.username} as host`);
    const newRoom = {
      id: roomId,
      host: { ...guestData, socketId: socket.id },
      guest: null,
      gameState: 'waiting-for-player',
      createdAt: new Date()
    };
    
    activeRooms.set(roomId, newRoom);
    socket.join(roomId);
    
    socket.emit('room-created', { roomId, hostId: guestData.userId });
    console.log(`Room ${roomId} created by ${guestData.username} (via join)`);
    return;
  }

  // Check if this is a reconnection by the same user
  const isHostReconnecting = room.host.userId === guestData.userId;
  const isGuestReconnecting = room.guest && room.guest.userId === guestData.userId;
  
  if (isHostReconnecting) {
    console.log(`Host ${guestData.username} reconnecting to room ${roomId}`);
    room.host.socketId = socket.id;
    room.disconnectedAt = null; // Clear disconnection mark
    socket.join(roomId);
    
    if (room.guest) {
      // Both players are in room, start game
      socket.emit('room-joined-success', { 
        hostData: room.host,
        roomData: room 
      });
      socket.to(roomId).emit('player-joined', { 
        guestData: room.host,
        roomData: room 
      });
    } else {
      // Still waiting for guest
      socket.emit('room-created', { roomId, hostId: guestData.userId });
    }
    return;
  }
  
  if (isGuestReconnecting) {
    console.log(`Guest ${guestData.username} reconnecting to room ${roomId}`);
    room.guest.socketId = socket.id;
    room.disconnectedAt = null; // Clear disconnection mark
    socket.join(roomId);
    
    // Both players are in room, notify both
    socket.emit('room-joined-success', { 
      hostData: room.host,
      roomData: room 
    });
    socket.to(roomId).emit('player-joined', { 
      guestData,
      roomData: room 
    });
    return;
  }
  
  if (room.guest) {
    socket.emit('room-error', 'Room is full');
    return;
  }
  
  // Check if trying to join own room
  if (room.host.userId === guestData.userId) {
    socket.emit('room-error', 'Cannot join your own room');
    return;
  }
  
  // Add guest to room (new player joining)
  room.guest = { ...guestData, socketId: socket.id };
  room.gameState = 'ready';
  room.disconnectedAt = null; // Clear any disconnection mark
  socket.join(roomId);
  
  // Notify both players
  socket.to(roomId).emit('player-joined', { 
    guestData,
    roomData: room 
  });
  
  socket.emit('room-joined-success', { 
    hostData: room.host,
    roomData: room 
  });
  
  console.log(`${guestData.username} joined room ${roomId}`);
}

function handlePlayerChoice(socket, { roomId, choice, userId }, io) {
  console.log('=== PLAYER CHOICE RECEIVED ===');
  console.log('Room ID:', roomId);
  console.log('Choice:', choice);
  console.log('User ID:', userId);
  
  const room = activeRooms.get(roomId);
  if (!room) {
    console.log('❌ Room not found:', roomId);
    socket.emit('room-error', 'Room not found');
    return;
  }
  
  // Store player choice
  const choiceKey = `${roomId}-${userId}`;
  playerChoices.set(choiceKey, choice);
  
  console.log(`✅ Player ${userId} chose ${choice} in room ${roomId}`);
  
  // Check if both players have made their choices
  const hostChoiceKey = `${roomId}-${room.host.userId}`;
  const guestChoiceKey = `${roomId}-${room.guest.userId}`;
  
  const hostChoice = playerChoices.get(hostChoiceKey);
  const guestChoice = playerChoices.get(guestChoiceKey);
  
  console.log('Host choice:', hostChoice, '(key:', hostChoiceKey, ')');
  console.log('Guest choice:', guestChoice, '(key:', guestChoiceKey, ')');
  
  if (hostChoice && guestChoice) {
    console.log('🎮 Both players have chosen! Determining winner...');
    
    // Determine winner
    const result = determineWinner(hostChoice, guestChoice);
    
    console.log('Game result:', result);

    // Send personalized results to each player
    if (result === 'draw') {
      console.log('📤 Sending draw result to both players');
      // Send draw result to both players
      io.to(roomId).emit('game-result', {
        playerChoice: hostChoice,
        opponentChoice: guestChoice,
        result: 'It\'s a Draw!'
      });
    } else if (result === 'player1') {
      console.log('📤 Host wins, sending results');
      // Host wins
      io.to(room.host.socketId).emit('game-result', { 
        playerChoice: hostChoice,
        opponentChoice: guestChoice,
        result: 'You Win!'
      });
      io.to(room.guest.socketId).emit('game-result', { 
        playerChoice: guestChoice,
        opponentChoice: hostChoice,
        result: 'You Lose!'
      });
    } else {
      console.log('📤 Guest wins, sending results');
      // Guest wins
      io.to(room.host.socketId).emit('game-result', { 
        playerChoice: hostChoice,
        opponentChoice: guestChoice,
        result: 'You Lose!'
      });
      io.to(room.guest.socketId).emit('game-result', { 
        playerChoice: guestChoice,
        opponentChoice: hostChoice,
        result: 'You Win!'
      });
    }
    
    // Clean up choices for next round
    playerChoices.delete(hostChoiceKey);
    playerChoices.delete(guestChoiceKey);
    
    console.log(`🧹 Cleaned up choices for room ${roomId}`);
  } else {
    console.log('⏳ Waiting for other player...');
  }
}

function handleDisconnect(socket) {
  console.log('User disconnected:', socket.id);
  
  // Find room and mark for potential cleanup, but don't delete immediately
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.host.socketId === socket.id || room.guest?.socketId === socket.id) {
      console.log(`Player disconnected from room ${roomId}, giving 10 seconds for reconnection...`);
      
      // Mark the room for cleanup but don't delete immediately
      room.disconnectedAt = new Date();
      
      // Notify other player about temporary disconnection
      socket.to(roomId).emit('player-temporarily-disconnected');
      
      // Set a timeout to delete the room if no reconnection happens
      setTimeout(() => {
        const currentRoom = activeRooms.get(roomId);
        if (currentRoom && currentRoom.disconnectedAt) {
          // Still marked for deletion, so delete it now
          socket.to(roomId).emit('player-disconnected');
          
          // Clean up player choices
          if (currentRoom.host) {
            const hostChoiceKey = `${roomId}-${currentRoom.host.userId}`;
            playerChoices.delete(hostChoiceKey);
          }
          if (currentRoom.guest) {
            const guestChoiceKey = `${roomId}-${currentRoom.guest.userId}`;
            playerChoices.delete(guestChoiceKey);
          }
          
          activeRooms.delete(roomId);
          console.log(`Room ${roomId} deleted after grace period`);
        }
      }, 10000); // 10 second grace period
      
      break;
    }
  }
}

function initializeSocketIO(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('create-room', (userData) => handleCreateRoom(socket, userData));
    socket.on('join-room', (data) => handleJoinRoom(socket, data));
    socket.on('player-choice', (data) => handlePlayerChoice(socket, data, io));
    socket.on('disconnect', () => handleDisconnect(socket));

    // Send room stats for debugging
    socket.on('get-room-stats', () => {
      socket.emit('room-stats', {
        totalRooms: activeRooms.size,
        totalChoices: playerChoices.size
      });
    });
  });

  // Clean up old rooms every 30 minutes
  setInterval(() => {
    const now = new Date();
    for (const [roomId, room] of activeRooms.entries()) {
      const roomAge = now - room.createdAt;
      if (roomAge > 30 * 60 * 1000) { // 30 minutes
        activeRooms.delete(roomId);
        console.log(`Cleaned up old room: ${roomId}`);
      }
    }
  }, 30 * 60 * 1000);
}

module.exports = {
  initializeSocketIO
}; 