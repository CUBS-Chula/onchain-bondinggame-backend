// Socket.IO Controller for Rock Paper Scissors Game
const User = require('../models/User');
const activeRooms = new Map();
const playerChoices = new Map();

// Helper function to add friends mutually
async function addPlayersAsFriends(userId1, userId2) {
  try {
    console.log(`💫 Adding ${userId1} and ${userId2} as friends...`);
    
    const user1 = await User.findOne({ userId: userId1 });
    const user2 = await User.findOne({ userId: userId2 });
    
    if (!user1 || !user2) {
      console.log('❌ One or both users not found for friend addition');
      return;
    }
    
    // Add user2 to user1's friend list if not already friends
    if (!user1.friendList.includes(userId2)) {
      user1.friendList.push(userId2);
      await user1.save();
      console.log(`✅ Added ${userId2} to ${userId1}'s friend list`);
    }
    
    // Add user1 to user2's friend list if not already friends
    if (!user2.friendList.includes(userId1)) {
      user2.friendList.push(userId1);
      await user2.save();
      console.log(`✅ Added ${userId1} to ${userId2}'s friend list`);
    }
    
    console.log('🎉 Mutual friendship established!');
  } catch (error) {
    console.error('❌ Error adding friends:', error);
  }
}

// Helper function to update user points based on game outcome
async function updateUserPoints(userId, outcome) {
  try {
    console.log(`🎯 Updating points for ${userId} with outcome: ${outcome}`);
    
    const user = await User.findOne({ userId });
    if (!user) {
      console.log(`❌ User ${userId} not found for point update`);
      return;
    }
    
    let pointsToAdd = 0;
    switch (outcome) {
      case 'win':
        pointsToAdd = 3;
        break;
      case 'draw':
        pointsToAdd = 2;
        break;
      case 'lose':
        pointsToAdd = 1;
        break;
      default:
        console.log(`❌ Unknown outcome: ${outcome}`);
        return;
    }
    
    user.score += pointsToAdd;
    await user.save();
    
    console.log(`✅ Added ${pointsToAdd} points to ${userId}. New score: ${user.score}`);
  } catch (error) {
    console.error('❌ Error updating user points:', error);
  }
}

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
      // Check if room is finished - don't send reconnection events for finished games
      if (room.gameState === 'finished') {
        console.log(`Host reconnecting to finished game - not sending any events`);
        return;
      }
      
      // Check if room is in cooldown - don't send reconnection events during cooldown
      if (room.gameState === 'result-cooldown') {
        console.log(`Host reconnecting during cooldown period - staying in cooldown`);
        // Don't emit any events that would restart the game
        return;
      }
      
      // Both players are in room, but don't auto-start game on reconnection
      socket.emit('room-joined-success', { 
        hostData: room.host,
        roomData: room 
      });
      socket.to(roomId).emit('player-reconnected', { 
        reconnectedPlayer: room.host,
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
    
    // Check if room is finished - don't send reconnection events for finished games
    if (room.gameState === 'finished') {
      console.log(`Guest reconnecting to finished game - not sending any events`);
      return;
    }
    
    // Check if room is in cooldown - don't send reconnection events during cooldown
    if (room.gameState === 'result-cooldown') {
      console.log(`Guest reconnecting during cooldown period - staying in cooldown`);
      // Don't emit any events that would restart the game
      return;
    }
    
    // Both players are in room, but don't auto-start game on reconnection
    socket.emit('room-joined-success', { 
      hostData: room.host,
      roomData: room 
    });
    socket.to(roomId).emit('player-reconnected', { 
      reconnectedPlayer: room.guest,
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
  
  // Notify HOST about the guest joining
  socket.to(roomId).emit('player-joined', { 
    guestData,
    roomData: room 
  });
  
  // Send room data to GUEST with host information
  socket.emit('room-joined-success', { 
    hostData: room.host,
    roomData: room 
  });
  
  console.log(`${guestData.username} joined room ${roomId} - both players now have opponent data`);
  
  // Don't auto-start game anymore - let players click "Start Game" when ready
  console.log('🎮 Both players joined - waiting for both to be ready to start game');
}

function handleStartGame(socket, { roomId, userId }) {
  console.log('=== START GAME REQUEST ===');
  console.log('Room ID:', roomId);
  console.log('User ID:', userId);
  
  const room = activeRooms.get(roomId);
  if (!room) {
    console.log('❌ Room not found:', roomId);
    socket.emit('room-error', 'Room not found');
    return;
  }

  // Check if room is ready for new game
  if (room.gameState !== 'ready') {
    console.log('❌ Room not ready for new game, current state:', room.gameState);
    socket.emit('room-error', 'Room not ready for new game');
    return;
  }

  // Both players need to be present
  if (!room.host || !room.guest) {
    console.log('❌ Not all players are present');
    socket.emit('room-error', 'Waiting for opponent');
    return;
  }

  // Initialize readyPlayers if it doesn't exist
  if (!room.readyPlayers) {
    room.readyPlayers = new Set();
  }

  // Add this player as ready
  room.readyPlayers.add(userId);
  console.log(`✅ Player ${userId} is ready. Ready players: ${room.readyPlayers.size}/2`);

  // Notify the room about the ready status
  const readyPlayerName = userId === room.host.userId ? room.host.username : room.guest.username;
  
  if (room.readyPlayers.size === 1) {
    // First player is ready, notify the room
    socket.to(roomId).emit('player-ready', { 
      playerName: readyPlayerName,
      readyCount: room.readyPlayers.size,
      totalPlayers: 2
    });
    socket.emit('player-ready', { 
      playerName: readyPlayerName,
      readyCount: room.readyPlayers.size,
      totalPlayers: 2
    });
  } else if (room.readyPlayers.size === 2) {
    console.log('🎮 Both players are ready, starting countdown');
    
    // Clear the ready players for next round
    room.readyPlayers.clear();
    
    // Change room state to countdown
    room.gameState = 'countdown';
    
    // Start countdown for both players
    socket.to(roomId).emit('start-countdown');
    socket.emit('start-countdown');
  }
}

async function handlePlayerChoice(socket, { roomId, choice, userId }, io) {
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

  // Check if room is in cooldown period (prevent immediate new games)
  if (room.gameState === 'result-cooldown') {
    console.log('❌ Room is in cooldown period, rejecting choice');
    socket.emit('room-error', 'Game is in cooldown, please wait');
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
    
    // Set room to cooldown state to prevent immediate new games
    room.gameState = 'result-cooldown';
    
    // Determine winner
    const result = determineWinner(hostChoice, guestChoice);
    
    console.log('Game result:', result);

    // Add players as friends after the game (regardless of outcome)
    await addPlayersAsFriends(room.host.userId, room.guest.userId);

    // Send personalized results to each player and update points
    if (result === 'draw') {
      console.log('📤 Sending draw result to both players');
      
      // Update points for both players (draw = 2 points each)
      await updateUserPoints(room.host.userId, 'draw');
      await updateUserPoints(room.guest.userId, 'draw');
      
      // Send draw result to both players
      io.to(roomId).emit('game-result', {
        playerChoice: hostChoice,
        opponentChoice: guestChoice,
        result: 'It\'s a Draw!'
      });
    } else if (result === 'player1') {
      console.log('📤 Host wins, sending results');
      
      // Update points (host wins = 3 points, guest loses = 1 point)
      await updateUserPoints(room.host.userId, 'win');
      await updateUserPoints(room.guest.userId, 'lose');
      
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
      
      // Update points (guest wins = 3 points, host loses = 1 point)
      await updateUserPoints(room.guest.userId, 'win');
      await updateUserPoints(room.host.userId, 'lose');
      
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
    
    // Clean up choices for this game
    playerChoices.delete(hostChoiceKey);
    playerChoices.delete(guestChoiceKey);
    
    console.log(`🧹 Cleaned up choices for room ${roomId}`);

    // Set room to finished state - no more games allowed
    room.gameState = 'finished';
    console.log(`🏁 Game finished for room ${roomId} - no more games allowed`);
    
    // Clean up the room after 30 seconds to give players time to see results
    setTimeout(() => {
      const currentRoom = activeRooms.get(roomId);
      if (currentRoom && currentRoom.gameState === 'finished') {
        console.log(`🗑️ Cleaning up finished room ${roomId}`);
        activeRooms.delete(roomId);
      }
    }, 30000); // 30 second cleanup
    
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
      
      // Only notify about temporary disconnection if:
      // 1. Both players were present AND
      // 2. Game is in progress (countdown or result state) AND
      // 3. Room is not in waiting state
      // 4. A player actually disconnected (socket.id matches)
      const disconnectedPlayer = room.host.socketId === socket.id ? room.host : 
                                room.guest?.socketId === socket.id ? room.guest : null;
      
      const shouldNotifyDisconnection = room.host && room.guest && 
        disconnectedPlayer && // Make sure we actually have a disconnected player
        (room.gameState === 'countdown') &&
        room.gameState !== 'waiting-for-player' && 
        room.gameState !== 'ready' &&
        room.gameState !== 'finished'; // Don't notify disconnection if game is finished
      
      if (shouldNotifyDisconnection) {
        console.log(`❌ DISCONNECT: Notifying room ${roomId} of temporary disconnection`);
        console.log(`❌ DISCONNECT: Disconnected player:`, disconnectedPlayer ? disconnectedPlayer.username : 'unknown');
        console.log(`❌ DISCONNECT: Game state: ${room.gameState}`);
        console.log(`❌ DISCONNECT: Socket ID: ${socket.id}`);
        socket.to(roomId).emit('player-temporarily-disconnected');
      } else {
        console.log(`✅ NO DISCONNECT: Not notifying disconnection for room ${roomId}`);
        console.log(`✅ NO DISCONNECT: Game state: ${room.gameState}`);
        console.log(`✅ NO DISCONNECT: Has disconnected player: ${!!disconnectedPlayer}`);
        console.log(`✅ NO DISCONNECT: Socket ID: ${socket.id}`);
      }
      
      // Set a timeout to delete the room if no reconnection happens
      setTimeout(() => {
        const currentRoom = activeRooms.get(roomId);
        if (currentRoom && currentRoom.disconnectedAt) {
          // Only send disconnect notification if game is not finished
          if (currentRoom.gameState !== 'finished') {
            console.log(`Sending final disconnect notification for room ${roomId}`);
            socket.to(roomId).emit('player-disconnected');
          } else {
            console.log(`Game finished in room ${roomId}, not sending disconnect notification`);
          }
          
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
    socket.on('start-game', (data) => handleStartGame(socket, data));
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