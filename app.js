import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  arrayUnion
} from "./firebase.js";

let words = [];

// ✅ load words from txt file
async function loadWords() {
  const res = await fetch("words.txt");
  const text = await res.text();

  words = text
    .split("\n")
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

const screen = document.getElementById("screen");

let roomId = "";
let name = "";

// ✅ START SCREEN
function showStart() {
  screen.innerHTML = `
    <div class="card">
      <input id="name" placeholder="Your name">

      <button onclick="createRoom()">Create Room</button>

      <input id="room" placeholder="Room code">
      <button onclick="joinRoom()">Join Room</button>
    </div>
  `;
}

// ✅ CREATE ROOM
window.createRoom = async function () {
  name = document.getElementById("name").value.trim();

  if (!name) return alert("Enter name");

  roomId = Math.random().toString(36).substring(2,6).toUpperCase();

  try {
    await setDoc(doc(db,"rooms",roomId), {
      players: [name],
      started: false
    });

    enterLobby();
  } catch (err) {
    console.error(err);
    alert("Error creating room");
  }
};

// ✅ JOIN ROOM
window.joinRoom = async function () {
  name = document.getElementById("name").value.trim();
  roomId = document.getElementById("room").value.toUpperCase();

  if (!name || !roomId) return alert("Fill all fields");

  try {
    const snap = await getDoc(doc(db,"rooms",roomId));

    if (!snap.exists()) {
      alert("Room not found");
      return;
    }

    const data = snap.data();

    // ✅ prevent duplicate names
    if (!data.players.includes(name)) {
      await updateDoc(doc(db,"rooms",roomId), {
        players: arrayUnion(name)
      });
    }

    enterLobby();
  } catch (err) {
    console.error(err);
    alert("Error joining room");
  }
};

// ✅ LOBBY
function enterLobby() {
  screen.innerHTML = `
    <div class="card">
      <h3>Room: ${roomId}</h3>
      <ul id="players"></ul>
      <button id="startBtn">Start Game</button>
    </div>
  `;

  const playersEl = document.getElementById("players");

  onSnapshot(doc(db,"rooms",roomId), (snap) => {
    const data = snap.data();

    if (!data) return;

    playersEl.innerHTML = "";

    data.players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      playersEl.appendChild(li);
    });

    // ✅ if game started → show role
    if (data.started) {
      showRole(data);
    }
  });

  document.getElementById("startBtn").onclick = async () => {
    try {
      const snap = await getDoc(doc(db,"rooms",roomId));
      const data = snap.data();

      if (data.started) return; // ✅ prevent multiple starts

      const players = data.players;

      const word = words[Math.floor(Math.random() * words.length)];

      const impostor =
        players[Math.floor(Math.random() * players.length)];

      await updateDoc(doc(db,"rooms",roomId), {
        started: true,
        word,
        impostor
      });

    } catch (err) {
      console.error(err);
      alert("Error starting game");
    }
  };
}

// ✅ SHOW ROLE
function showRole(data) {
  const role =
    name === data.impostor
      ? "🕵️ YOU ARE IMPOSTER"
      : "✅ WORD: " + data.word;

  screen.innerHTML = `
    <div class="card">
      <h2>${role}</h2>
    </div>
  `;
}

async function startApp() {
  await loadWords(); // ✅ load txt first
  showStart();
}

startApp();
