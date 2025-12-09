// Socket.IO Client Manager for Keyboard Warrior
class SocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentRoom = null;
        this.username = null;
    }

    connect() {
        if (this.connected) return;

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

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert(error.message || 'An error occurred');
        });

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
        if (!this.socket) return;
        
        this.socket.emit('joinRoom', { roomCode, username });
        
        const handleJoin = (data) => {
            this.currentRoom = roomCode;
            if (callback) callback(null, data);
        };

        const handleError = (error) => {
            if (callback) callback(error, null);
        };

        this.socket.once('playerJoined', handleJoin);
        this.socket.once('error', handleError);
    }

    leaveRoom(roomCode) {
        if (!this.socket || !roomCode) return;
        
        this.socket.emit('leaveRoom', roomCode);
        this.currentRoom = null;
    }

    // Matchmaking
    findMatch(username, onSearching, onMatchFound) {
        if (!this.socket) return;
        
        this.socket.emit('findMatch', username);
        
        this.socket.on('searching', (data) => {
            if (onSearching) onSearching(data);
        });
        
        this.socket.once('matchFound', (data) => {
            this.currentRoom = data.roomCode;
            if (onMatchFound) onMatchFound(data);
        });
    }

    cancelMatchmaking() {
        if (!this.socket) return;
        this.socket.emit('cancelMatchmaking');
        this.socket.off('searching');
        this.socket.off('matchFound');
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

