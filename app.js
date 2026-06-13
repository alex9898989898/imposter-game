import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  arrayUnion
} from "./firebase.js";

const words = ["Pizza","Volvo","Fotboll","Kebab"];

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

window.createRoom = async function () {
  name = document.getElementById("name").value;

  if (!name) return alert("Enter name");

  roomId = Math.random().toString(36).substring(2,6).toUpperCase();

  await setDoc(doc(db,"rooms",roomId), {
    players: [name],
    started: false
  });

  enterLobby();
};

window.joinRoom = async function () {
  name = document.getElementById("name").value;
  roomId = document.getElementById("room").value.toUpperCase();

  if (!name || !roomId) return alert("Fill all");

  await updateDoc(doc(db,"rooms",roomId), {
    players: arrayUnion(name)
  });

  enterLobby();
};

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

    playersEl.innerHTML = "";

    data.players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      playersEl.appendChild(li);
    });

    if (data.started) showRole(data);
  });

  document.getElementById("startBtn").onclick = async () => {
    const snap = await getDoc(doc(db,"rooms",roomId));
    const players = snap.data().players;

    const word = words[Math.floor(Math.random() * words.length)];
    const impostor =
      players[Math.floor(Math.random() * players.length)];

    await updateDoc(doc(db,"rooms",roomId), {
      started: true,
      word,
      impostor
    });
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

showStart();