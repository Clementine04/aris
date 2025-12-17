// Socket.IO Client Manager for Keyboard Warrior
class SocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentRoom = null;
        this.username = null;
        this.isInMatchmaking = false;
    }

    connect() {
        if (this.connected && this.socket) return;

        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;

            // Authenticate if user is logged in
            const username = sessionStorage.getItem('kw_current_user');
            if (username) {
                this.authenticate(username);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
        });

        // Note: Removed global error handler to prevent double alerts
        // Errors are now handled by specific methods

        return this.socket;
    }

    authenticate(username) {
        this.username = username;
        if (this.socket && this.connected) {
            this.socket.emit('authenticate', username);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
            this.currentRoom = null;
        }
    }

    // Reset state after a game ends - call this when returning to dashboard/multiplayer
    resetState() {
        this.currentRoom = null;
        this.isInMatchmaking = false;
        if (this.socket) {
            // Clean up all game-related listeners
            this.socket.off('searching');
            this.socket.off('matchFound');
            this.socket.off('matchmakingTimeout');
            this.socket.off('playerJoined');
            this.socket.off('playerLeft');
            this.socket.off('gameStarting');
            this.socket.off('gameStarted');
            this.socket.off('gameOver');
            this.socket.off('scoresUpdate');
            this.socket.off('timerUpdate');
            this.socket.off('opponentDisconnected');
            this.socket.off('rejoinedRoom');
        }
        // Clear session storage room data
        sessionStorage.removeItem('kw_current_room');
        sessionStorage.removeItem('kw_room_players');
    }

    // Room Management
    createRoom(username, callback) {
        if (!this.socket) return;

        this.socket.emit('createRoom', username);

        this.socket.once('roomCreated', (data) => {
            this.currentRoom = data.roomCode;
            if (callback) callback(data);
        });
    }

    joinRoom(roomCode, username, callback) {
        if (!this.socket) {
            if (callback) callback({ message: 'Not connected to server' }, null);
            return;
        }

        // Create unique handlers that clean up after themselves
        const handleJoin = (data) => {
            this.socket.off('error', handleError);
            this.currentRoom = roomCode;
            if (callback) callback(null, data);
        };

        const handleError = (error) => {
            this.socket.off('playerJoined', handleJoin);
            if (callback) callback(error, null);
        };

        // Use timeout to prevent hanging forever
        const timeout = setTimeout(() => {
            this.socket.off('playerJoined', handleJoin);
            this.socket.off('error', handleError);
            if (callback) callback({ message: 'Connection timeout. Please try again.' }, null);
        }, 10000); // 10 second timeout

        this.socket.once('playerJoined', (data) => {
            clearTimeout(timeout);
            handleJoin(data);
        });

        this.socket.once('error', (error) => {
            clearTimeout(timeout);
            handleError(error);
        });

        this.socket.emit('joinRoom', { roomCode, username });
    }

    leaveRoom(roomCode) {
        if (!this.socket || !roomCode) return;

        this.socket.emit('leaveRoom', roomCode);
        this.currentRoom = null;
    }

    // Matchmaking
    findMatch(username, onSearching, onMatchFound, onTimeout) {
        if (!this.socket) {
            console.error('Socket not connected');
            return;
        }

        // Clean up any previous matchmaking listeners first
        this.socket.off('searching');
        this.socket.off('matchFound');
        this.socket.off('matchmakingTimeout');

        // Reset room state before new matchmaking
        this.currentRoom = null;
        this.isInMatchmaking = true;

        this.socket.emit('findMatch', username);

        this.socket.on('searching', (data) => {
            if (onSearching) onSearching(data);
        });

        this.socket.once('matchFound', (data) => {
            this.isInMatchmaking = false;
            this.socket.off('searching');
            this.socket.off('matchmakingTimeout');
            this.currentRoom = data.roomCode;
            if (onMatchFound) onMatchFound(data);
        });

        // Handle matchmaking timeout from server
        this.socket.once('matchmakingTimeout', (data) => {
            this.isInMatchmaking = false;
            this.socket.off('searching');
            this.socket.off('matchFound');
            if (onTimeout) onTimeout(data);
        });
    }

    cancelMatchmaking() {
        if (!this.socket) return;
        this.isInMatchmaking = false;
        this.socket.emit('cancelMatchmaking');
        this.socket.off('searching');
        this.socket.off('matchFound');
        this.socket.off('matchmakingTimeout');
    }

    // Game Events
    startGame(roomCode, callback) {
        if (!this.socket) return;

        this.socket.emit('startGame', roomCode);

        this.socket.once('gameStarting', (data) => {
            if (callback) callback(data);
        });
    }

    updateScore(roomCode, score) {
        if (!this.socket || !roomCode) return;
        this.socket.emit('updateScore', { roomCode, score });
    }

    finishGame(roomCode, finalScore, callback) {
        if (!this.socket) return;

        this.socket.emit('gameFinished', { roomCode, finalScore });

        this.socket.once('gameOver', (data) => {
            if (callback) callback(data);
        });
    }

    // Event Listeners
    onPlayerJoined(callback) {
        if (!this.socket) return;
        this.socket.on('playerJoined', callback);
    }

    onPlayerLeft(callback) {
        if (!this.socket) return;
        this.socket.on('playerLeft', callback);
    }

    onScoresUpdate(callback) {
        if (!this.socket) return;
        this.socket.on('scoresUpdate', callback);
    }

    onGameOver(callback) {
        if (!this.socket) return;
        this.socket.on('gameOver', callback);
    }

    removeListener(event) {
        if (!this.socket) return;
        this.socket.off(event);
    }
}

// Create global instance
const socketManager = new SocketManager();

// API Helper Functions
const API = {
    async register(username, password) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    async login(username, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async getLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');

            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }

            return await response.json();
        } catch (error) {
            console.error('Leaderboard error:', error);
            throw error;
        }
    },

    async getStats(username) {
        try {
            const response = await fetch(`/api/stats/${username}`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            return await response.json();
        } catch (error) {
            console.error('Stats error:', error);
            throw error;
        }
    }
};

