const words = [
  "Volvo","Fotboll","Pizza","Stockholm","Kamel",
  "كرة قدم","سيارة","بيت","موبايل","قهوة",
  "Falafel","Kebab","Göteborg","Malmö","Snö"
];

let totalPlayers = 0;
let currentPlayer = 1;
let imposter = 0;
let secretWord = "";

const screen = document.getElementById("screen");

// ✅ START SCREEN
function showStart() {
  screen.innerHTML = `
    <div class="card">
      <h2>Start Game</h2>
      <input id="players" type="number" min="3" placeholder="Number of players">
      <button onclick="startGame()">Start Game</button>
    </div>
  `;
}

// ✅ START GAME
function startGame() {
  const input = document.getElementById("players").value;

  // ✅ FIX: strong validation
  if (!input || isNaN(input) || input < 3) {
    alert("Enter at least 3 players!");
    return;
  }

  totalPlayers = parseInt(input);

  currentPlayer = 1;

  imposter = Math.floor(Math.random() * totalPlayers) + 1;

  // ✅ FIX: use correct variable
  secretWord = words[Math.floor(Math.random() * words.length)];

  showPlayer();
}

// ✅ SHOW PLAYER
function showPlayer() {
  if (currentPlayer > totalPlayers) {
    showEnd();
    return;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>Player ${currentPlayer}</h2>
      <button onclick="reveal()">Reveal Role</button>
    </div>
  `;
}

// ✅ REVEAL ROLE
function reveal() {
  let text;

  if (currentPlayer === imposter) {
    text = "🕵️ YOU ARE THE IMPOSTER!";
  } else {
    text = "✅ WORD: " + secretWord;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>${text}</h2>
      <button onclick="next()">Next Player</button>
    </div>
  `;
}

// ✅ NEXT PLAYER
function next() {
  currentPlayer++;
  showPlayer();
}

// ✅ END SCREEN
function showEnd() {
  screen.innerHTML = `
    <div class="card">
      <h2>🗣️ Discussion Time!</h2>
      <p>Who is the impostor?</p>
      <button onclick="showStart()">New Game</button>
    </div>
  `;
}

// ✅ INIT
showStart();
