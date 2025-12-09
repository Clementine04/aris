# Keyboard Warrior - Setup Guide

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v14 or higher
- **npm** or **yarn**
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Installation Steps

1. **Install Dependencies**
```bash
npm install
```

This will install:
- `express` - Web server framework
- `socket.io` - Real-time WebSocket library
- `bcryptjs` - Password hashing for security
- `uuid` - Unique ID generation for matches

2. **Start the Server**
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

3. **Open the Game**

Open your browser and navigate to:
```
http://localhost:3000/start.html
```

## 📁 Project Structure

```
keyboard-warrior/
│
├── server.js                 # Main Node.js server with Socket.IO
├── package.json              # Dependencies and scripts
│
├── database/                 # JSON database (auto-created)
│   ├── users.json           # User accounts with stats
│   ├── leaderboard.json     # Leaderboard history
│   └── matches.json         # Match history
│
├── public/                   # Client-side resources
│   └── js/
│       └── socket-client.js # Socket.IO client wrapper
│
├── *.html                    # Game pages
│   ├── start.html           # Landing page
│   ├── create.html          # Registration
│   ├── login.html           # Login
│   ├── dashboard.html       # Main menu
│   ├── solo.html            # Practice mode
│   ├── multiplayer.html     # Multiplayer menu
│   ├── createcode.html      # Create room
│   ├── joincode.html        # Join room
│   ├── keyboardwarriorgame.html  # Main game
│   ├── about.html           # About page
│   └── help.html            # Help page
│
├── *.mp3                     # Audio files
├── README.md                 # Full documentation
└── SETUP.md                  # This file
```

## 🎮 How to Play

### 1. Create an Account
- Click "Create Account" on the start page
- Enter a username (no emails)
- Create a password (minimum 6 characters)
- Password is securely hashed with bcrypt

### 2. Choose Game Mode

#### Practice Mode (Solo)
- Play alone to improve your skills
- No win/loss tracking
- Unlimited practice

#### Multiplayer - Random Match
- Get matched with 2 other players
- Automatic matchmaking
- Real-time competition

#### Multiplayer - Create Room
- Generate a 6-character room code
- Share code with friends
- Wait for 2 players to join (3 total)
- Host starts the game

#### Multiplayer - Join Room
- Enter a 6-character room code
- Join existing game
- Wait for host to start

### 3. Gameplay
- Type falling words before they hit the bottom
- Words appear in **neon pink**
- Correctly typed letters turn **cyan**
- Complete the word to destroy it and earn 1 point
- 60 seconds per match
- Word difficulty increases with score

### 4. Winning
- Player with highest score after 60 seconds wins
- Stats are automatically saved:
  - Total games played
  - Total wins
  - Win rate (%)
  - High score
  - Total score

## 🌐 API Endpoints

### REST API

**POST** `/api/register`
- Register new user
- Body: `{ username, password }`
- Returns: `{ success, username }`

**POST** `/api/login`
- User login
- Body: `{ username, password }`
- Returns: `{ success, username, stats }`

**GET** `/api/leaderboard`
- Get top 50 players
- Sorted by: wins → win rate → high score
- Returns: Array of player objects

**GET** `/api/stats/:username`
- Get specific user's stats
- Returns: User stats object

### Socket.IO Events

**Client → Server**
- `authenticate` - Link socket to user
- `createRoom` - Create new game room
- `joinRoom` - Join existing room
- `findMatch` - Join matchmaking queue
- `startGame` - Host starts game
- `updateScore` - Send score updates (real-time)
- `gameFinished` - Submit final score

**Server → Client**
- `roomCreated` - Room successfully created
- `playerJoined` - New player joined
- `playerLeft` - Player disconnected
- `matchFound` - Matchmaking complete
- `gameStarting` - Countdown to start
- `scoresUpdate` - Real-time score sync
- `gameOver` - Match results

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **Session Management**: Server-side socket authentication
- **Input Validation**: All API inputs validated
- **No SQL Injection**: JSON file-based database
- **XSS Protection**: Input sanitization

## 🎯 Leaderboard System

Players are ranked by:
1. **Wins** (primary)
2. **Win Rate** (secondary)
3. **High Score** (tiebreaker)

Stats tracked:
- Games Played
- Wins
- Win Rate = (Wins / Games Played) × 100
- High Score (best single game)
- Total Score (cumulative)

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000   # Windows
lsof -i :3000                  # Mac/Linux

# Use different port
PORT=3001 npm start
```

### Database issues
```bash
# Delete and recreate database
rm -rf database/
# Restart server (will auto-create)
npm start
```

### Socket connection failed
- Ensure server is running on http://localhost:3000
- Check browser console for errors
- Try disabling browser extensions
- Clear browser cache and cookies

### Can't find match
- Need at least 3 players in queue
- Try "Create Room" and share code instead
- Check if other players are online

## 🔧 Configuration

### Change Port
Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

Or use environment variable:
```bash
PORT=8080 npm start
```

### Adjust Game Settings
Edit `keyboardwarriorgame.html`:
```javascript
const GAME_DURATION = 60;  // Game length in seconds
const MAX_PLAYERS = 3;      // Players per match
```

### Database Location
Default: `./database/`

To change, edit `server.js`:
```javascript
const DB_DIR = path.join(__dirname, 'database');
```

## 📊 Performance Tips

- **Production**: Use a process manager like PM2
```bash
npm install -g pm2
pm2 start server.js
pm2 save
```

- **Load Balancing**: Use nginx reverse proxy
- **Database**: For high traffic, consider MongoDB or PostgreSQL
- **Scaling**: Deploy multiple server instances behind load balancer

## 🚢 Deployment

### Deploy to Heroku
```bash
# Install Heroku CLI
heroku login
heroku create keyboard-warrior-game
git push heroku main
heroku open
```

### Deploy to Railway
1. Connect GitHub repo
2. Add environment variables
3. Deploy automatically

### Deploy to Vercel
Not recommended - Vercel doesn't support WebSockets natively.
Use Vercel + Pusher or Ably instead.

## 📝 Notes

- **Database**: JSON files auto-create on first run
- **Audio**: Requires HTTPS in production for autoplay
- **WebSockets**: Ensure firewall allows Socket.IO connections
- **Sessions**: User sessions persist until logout or browser close

## 🎉 You're Ready!

The game should now be running at `http://localhost:3000`

Create an account, invite friends, and start typing!

For issues or questions, check the main README.md or create an issue on GitHub.

**Happy Typing! ⌨️🎮**

