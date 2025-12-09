# 🎮 Keyboard Warrior - Multiplayer Typing Game

A fast-paced, retro-futuristic multiplayer typing game built with Node.js, Express, and Socket.IO. Test your typing speed and accuracy against players worldwide in real-time matches!

## 🌟 Features

- **Real-time Multiplayer**: Battle up to 3 players simultaneously using Socket.IO
- **Authentication System**: Secure user registration and login with bcrypt
- **Global Leaderboards**: Track top players by wins, win rate, and high scores
- **Win Rate Tracking**: Comprehensive stats including games played, wins, and performance metrics
- **Multiple Game Modes**:
  - Practice Mode: Solo play to improve your skills
  - Random Match: Quick matchmaking with other players
  - Private Rooms: Create/join rooms with custom codes
- **JSON Database**: Persistent storage for users, scores, and match history
- **Beautiful UI**: Neon cyberpunk aesthetic with animated particles

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd keyboard-warrior
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 🎯 How to Play

1. **Register/Login**: Create an account or login to track your stats
2. **Choose Mode**:
   - **Practice Mode**: Play solo to warm up
   - **Random Match**: Get matched with 2 other players
   - **Create/Join Room**: Play with friends using room codes
3. **Type Fast**: Words fall from the top - type them before they hit the bottom!
4. **Win**: Get the highest score in 60 seconds to win the match

## 📊 Leaderboard System

Players are ranked by:
1. **Total Wins**: Number of matches won
2. **Win Rate**: Percentage of games won (Wins / Games Played × 100)
3. **High Score**: Best single-game performance

## 🏗️ Project Structure

```
keyboard-warrior/
├── server.js                 # Main server file with Socket.IO logic
├── package.json              # Dependencies and scripts
├── database/                 # JSON database files
│   ├── users.json           # User accounts and stats
│   ├── leaderboard.json     # Historical leaderboard data
│   └── matches.json         # Match history
├── public/                   # Static files served to client
│   └── js/
│       └── socket-client.js # Socket.IO client wrapper
├── *.html                    # Game pages (login, dashboard, game, etc.)
└── README.md
```

## 🔧 API Endpoints

### REST API

- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `GET /api/leaderboard` - Get top 50 players
- `GET /api/stats/:username` - Get user statistics

### Socket.IO Events

**Client → Server:**
- `authenticate` - Authenticate user with socket
- `createRoom` - Create a new game room
- `joinRoom` - Join existing room by code
- `findMatch` - Join random matchmaking queue
- `startGame` - Start game in room
- `updateScore` - Send score updates during game
- `gameFinished` - Submit final score

**Server → Client:**
- `roomCreated` - Room successfully created
- `playerJoined` - New player joined room
- `playerLeft` - Player left room
- `matchFound` - Matchmaking complete
- `gameStarting` - Game countdown starting
- `scoresUpdate` - Real-time score updates
- `gameOver` - Match results

## 🎨 Technologies Used

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Security**: bcryptjs for password hashing
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Database**: JSON file-based storage

## 📝 User Stats Tracked

- Games Played
- Wins
- Total Score (cumulative)
- High Score (best single game)
- Win Rate (%)

## 🎮 Game Mechanics

- **Duration**: 60 seconds per match
- **Players**: 1-3 players per match
- **Scoring**: +1 point per word typed correctly
- **Difficulty**: Word length increases with score
- **Ranking**: Based on final scores after time expires

## 👥 Credits

Developed by BSIT 3A WMAD Students:
- Aristotle Lee Maramag
- Charles Benedict Ordanza
- Jherus Ferrer

## 📄 License

MIT License

## 🐛 Known Issues & Future Improvements

- [ ] Add voice chat support
- [ ] Implement power-ups and special abilities
- [ ] Add tournament mode
- [ ] Mobile app version
- [ ] Replay system
- [ ] Friend system and private messaging

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Enjoy the game and may your typing speed be legendary! ⚡️**

