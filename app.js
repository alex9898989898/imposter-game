
import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion
} from "./firebase.js";

const words = ["Pizza","Volvo","Fotboll","Kebab"];

const screen = document.getElementById("screen");

let roomId = "";
let name = "";

// START SCREEN
function showStart() {
  screen.innerHTML = `
    <div class="card">
      <input id="name" placeholder="Ditt namn">

      <button onclick="createRoom()">Skapa rum</button>

      <input id="room" placeholder="Rumkod">

      <button onclick="joinRoom()">Gå med</button>
    </div>
  `;
}

// CREATE
window.createRoom = async function() {
  name = document.getElementById("name").value;
  if (!name) return alert("Skriv namn");

  roomId = Math.random().toString(36).substring(2,6).toUpperCase();

  await setDoc(doc(db, "rooms", roomId), {
    players: [name],
    started: false
  });

  enterLobby();
};

// JOIN
window.joinRoom = async function() {
  name = document.getElementById("name").value;
  roomId = document.getElementById("room").value.toUpperCase();

  await updateDoc(doc(db,"rooms",roomId), {
    players: arrayUnion(name)
  });

  enterLobby();
};

// LOBBY
function enterLobby() {

  screen.innerHTML = `
    <div class="card">
      <h3>Rum: ${roomId}</h3>

      <ul id="players"></ul>

      <button id="startBtn">Start</button>
    </div>
  `;

  const playersEl = document.getElementById("players");
  const startBtn = document.getElementById("startBtn");

  onSnapshot(doc(db,"rooms",roomId), (snap)=>{

    const data = snap.data();

    playersEl.innerHTML = "";

    data.players.forEach(p=>{
      const li = document.createElement("li");
      li.textContent = p;
      playersEl.appendChild(li);
    });

    if (data.started) {
      showRole(data);
    }
  });

  startBtn.onclick = async () => {
    const word = words[Math.floor(Math.random()*words.length)];
    const snap = await (await import("./firebase.js")).doc;

    const players = [...document.querySelectorAll("#players li")]
      .map(li=>li.textContent);

    const impostor =
      players[Math.floor(Math.random()*players.length)];

    await updateDoc(doc(db,"rooms",roomId), {
      started: true,
      word,
      impostor
    });
  };
}

// ROLE
function showRole(data) {
  let role;

  if (name === data.impostor) {
    role = "🕵️ IMPOSTER";
  } else {
    role = "✅ " + data.word;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>${role}</h2>
    </div>
  `;
}

showStart();

import {
  db,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion
} from "./firebase.js";

const words = ["Pizza","Volvo","Fotboll","Kebab"];

const screen = document.getElementById("screen");

let roomId = "";
let name = "";

// START SCREEN
function showStart() {
  screen.innerHTML = `
    <div class="card">
      <input id="name" placeholder="Ditt namn">

      <button onclick="createRoom()">Skapa rum</button>

      <input id="room" placeholder="Rumkod">

      <button onclick="joinRoom()">Gå med</button>
    </div>
  `;
}

// CREATE
window.createRoom = async function() {
  name = document.getElementById("name").value;
  if (!name) return alert("Skriv namn");

  roomId = Math.random().toString(36).substring(2,6).toUpperCase();

  await setDoc(doc(db, "rooms", roomId), {
    players: [name],
    started: false
  });

  enterLobby();
};

// JOIN
window.joinRoom = async function() {
  name = document.getElementById("name").value;
  roomId = document.getElementById("room").value.toUpperCase();

  await updateDoc(doc(db,"rooms",roomId), {
    players: arrayUnion(name)
  });

  enterLobby();
};

// LOBBY
function enterLobby() {

  screen.innerHTML = `
    <div class="card">
      <h3>Rum: ${roomId}</h3>

      <ul id="players"></ul>

      <button id="startBtn">Start</button>
    </div>
  `;

  const playersEl = document.getElementById("players");
  const startBtn = document.getElementById("startBtn");

  onSnapshot(doc(db,"rooms",roomId), (snap)=>{

    const data = snap.data();

    playersEl.innerHTML = "";

    data.players.forEach(p=>{
      const li = document.createElement("li");
      li.textContent = p;
      playersEl.appendChild(li);
    });

    if (data.started) {
      showRole(data);
    }
  });

  startBtn.onclick = async () => {
    const word = words[Math.floor(Math.random()*words.length)];
    const snap = await (await import("./firebase.js")).doc;

    const players = [...document.querySelectorAll("#players li")]
      .map(li=>li.textContent);

    const impostor =
      players[Math.floor(Math.random()*players.length)];

    await updateDoc(doc(db,"rooms",roomId), {
      started: true,
      word,
      impostor
    });
  };
}

// ROLE
function showRole(data) {
  let role;

  if (name === data.impostor) {
    role = "🕵️ IMPOSTER";
  } else {
    role = "✅ " + data.word;
  }

  screen.innerHTML = `
    <div class="card">
      <h2>${role}</h2>
    </div>
  `;
}

showStart();
