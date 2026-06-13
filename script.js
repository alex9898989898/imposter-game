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

// START SCREEN
function showStart() {
  screen.innerHTML = `
    <div class="card">
      <input id="players" type="number" placeholder="Antal spelare">
      <button onclick="startGame()">Start Game</button>
    </div>
  `;
}

function startGame() {
  const input = document.getElementById("players").value;

  // ✅ FIX: check input
  if (!input || isNaN(input) || input < 3) {
    alert("Please enter at least 3 players");
    return;
  }

  totalPlayers = parseInt(input);

  currentPlayer = 1;
  impostor = Math.floor(Math.random() * totalPlayers) + 1;
  word = words[Math.floor(Math.random() * words.length)];

  showPlayer();
}

function showPlayer() {
  if (currentPlayer > totalPlayers) {
    screen.innerHTML = `
      <div class="card">
        <h2>🗣️ Discussion Time</h2>
        <button onclick="showStart()">New Game</button>
      </div>
    `;
    return;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>Player ${currentPlayer}</h2>
      <button onclick="reveal()">Reveal</button>
    </div>
  `;
}

function reveal() {
  let text;

  if (currentPlayer === imposter) {
    text = "🕵️ IMPOSTER";
  } else {
    text = "✅ " + secretWord;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>${text}</h2>
      <button onclick="next()">Next</button>
    </div>
  `;
}

function next() {
  currentPlayer++;
  showPlayer();
}

showStart();