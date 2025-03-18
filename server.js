const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`HTTP Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

let waitingPlayer = null;
let games = new Map();

wss.on('connection', ws => {
  console.log('New player connected');

  if (waitingPlayer === null) {
    waitingPlayer = ws;
    ws.send(
      JSON.stringify({ type: 'wait', message: 'Waiting for opponent...' })
    );
  } else {
    // Pair the players
    const gameId = Date.now();
    games.set(gameId, [waitingPlayer, ws]);

    // Notify players about game start
    waitingPlayer.send(JSON.stringify({ type: 'start', player: 0, gameId }));
    ws.send(JSON.stringify({ type: 'start', player: 1, gameId }));

    waitingPlayer = null;
  }

  ws.on('message', message => {
    const data = JSON.parse(message.toString()); // Add toString() here
    const game = Array.from(games.entries()).find(([_, players]) =>
      players.includes(ws)
    );

    if (game) {
      const [gameId, players] = game;
      const opponent = players.find(player => player !== ws);
      if (opponent.readyState === WebSocket.OPEN) {
        opponent.send(JSON.stringify(data)); // Ensure we send stringified data
      }
    }
  });

  ws.on('close', () => {
    console.log('Player disconnected');
    if (waitingPlayer === ws) {
      waitingPlayer = null;
    }

    for (const [gameId, players] of games.entries()) {
      if (players.includes(ws)) {
        const opponent = players.find(player => player !== ws);
        if (opponent.readyState === WebSocket.OPEN) {
          opponent.send(JSON.stringify({ type: 'opponent-left' }));
        }
        games.delete(gameId);
        break;
      }
    }
  });
});
