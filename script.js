'use strict';

// Selecting elements
const player0El = document.querySelector('.player--0');
const player1El = document.querySelector('.player--1');
const score0El = document.querySelector('#score--0');
const score1El = document.getElementById('score--1');
const current0El = document.getElementById('current--0');
const current1El = document.getElementById('current--1');

const diceEl = document.querySelector('.dice');
const btnNew = document.querySelector('.btn--new');
const btnRoll = document.querySelector('.btn--roll');
const btnHold = document.querySelector('.btn--hold');

let scores, currentScore, activePlayer, playing;

let ws;
let playerNumber;
let gameId;

// Connect to WebSocket server
function connectToServer() {
  // Change this URL after deployment
  const wsUrl =
    window.location.hostname === 'localhost'
      ? 'ws://localhost:8080'
      : `wss://${window.location.hostname}`;

  ws = new WebSocket(wsUrl);

  ws.onmessage = async function (event) {
    let data;
    // Handle different types of messages
    if (event.data instanceof Blob) {
      const text = await event.data.text();
      data = JSON.parse(text);
    } else {
      data = JSON.parse(event.data);
    }

    switch (data.type) {
      case 'wait':
        alert(data.message);
        break;
      case 'start':
        playerNumber = data.player;
        gameId = data.gameId;
        alert(`Game started! You are Player ${playerNumber + 1}`);
        init();
        if (playerNumber === 1) {
          playing = false;
          btnRoll.disabled = true;
          btnHold.disabled = true;
        }
        break;
      case 'opponent-left':
        alert('Opponent left the game!');
        playing = false;
        break;
      case 'game-state':
        updateGameState(data);
        break;
    }
  };

  ws.onclose = function () {
    alert('Connection closed');
  };

  ws.onerror = function (error) {
    console.error('WebSocket Error:', error);
  };
}

function updateGameState(data) {
  // Remove the check for playerNumber !== activePlayer since we want all updates
  scores = data.scores;
  currentScore = data.currentScore;
  activePlayer = data.activePlayer;
  playing = data.playing;

  // Update UI for both players
  score0El.textContent = scores[0];
  score1El.textContent = scores[1];

  // Update current scores
  current0El.textContent = 0;
  current1El.textContent = 0;
  document.getElementById(`current--${activePlayer}`).textContent =
    currentScore;

  // Update active player display for both players
  player0El.classList.remove('player--active');
  player1El.classList.remove('player--active');
  document
    .querySelector(`.player--${activePlayer}`)
    .classList.add('player--active');

  if (data.dice) {
    diceEl.classList.remove('hidden');
    diceEl.src = `dice-${data.dice}.png`;
  }

  // Enable/disable controls based on whose turn it is
  if (activePlayer === playerNumber) {
    btnRoll.disabled = false;
    btnHold.disabled = false;
  } else {
    btnRoll.disabled = true;
    btnHold.disabled = true;
  }

  if (!playing) {
    document
      .querySelector(`.player--${activePlayer}`)
      .classList.add('player--winner');
  }
}

// Starting conditions
const init = function () {
  scores = [0, 0];
  currentScore = 0;
  activePlayer = 0;
  playing = true;

  score0El.textContent = 0;
  score1El.textContent = 0;
  current0El.textContent = 0;
  current1El.textContent = 0;

  diceEl.classList.add('hidden');
  player0El.classList.remove('player--winner');
  player1El.classList.remove('player--winner');
  player0El.classList.add('player--active');
  player1El.classList.remove('player--active');
};
init();

const switchPlayer = function () {
  document.getElementById(`current--${activePlayer}`).textContent = 0;
  currentScore = 0;
  activePlayer = activePlayer === 0 ? 1 : 0;
  player0El.classList.toggle('player--active');
  player1El.classList.toggle('player--active');

  // Send updated state after switching player
  sendGameState({
    type: 'game-state',
    scores,
    currentScore,
    activePlayer,
    playing,
  });
};

// Rolling dice functionality
btnRoll.addEventListener('click', function () {
  if (playing && activePlayer === playerNumber) {
    // 1. Generating a random dice roll
    const dice = Math.trunc(Math.random() * 6) + 1;

    // 2. Display dice
    diceEl.classList.remove('hidden');
    diceEl.src = `dice-${dice}.png`;

    // 3. Check for rolled 1
    if (dice !== 1) {
      // Add dice to current score
      currentScore += dice;
      document.getElementById(`current--${activePlayer}`).textContent =
        currentScore;

      // Send immediate update
      sendGameState({
        type: 'game-state',
        scores,
        currentScore,
        activePlayer,
        playing,
        dice,
      });
    } else {
      // First update current player's state
      currentScore = 0;
      document.getElementById(`current--${activePlayer}`).textContent = 0;
      activePlayer = activePlayer === 0 ? 1 : 0;

      // Then send the switch
      sendGameState({
        type: 'game-state',
        scores,
        currentScore: 0,
        activePlayer,
        playing,
        dice,
      });

      // Finally update local display
      player0El.classList.toggle('player--active');
      player1El.classList.toggle('player--active');
    }
  }
});

btnHold.addEventListener('click', function () {
  if (playing && activePlayer === playerNumber) {
    // 1. Add current score to active player's score
    scores[activePlayer] += currentScore;
    // scores[1] = scores[1] + currentScore

    document.getElementById(`score--${activePlayer}`).textContent =
      scores[activePlayer];

    // 2. Check if player's score is >= 100
    if (scores[activePlayer] >= 100) {
      // Finish the game
      playing = false;
      diceEl.classList.add('hidden');

      document
        .querySelector(`.player--${activePlayer}`)
        .classList.add('player--winner');
      document
        .querySelector(`.player--${activePlayer}`)
        .classList.remove('player--active');

      sendGameState({
        type: 'game-state',
        scores,
        currentScore,
        activePlayer,
        playing,
      });
    } else {
      // First update current player's state
      currentScore = 0;
      document.getElementById(`current--${activePlayer}`).textContent = 0;
      activePlayer = activePlayer === 0 ? 1 : 0;

      // Then send the update
      sendGameState({
        type: 'game-state',
        scores,
        currentScore: 0,
        activePlayer,
        playing,
      });

      // Finally update local display
      player0El.classList.toggle('player--active');
      player1El.classList.toggle('player--active');
    }
  }
});

btnNew.addEventListener('click', init);

// Add visual feedback for disabled buttons in CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
document.head.appendChild(styleSheet);

// Connect when page loads
connectToServer();

function sendGameState(state) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(state));
  }
}
