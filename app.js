
// ==========================
// IMPORT FIREBASE
// ==========================
import {
  db,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from "./firebase.js";


// ==========================
// GLOBAL STATE
// ==========================
let roomId = null;
let playerName = null;

let roomData = null;
let isHost = false;


// ==========================
// DOM HELPERS
// ==========================
const screens = {
  loading: document.getElementById("loadingScreen"),
  start: document.getElementById("startScreen"),
  quickJoin: document.getElementById("quickJoinScreen"),
  created: document.getElementById("roomCreatedScreen"),
  lobby: document.getElementById("lobbyScreen"),
  pass: document.getElementById("passScreen"),
  role: document.getElementById("roleScreen"),
  discussion: document.getElementById("discussionScreen"),
  voting: document.getElementById("votingScreen"),
  results: document.getElementById("resultsScreen"),
  scoreboard: document.getElementById("scoreboardScreen")
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}


// ==========================
// TOAST
// ==========================
function toast(msg) {
  const el = document.getElementById("toast");
  el.innerText = msg;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 2000);
}


// ==========================
// RANDOM ROOM ID
// ==========================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}


// ==========================
// LOAD FROM URL (?room=XXXX)
// ==========================
function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}


// ==========================
// CREATE ROOM
// ==========================
window.createRoom = async function () {
  playerName = document.getElementById("playerName").value.trim();

  if (!playerName) return toast("Enter name");

  roomId = generateRoomId();
  isHost = true;

  const roomRef = doc(db, "rooms", roomId);

  await setDoc(roomRef, {
    host: playerName,
    phase: "lobby",
    started: false,
    createdAt: Date.now(),

    players: [
      {
        name: playerName,
        ready: false,
        score: 0
      }
    ]
  });

  setupRoomListener();
  showCreatedRoom();
};


// ==========================
// SHOW CREATED ROOM SCREEN
// ==========================
function showCreatedRoom() {
  showScreen("created");

  const link = `${window.location.origin}?room=${roomId}`;

  document.getElementById("shareLinkInput").value = link;

  document.getElementById("copyLinkBtn").onclick = async () => {
    await navigator.clipboard.writeText(link);
    toast("Copied!");
  };

  document.getElementById("shareBtn").onclick = async () => {
    if (navigator.share) {
      navigator.share({ url: link });
    } else {
      toast("Sharing not supported");
    }
  };

  document.getElementById("goLobbyBtn").onclick = () => {
    showLobby();
  };

  const qr = document.getElementById("qrCode");
  qr.innerHTML = "";
  new QRCode(qr, link);
}


// ==========================
// JOIN ROOM
// ==========================
window.joinRoom = async function () {
  playerName = document.getElementById("playerName").value.trim();
  const inputRoom = document.getElementById("roomCode").value.trim().toUpperCase();

  if (!playerName || !inputRoom) return toast("Fill all fields");

  roomId = inputRoom;

  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    return toast("Room not found");
  }

  const data = snap.data();

  const exists = data.players.some(p => p.name === playerName);

  if (!exists) {
    await updateDoc(roomRef, {
      players: arrayUnion({
        name: playerName,
        ready: false,
        score: 0
      })
    });
  }

  setupRoomListener();
  watchPhaseChanges(); // ✅ add this
  showLobby();
};


// ==========================
// QUICK JOIN FROM LINK
// ==========================
function quickJoinCheck() {
  const room = getRoomFromURL();

  if (room) {
    roomId = room.toUpperCase();
    showScreen("quickJoin");

    document.getElementById("quickJoinRoomText").innerText =
      "Room: " + roomId;

    document.getElementById("quickJoinBtn").onclick = async () => {
      playerName = document.getElementById("quickJoinName").value.trim();

      if (!playerName) return toast("Enter name");

      const roomRef = doc(db, "rooms", roomId);
      const snap = await getDoc(roomRef);

      if (!snap.exists()) return toast("Room not found");

      const data = snap.data();

      const exists = data.players.some(p => p.name === playerName);

      if (!exists) {
        await updateDoc(roomRef, {
          players: arrayUnion({
            name: playerName,
            ready: false,
            score: 0
          })
        });
      }

      setupRoomListener();
      watchPhaseChanges(); // ✅ add this
      showLobby();
    };

    return true;
  }

  return false;
}


// ==========================
// ROOM LISTENER (REALTIME)
// ==========================
function setupRoomListener() {
  const roomRef = doc(db, "rooms", roomId);

  onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) return;

    roomData = snap.data();

    isHost = roomData.host === playerName;

    updateLobbyUI();

    if (roomData.phase === "playing") {
      showPassScreen();
    }
  });
}


// ==========================
// SHOW LOBBY
// ==========================
function showLobby() {
  showScreen("lobby");

  if (isHost) {
    document.getElementById("startGameBtn").style.display = "block";
  } else {
    document.getElementById("startGameBtn").style.display = "none";
  }

  document.getElementById("startGameBtn").onclick = startGame;

  document.getElementById("readyBtn").onclick = toggleReady;

  document.getElementById("leaveBtn").onclick = leaveRoom;
}


// ==========================
// UPDATE LOBBY UI
// ==========================
function updateLobbyUI() {
  if (!roomData) return;

  document.getElementById("roomTitle").innerText = roomId;

  document.getElementById("playerCount").innerText =
    roomData.players.length + " Players";

  const list = document.getElementById("playersList");
  list.innerHTML = "";

  roomData.players.forEach(p => {
    const li = document.createElement("li");
    li.innerText =
      p.name +
      (p.ready ? " ✅" : " ⏳") +
      (roomData.host === p.name ? " 👑" : "");

    list.appendChild(li);
  });

  document.getElementById("hostBadge").style.display =
    isHost ? "block" : "none";
}


// ==========================
// TOGGLE READY
// ==========================
async function toggleReady() {
  const roomRef = doc(db, "rooms", roomId);

  const updated = roomData.players.map(p => {
    if (p.name === playerName) {
      return { ...p, ready: !p.ready };
    }
    return p;
  });

  await updateDoc(roomRef, {
    players: updated
  });
}


// ==========================
// LEAVE ROOM
// ==========================

async function leaveRoom() {
  const roomRef = doc(db, "rooms", roomId);

  const updated = roomData.players.filter(p => p.name !== playerName);

  await updateDoc(roomRef, {
    players: updated
  });

  location.reload();
}



// ==========================
// START APP
// ==========================
console.log("APP STARTING...");
async function startApp() {
  showScreen("loading");

  await loadWords(); // ✅ add this

  setTimeout(() => {
    if (!quickJoinCheck()) showScreen("start");
  }, 800);
}


startApp();


// ==========================
// GAME STATE (PART 2)
// ==========================
let words = [];
let myRole = null;
let gameWord = null;
let impostor = null;

let timerInterval = null;
let timeLeft = 0;


// ==========================
// LOAD WORDS
// ==========================
async function loadWords() {
  try {
    const res = await fetch("words.txt");
    const text = await res.text();

    words = text
      .split("\n")
      .map(w => w.trim())
      .filter(Boolean);

  } catch (e) {
    words = ["Pizza", "Volvo", "Football", "School", "Police"];
  }
}
console.log("WORDS LOADED");


// ==========================
// START GAME (HOST ONLY)
// ==========================
async function startGame() {
  if (!isHost) return;

  const roomRef = doc(db, "rooms", roomId);

  const players = roomData.players;

  if (players.length < 3) {
    return toast("Need at least 3 players");
  }
  
    if (!players.every(p => p.ready)) {
    return toast("All players must be ready");
    }


  const word =
    words[Math.floor(Math.random() * words.length)];

  const impostorPlayer =
    players[Math.floor(Math.random() * players.length)].name;


    await updateDoc(roomRef, {
    phase: "playing", // ✅ must match listener
    started: true,
    word,
    impostor: impostorPlayer
    });

}


// ==========================
// SHOW PASS SCREEN
// ==========================
function showPassScreen() {
  showScreen("pass");

  document.getElementById("revealRoleBtn").onclick =
    revealMyRole;
}


// ==========================
// REVEAL ROLE (ANTI-CHEAT STYLE)
// ==========================
function revealMyRole() {
  const data = roomData;

  if (!data) return;

  if (playerName === data.impostor) {
    myRole = "IMPOSTOR";
  } else {
    myRole = "INNOCENT";
    gameWord = data.word;
  }

  showScreen("role");

  const el = document.getElementById("roleContent");

  if (myRole === "IMPOSTOR") {
    el.innerHTML = "🕵️ YOU ARE THE IMPOSTOR";
  } else {
    el.innerHTML = "🧠 WORD: " + gameWord;
  }

  document.getElementById("continueBtn").onclick =
    startDiscussion;
}


// ==========================
// START DISCUSSION PHASE
// ==========================
async function startDiscussion() {
  const roomRef = doc(db, "rooms", roomId);

  await updateDoc(roomRef, {
    phase: "discussion",
    timeStarted: Date.now()
  });

  showDiscussion();
}


// ==========================
// DISCUSSION SCREEN + TIMER
// ==========================
function showDiscussion() {
  showScreen("discussion");

  clearInterval(timerInterval); // ✅ IMPORTANT

  timeLeft = 120;

  updateTimer();

  timerInterval = setInterval(() => {
    timeLeft--;

    updateTimer();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      startVoting();
    }
  }, 1000);
}


// ==========================
// TIMER UI
// ==========================
function updateTimer() {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;

  document.getElementById("timerDisplay").innerText =
    `${min.toString().padStart(2,"0")}:${sec
      .toString()
      .padStart(2,"0")}`;
}


// ==========================
// START VOTING PHASE
// ==========================
async function startVoting() {
  const roomRef = doc(db, "rooms", roomId);

  await updateDoc(roomRef, {
    phase: "voting",
    votes: {}
  });

  showVoting();
}


// ==========================
// SHOW VOTING UI
// ==========================
function showVoting() {
  showScreen("voting");

  const container = document.getElementById("voteList");
  container.innerHTML = "";

  roomData.players.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "vote-btn";
    btn.innerText = "Vote: " + p.name;

    btn.onclick = () => votePlayer(p.name);

    container.appendChild(btn);
  });
}


// ==========================
// VOTE PLAYER
// ==========================


if (roomData.votes && roomData.votes[playerName]) {
  return toast("You already voted");
}

async function votePlayer(target) {
  const roomRef = doc(db, "rooms", roomId);
  const votes = roomData.votes || {};

  votes[playerName] = target;

  await updateDoc(roomRef, { votes });

  if (Object.keys(votes).length === roomData.players.length) {
    calculateResults();
  }
}



// ==========================
// CALCULATE RESULTS
// ==========================
async function calculateResults() {
  const votes = roomData.votes || {};

  const count = {};

  Object.values(votes).forEach(v => {
    count[v] = (count[v] || 0) + 1;
  });

  let max = 0;
  let eliminated = null;

  Object.keys(count).forEach(name => {
    if (count[name] > max) {
      max = count[name];
      eliminated = name;
    }
  });

  const roomRef = doc(db, "rooms", roomId);

  await updateDoc(roomRef, {
    phase: "results",
    eliminated
  });

  showResults(eliminated);
}


// ==========================
// SHOW RESULTS
// ==========================
function showResults(eliminated) {
  showScreen("results");

  const content = document.getElementById("resultsContent");

  let text = "";

  if (eliminated === roomData.impostor) {
    text = "🎉 Impostor was caught!";
  } else {
    text = "❌ Wrong vote! Impostor wins!";
  }

  content.innerHTML = `
    <h3>${text}</h3>
    <p>Impostor was: ${roomData.impostor}</p>
    <p>Word was: ${roomData.word}</p>
  `;

  document.getElementById("nextRoundBtn").onclick =
    nextRound;
}


// ==========================
// NEXT ROUND
// ==========================
async function nextRound() {
  const roomRef = doc(db, "rooms", roomId);

  await updateDoc(roomRef, {
    phase: "lobby",
    votes: {},
    impostor: null,
    word: null,
    started: false
  });

  showLobby();
}


// ==========================
// AUTO PHASE LISTENER
// ==========================
function watchPhaseChanges() {
  const roomRef = doc(db, "rooms", roomId);

  onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) return;

    roomData = snap.data();

    if (roomData.phase === "discussion") {
      showDiscussion();
    }

    if (roomData.phase === "voting") {
      showVoting();
    }

    if (roomData.phase === "results") {
      showResults(roomData.eliminated);
    }
  });
}
