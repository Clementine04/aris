const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Root route - redirect to start page
app.get('/', (req, res) => {
    res.redirect('/start.html');
});

// Database paths
const DB_DIR = path.join(__dirname, 'database');
const USERS_DB = path.join(DB_DIR, 'users.json');
const LEADERBOARD_DB = path.join(DB_DIR, 'leaderboard.json');
const MATCHES_DB = path.join(DB_DIR, 'matches.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

// Initialize database files
function initDatabase() {
    if (!fs.existsSync(USERS_DB)) {
        fs.writeFileSync(USERS_DB, JSON.stringify({}));
    }
    if (!fs.existsSync(LEADERBOARD_DB)) {
        fs.writeFileSync(LEADERBOARD_DB, JSON.stringify([]));
    }
    if (!fs.existsSync(MATCHES_DB)) {
        fs.writeFileSync(MATCHES_DB, JSON.stringify([]));
    }
}

initDatabase();

// Database helper functions
function readDB(filepath) {
    try {
        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return filepath.includes('users') ? {} : [];
    }
}

function writeDB(filepath, data) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to database:', error);
    }
}

// Game state management
const activeRooms = new Map(); // roomCode -> room data
const playerSockets = new Map(); // socketId -> player data
const matchmakingQueue = []; // Queue for random matchmaking

// Game constants
const GAME_DURATION = 60; // 60 seconds per game

// Room structure
class GameRoom {
    constructor(roomCode, host) {
        this.roomCode = roomCode;
        this.host = host;
        this.players = [host];
        this.maxPlayers = 2;
        this.status = 'waiting'; // waiting, playing, finished
        this.gameStartTime = null;
        this.scores = {};
        this.gameData = {};
        this.timerInterval = null;
        this.timeRemaining = GAME_DURATION;
    }

    addPlayer(player) {
        if (this.players.length < this.maxPlayers && this.status === 'waiting') {
            this.players.push(player);
            this.scores[player.username] = 0;
            return true;
        }
        return false;
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        return this.players.length;
    }

    isFull() {
        return this.players.length >= this.maxPlayers;
    }

    updateScore(username, score) {
        this.scores[username] = score;
    }

    startTimer(io, onTimeUp) {
        this.timeRemaining = GAME_DURATION;
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;

            // Broadcast timer to all players
            io.to(this.roomCode).emit('timerUpdate', {
                timeRemaining: this.timeRemaining
            });

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                onTimeUp();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    getResults() {
        return this.players.map(p => ({
            username: p.username,
            score: this.scores[p.username] || 0
        })).sort((a, b) => b.score - a.score);
    }
}

// REST API Endpoints

// Register new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const users = readDB(USERS_DB);

    if (users[username]) {
        return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    users[username] = {
        username: username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        stats: {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            totalScore: 0,
            highScore: 0,
            winRate: 0
        }
    };

    writeDB(USERS_DB, users);
    res.json({ success: true, username: username });
});

// Login user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const users = readDB(USERS_DB);
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({
        success: true,
        username: user.username,
        stats: user.stats
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const users = readDB(USERS_DB);
    const leaderboard = Object.values(users)
        .map(user => ({
            username: user.username,
            wins: user.stats.wins || 0,
            losses: user.stats.losses || 0,
            draws: user.stats.draws || 0,
            gamesPlayed: user.stats.gamesPlayed || 0,
            winRate: user.stats.winRate || 0,
            highScore: user.stats.highScore || 0,
            totalScore: user.stats.totalScore || 0
        }))
        .filter(user => user.gamesPlayed > 0) // Only show players who have played
        .sort((a, b) => {
            // Sort by highest score (Points)
            return b.highScore - a.highScore;
        })
        .slice(0, 50);

    res.json(leaderboard);
});

// Get user stats
app.get('/api/stats/:username', (req, res) => {
    const { username } = req.params;
    const users = readDB(USERS_DB);
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.stats);
});

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Player authentication
    socket.on('authenticate', (username) => {
        playerSockets.set(socket.id, {
            socketId: socket.id,
            username: username,
            roomCode: null
        });
        socket.emit('authenticated', { socketId: socket.id });
    });

    // Create room
    socket.on('createRoom', (username) => {
        const roomCode = generateRoomCode();
        const player = playerSockets.get(socket.id) || {
            socketId: socket.id,
            username: username
        };

        const room = new GameRoom(roomCode, player);
        activeRooms.set(roomCode, room);

        socket.join(roomCode);
        player.roomCode = roomCode;
        playerSockets.set(socket.id, player);

        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: room.players,
            playerCount: room.players.length
        });

        console.log(`Room ${roomCode} created by ${username}`);
    });

    // Join room by code
    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = activeRooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.status !== 'waiting') {
            socket.emit('error', { message: 'Game already started' });
            return;
        }

        if (room.isFull()) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        const player = { socketId: socket.id, username: username };
        room.addPlayer(player);

        socket.join(roomCode);
        player.roomCode = roomCode;
        playerSockets.set(socket.id, player);

        // Notify all players in the room
        io.to(roomCode).emit('playerJoined', {
            players: room.players,
            playerCount: room.players.length,
            isFull: room.isFull()
        });

        console.log(`${username} joined room ${roomCode}`);
    });

    // Rejoin room (for game page after redirect)
    socket.on('rejoinRoom', ({ roomCode, username }) => {
        const room = activeRooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Update player's socket ID
        const existingPlayer = room.players.find(p => p.username === username);
        if (existingPlayer) {
            existingPlayer.socketId = socket.id;
        } else {
            // Player not found in room, add them
            room.players.push({ socketId: socket.id, username: username });
        }

        socket.join(roomCode);
        playerSockets.set(socket.id, { socketId: socket.id, username: username, roomCode: roomCode });

        // Track ready players
        if (!room.readyPlayers) {
            room.readyPlayers = new Set();
        }
        room.readyPlayers.add(username);

        console.log(`${username} rejoined room ${roomCode}. Ready: ${room.readyPlayers.size}/${room.players.length}`);

        socket.emit('rejoinedRoom', {
            roomCode: roomCode,
            players: room.players,
            status: room.status
        });

        // Check if all players are ready to start
        if (room.readyPlayers.size >= 2 && room.status === 'waiting') {
            // All players ready - start the game!
            room.status = 'playing';
            room.gameStartTime = Date.now();

            room.players.forEach(p => {
                room.scores[p.username] = 0;
            });

            console.log(`All players ready in room ${roomCode}. Starting game!`);

            // Start countdown
            io.to(roomCode).emit('gameStarting', {
                countdown: 3,
                players: room.players,
                gameDuration: GAME_DURATION
            });

            // Start timer after countdown
            setTimeout(() => {
                if (room.status === 'playing') {
                    console.log(`Timer started for room ${roomCode}`);
                    io.to(roomCode).emit('gameStarted', { timeRemaining: GAME_DURATION });
                    room.startTimer(io, () => endGame(roomCode));
                }
            }, 4000);
        }
    });

    // Random matchmaking
    socket.on('findMatch', (username) => {
        const player = {
            socketId: socket.id,
            username: username,
            joinedAt: Date.now()
        };

        // Clean up stale sockets from the queue before matching
        // Remove players whose sockets are no longer connected
        while (matchmakingQueue.length > 0) {
            const waitingPlayer = matchmakingQueue[0];
            const waitingSocket = io.sockets.sockets.get(waitingPlayer.socketId);

            // Check if socket is still connected
            if (!waitingSocket || !waitingSocket.connected) {
                matchmakingQueue.shift(); // Remove stale player
                console.log(`Removed stale player ${waitingPlayer.username} from matchmaking queue`);
                continue;
            }

            // Also check if player has been waiting too long (5 minutes timeout)
            if (Date.now() - waitingPlayer.joinedAt > 5 * 60 * 1000) {
                matchmakingQueue.shift();
                waitingSocket.emit('matchmakingTimeout', { message: 'Matchmaking timed out. Please try again.' });
                console.log(`Removed timed-out player ${waitingPlayer.username} from matchmaking queue`);
                continue;
            }

            // Found a valid player
            break;
        }

        // Check if there are valid waiting players
        if (matchmakingQueue.length >= 1) {
            // Create a room with 2 players
            const player1 = matchmakingQueue.shift();
            const player1Socket = io.sockets.sockets.get(player1.socketId);

            // Double-check player1's socket is still valid
            if (!player1Socket || !player1Socket.connected) {
                // Player1 disconnected, add current player to queue instead
                matchmakingQueue.push(player);
                socket.emit('searching', { position: matchmakingQueue.length });
                console.log(`${username} added to matchmaking queue (opponent disconnected)`);
                return;
            }

            const roomCode = generateRoomCode();
            const room = new GameRoom(roomCode, player1);
            room.addPlayer(player);

            activeRooms.set(roomCode, room);

            // Add all players to the room
            let allPlayersJoined = true;
            [player1, player].forEach(p => {
                const sock = io.sockets.sockets.get(p.socketId);
                if (sock && sock.connected) {
                    sock.join(roomCode);
                    const playerData = playerSockets.get(p.socketId) || { socketId: p.socketId, username: p.username };
                    playerData.roomCode = roomCode;
                    playerSockets.set(p.socketId, playerData);
                } else {
                    allPlayersJoined = false;
                }
            });

            if (!allPlayersJoined) {
                // Clean up if not all players joined
                activeRooms.delete(roomCode);
                matchmakingQueue.push(player);
                socket.emit('searching', { position: matchmakingQueue.length });
                console.log(`Match creation failed, ${username} re-added to queue`);
                return;
            }

            io.to(roomCode).emit('matchFound', {
                roomCode: roomCode,
                players: room.players,
                playerCount: room.players.length
            });

            console.log(`Match found! Room ${roomCode} created with 2 players`);

            // Initialize ready tracking for random match
            room.readyPlayers = new Set();

        } else {
            // Add to queue
            matchmakingQueue.push(player);
            socket.emit('searching', { position: matchmakingQueue.length });
            console.log(`${username} added to matchmaking queue`);
        }
    });

    // Cancel matchmaking
    socket.on('cancelMatchmaking', () => {
        const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
            matchmakingQueue.splice(index, 1);
            socket.emit('matchmakingCancelled');
        }
    });

    // Start game
    socket.on('startGame', (roomCode) => {
        const room = activeRooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.status !== 'waiting') {
            socket.emit('error', { message: 'Game already started' });
            return;
        }

        if (room.players.length < 2) {
            socket.emit('error', { message: 'Need 2 players to start' });
            return;
        }

        room.status = 'playing';
        room.gameStartTime = Date.now();

        // Initialize scores
        room.players.forEach(player => {
            room.scores[player.username] = 0;
        });

        console.log(`Game starting in room ${roomCode} with players:`, room.players.map(p => p.username));

        // Send countdown to all players
        io.to(roomCode).emit('gameStarting', {
            countdown: 3,
            players: room.players,
            gameDuration: GAME_DURATION
        });

        // Start the server-side timer after 4 second countdown (3 sec + 1 buffer)
        setTimeout(() => {
            if (room.status === 'playing') {
                console.log(`Starting timer for room ${roomCode}`);

                // Send game started signal
                io.to(roomCode).emit('gameStarted', {
                    timeRemaining: GAME_DURATION
                });

                // Start the timer
                room.startTimer(io, () => {
                    // Time's up - end the game
                    console.log(`Time's up in room ${roomCode}!`);
                    endGame(roomCode);
                });
            }
        }, 4000);
    });

    // Function to end game and determine winner
    function endGame(roomCode) {
        const room = activeRooms.get(roomCode);
        if (!room || room.status === 'finished') return;

        room.status = 'finished';
        room.stopTimer();

        // Get results sorted by score
        const results = room.getResults();

        // Check for draw
        const isDraw = results.length >= 2 && results[0].score === results[1].score;
        const winner = isDraw ? null : results[0];

        // Update user stats
        updateUserStats(results, isDraw);

        // Save match history
        saveMatch(room, results, isDraw);

        // Send game over to all players
        io.to(roomCode).emit('gameOver', {
            results: results,
            winner: winner,
            isDraw: isDraw
        });

        if (isDraw) {
            console.log(`Game ended in room ${roomCode}. DRAW! Both players scored ${results[0].score} points`);
        } else {
            console.log(`Game ended in room ${roomCode}. Winner: ${winner.username} with ${winner.score} points`);
        }

        // Clean up room after a delay
        setTimeout(() => {
            activeRooms.delete(roomCode);
            console.log(`Room ${roomCode} cleaned up`);
        }, 5000);
    }

    // Update score during game
    socket.on('updateScore', ({ roomCode, score }) => {
        const room = activeRooms.get(roomCode);
        const player = playerSockets.get(socket.id);

        if (room && player && room.status === 'playing') {
            room.updateScore(player.username, score);

            // Broadcast scores to all players
            io.to(roomCode).emit('scoresUpdate', {
                scores: room.scores
            });
        }
    });

    // Game finished (player sends final score)
    socket.on('gameFinished', ({ roomCode, finalScore }) => {
        const room = activeRooms.get(roomCode);
        const player = playerSockets.get(socket.id);

        if (room && player) {
            room.updateScore(player.username, finalScore);
            console.log(`${player.username} finished with score: ${finalScore}`);
        }
    });

    // Leave room
    socket.on('leaveRoom', (roomCode) => {
        handlePlayerLeave(socket, roomCode);
    });

    // Disconnect
    socket.on('disconnect', () => {
        const player = playerSockets.get(socket.id);

        if (player) {
            // Remove from matchmaking queue
            const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id);
            if (queueIndex !== -1) {
                matchmakingQueue.splice(queueIndex, 1);
            }

            // Remove from room
            if (player.roomCode) {
                handlePlayerLeave(socket, player.roomCode);
            }

            playerSockets.delete(socket.id);
        }

        console.log('Client disconnected:', socket.id);
    });
});

// Helper functions
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (activeRooms.has(code)) {
        return generateRoomCode();
    }
    return code;
}

function handlePlayerLeave(socket, roomCode) {
    const room = activeRooms.get(roomCode);
    const leavingPlayer = playerSockets.get(socket.id);

    if (room) {
        // If game is in progress, the remaining player wins
        if (room.status === 'playing' && room.players.length === 2) {
            room.stopTimer();
            room.status = 'finished';

            // Find the remaining player (winner)
            const remainingPlayer = room.players.find(p => p.socketId !== socket.id);
            const leavingPlayerName = leavingPlayer ? leavingPlayer.username : 'Opponent';

            if (remainingPlayer) {
                // Set scores - winner gets their current score, leaver gets 0
                const winnerScore = room.scores[remainingPlayer.username] || 0;
                room.scores[leavingPlayerName] = 0;

                const results = [
                    { username: remainingPlayer.username, score: winnerScore },
                    { username: leavingPlayerName, score: 0, disconnected: true }
                ];

                // Update user stats
                updateUserStats(results);

                // Save match
                saveMatch(room, results);

                // Notify remaining player they won
                io.to(roomCode).emit('opponentDisconnected', {
                    results: results,
                    winner: results[0],
                    message: `${leavingPlayerName} disconnected. You win!`
                });

                console.log(`${leavingPlayerName} disconnected from room ${roomCode}. ${remainingPlayer.username} wins!`);
            }

            // Clean up room after delay
            setTimeout(() => {
                activeRooms.delete(roomCode);
                console.log(`Room ${roomCode} cleaned up after disconnect`);
            }, 3000);

        } else {
            // Game not in progress - normal leave
            const remainingPlayers = room.removePlayer(socket.id);

            socket.leave(roomCode);

            if (remainingPlayers === 0) {
                // Delete empty room
                room.stopTimer();
                activeRooms.delete(roomCode);
                console.log(`Room ${roomCode} deleted - empty`);
            } else {
                // Notify other players
                io.to(roomCode).emit('playerLeft', {
                    players: room.players,
                    playerCount: room.players.length
                });
            }
        }
    }
}

function updateUserStats(results, isDraw = false) {
    const users = readDB(USERS_DB);

    results.forEach((result, index) => {
        const user = users[result.username];
        if (user) {
            // Initialize missing stats
            if (user.stats.draws === undefined) user.stats.draws = 0;
            if (user.stats.losses === undefined) user.stats.losses = 0;

            user.stats.gamesPlayed += 1;
            user.stats.totalScore += result.score;

            if (isDraw) {
                // Draw - no winner
                user.stats.draws += 1;
            } else if (index === 0) {
                // Winner
                user.stats.wins += 1;
            } else {
                // Loser
                user.stats.losses += 1;
            }

            if (result.score > user.stats.highScore) {
                user.stats.highScore = result.score;
            }

            // Win rate = wins / (games - draws) * 100
            const gamesWithResult = user.stats.gamesPlayed - user.stats.draws;
            user.stats.winRate = gamesWithResult > 0
                ? (user.stats.wins / gamesWithResult * 100).toFixed(2)
                : 0;
        }
    });

    writeDB(USERS_DB, users);
}

function saveMatch(room, results, isDraw = false) {
    const matches = readDB(MATCHES_DB);

    matches.push({
        matchId: uuidv4(),
        roomCode: room.roomCode,
        players: room.players.map(p => p.username),
        results: results,
        isDraw: isDraw,
        winner: isDraw ? null : results[0].username,
        startTime: room.gameStartTime,
        endTime: Date.now(),
        duration: Date.now() - room.gameStartTime
    });

    writeDB(MATCHES_DB, matches);
}

// Start server
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║   🎮 KEYBOARD WARRIOR SERVER 🎮      ║
    ║                                       ║
    ║   Server running on port ${PORT}        ║
    ║   http://localhost:${PORT}               ║
    ║                                       ║
    ║   Real-time multiplayer enabled! 🚀  ║
    ╚═══════════════════════════════════════╝
    `);
});

