
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
    let discussionStarted = false;
    let votingStarted = false;
    let unsubscribeRoom = null;
    let timerInterval = null;
    let timeLeft = 0; //✅ IMPORTANT
    let passShown = false;
    let currentLanguage = "english";

    function clearGameTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    
    // ==========================
    // APP CONFIG CHECK
    // ==========================
    async function isGameEnabled() {
        const configRef = doc(db, "config", "app");
        const snap = await getDoc(configRef);

        if (!snap.exists()) return true; // default = allow

        return snap.data().gameEnabled !== false;
    }

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
        if (crypto?.randomUUID) {
            return crypto.randomUUID().slice(0, 6).toUpperCase();
        }
        return Math.random().toString(36).substring(2, 8).toUpperCase();
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
  try {
    console.log("🔥 Creating room...");

    if (!(await isGameEnabled())) {
      return toast("Server busy");
    }

    const input = document.getElementById("playerName");
    playerName = input.value.trim();

    if (!playerName) {
      console.log("❌ No name entered");
      return toast("Enter name");
    }

    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    isHost = true;

    console.log("Room ID:", roomId);
    console.log("Player:", playerName);

    const roomRef = doc(db, "rooms", roomId);

    await setDoc(roomRef, {
      host: playerName,
      phase: "lobby",
      players: [
        { name: playerName, ready: false, score: 0 }
      ]
    });

    console.log("✅ Firebase write success");
    setupRoomListener();   
    showCreatedRoom();

  } catch (err) {
    console.error("❌ ERROR:", err);
    toast("Something failed");
  }
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
    
    new QRCode(qr, {
        text: link,
        width: 120,   // 🔽 change size here
        height: 120   // 🔽 change size here
    });

    }


    // ==========================
    // JOIN ROOM
    // ==========================
    window.joinRoom = async function () {

    
    // ✅ ADD THIS FIRST
        if (!(await isGameEnabled())) {
            return toast("Game temporarily disabled 🚫");
        }

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
    const exists = data.players.some(
        p => p.name.toLowerCase() === playerName.toLowerCase()
    );


    if (exists) {
        return toast("Name already taken ❌"); // ✅ STOP here
    }

    await updateDoc(roomRef, {
        players: arrayUnion({
            name: playerName,
            ready: false,
            score: 0
        })
    });
    localStorage.setItem("roomId", roomId);
    localStorage.setItem("playerName", playerName);
    setupRoomListener();
    showLobby();
    };


const themeBtn = document.getElementById("themeBtn");
const langBtn = document.getElementById("langBtn");

const languages = ["english", "arabic", "swedish"];



langBtn.onclick = () => {
  const menu = document.getElementById("langMenu");

  if (menu.style.display === "flex") {
    menu.style.display = "none";
  } else {
    menu.style.display = "flex";
  }
};


// load saved theme
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

// toggle
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");

  if (document.body.classList.contains("light")) {
    localStorage.setItem("theme", "light");
    themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    localStorage.setItem("theme", "dark");
    themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
});

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

            
        // ✅ ADD HERE
        if (!(await isGameEnabled())) {
            return toast("Game is temporarily unavailable 🚫");
        }

        playerName = document.getElementById("quickJoinName").value.trim();

        if (!playerName) return toast("Enter name");

        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) return toast("Room not found");

        const data = snap.data();

        const exists = data.players.some(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (exists) {
            return toast("Name already taken ❌");
        }

        await updateDoc(roomRef, {
            players: arrayUnion({
                name: playerName,
                ready: false,
                score: 0
            })
        });

        localStorage.setItem("roomId", roomId);
        localStorage.setItem("playerName", playerName);

        setupRoomListener();
        showLobby();
        };

        return true;
    }

    return false;
    }


function setupRoomListener() {

    // Remove previous listener
    if (unsubscribeRoom) {
        unsubscribeRoom();
    }

    const roomRef = doc(db, "rooms", roomId);


    console.log("=================================");
    unsubscribeRoom = onSnapshot(roomRef, (snap) => {



        if (!snap.exists()) {
            localStorage.removeItem("roomId");
            localStorage.removeItem("playerName");

            toast("Room closed");
            location.reload();
            return;
        }

        const data = snap.data();


        console.log("Snapshot:", data);

        // ✅ SAFETY CHECK
        if (!data || !data.phase || !data.players) return;

        roomData = data;

        // ✅ UPDATE WAITING UI LIVE
        if (roomData.phase === "playing" && !roomData.timeStarted) {

            const ready = roomData.readyForDiscussion || [];
            const total = roomData.players.length;

            const btn = document.getElementById("continueBtn");

           
            if (btn) {

                const hasClicked = (roomData.readyForDiscussion || []).includes(playerName);

                if (hasClicked) {
                    btn.innerText = `Waiting... (${ready.length}/${total})`;

                    btn.classList.remove("btn-success");
                    btn.classList.add("btn-warning");
                }
            }

        }
        
        if (roomData.phase !== "discussion") {
            discussionStarted = false;
        }

        
        if (roomData.phase === "lobby") {
            passShown = false;
            discussionStarted = false;
        }

        
        console.log("🧠 PHASE:", roomData.phase);
        console.log("🧠 timeStarted:", roomData.timeStarted);
        console.log("🧠 readyForDiscussion:", roomData.readyForDiscussion);
        console.log("🧠 passShown:", passShown);
        console.log("🧠 discussionStarted:", discussionStarted);  

        // ✅ AUTO-KICK IF REMOVED
        const stillInRoom = roomData.players.some(p => p.name === playerName);

        if (!stillInRoom) {
            toast("You were removed ❌");

            localStorage.removeItem("roomId");
            localStorage.removeItem("playerName");

            setTimeout(() => location.reload(), 1000);
            return;
        }

        // ✅ HOST CHECK
        const previousHost = isHost;
        isHost = roomData.host === playerName;

        if (previousHost !== isHost) {
            showLobby();
        }

        updateLobbyUI();

                // ✅ PASS SCREEN


                // 🔍 DEBUG PASS CHECK
        console.log("CHECK PASS:", {
            phase: roomData.phase,
            timeStarted: roomData.timeStarted,
            passShown
        });



        // 🔍 DEBUG PASS CHECK
        console.log("CHECK PASS:", {
            phase: roomData.phase,
            timeStarted: roomData.timeStarted,
            passShown
        });

        // ✅ PASS SCREEN (ONLY ONE!)
        if (
            roomData.phase === "playing" &&
            !roomData.timeStarted &&
            !passShown
        ) {
            console.log("📺 SHOW PASS SCREEN ONCE");

            passShown = true;
            showPassScreen();
        }


        console.log("Current player:", playerName);
        console.log("Host:", roomData.host);
        console.log("Ready list:", roomData.readyForDiscussion);
        // ✅ AUTO START DISCUSSION
        // ✅ AUTO START DISCUSSION
        if (roomData.phase === "playing") {

            const ready = roomData.readyForDiscussion || [];
            const totalPlayers = roomData.players.length;

            console.log(
                "READY:",
                ready.length,
                "/",
                totalPlayers,
                ready
            );

            // Host starts discussion when everyone pressed Continue
            if (
                isHost &&
                !roomData.timeStarted &&
                ready.length >= totalPlayers
            ) {
                console.log("🚀 ALL PLAYERS READY");

                startDiscussion();
            }
        }

        // ✅ discussion

        if (roomData.phase === "discussion" && !discussionStarted) {
            discussionStarted = true;
            showDiscussion();
        }



        // ✅ VOTING
        if (
            roomData.phase === "voting" &&
            !screens.voting.classList.contains("active")
        ) {
            showVoting();
        } else if (roomData.phase === "voting") {
            updateVotingUI(); // ✅ NEW FUNCTION
        }

        
        
        if (roomData.phase === "lobby" && roomData.started === false) {
            passShown = false;
            discussionStarted = false;
            showLobby(); ///✅ ADD THIS
            console.log("🔄 CLEAN RESET FOR NEW ROUND");
        }




        // ✅ RESULTS
        if (roomData.phase === "results") {
            showResults();
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

        // ✅ READY COUNT HERE
        const readyCount = roomData.players.filter(p => p.ready).length;

        document.getElementById("playerCount").innerText =
            `${readyCount}/${roomData.players.length} Ready`;

        const list = document.getElementById("playersList");
        list.innerHTML = "";

        roomData.players.forEach(p => {
            
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";

            // LEFT SIDE (✅ + name)
            const left = document.createElement("div");

            left.innerText =
                (p.ready ? "✅ " : "⏳ ") +
                p.name +
                (roomData.host === p.name ? " 👑" : "");

            li.appendChild(left);

            // RIGHT SIDE (❌ button for host)
            if (isHost && p.name !== playerName) {
                const btn = document.createElement("button");
                btn.innerText = "❌";

                btn.onclick = () => removePlayer(p.name);

                li.appendChild(btn);
            }

            list.appendChild(li);

        });

        document.getElementById("hostBadge").style.display =
            isHost ? "block" : "none";

        const me = roomData.players.find(p => p.name === playerName);
        const btn = document.getElementById("readyBtn");

        if (btn) {
            if (me && me.ready) {
                btn.disabled = true;
                btn.innerText = "You are ready ✅";
                btn.classList.remove("btn-success");
                btn.classList.add("btn-warning");
            } else {
                btn.disabled = false;
                btn.innerText = "✅ Ready Up";
                btn.classList.remove("btn-warning");
                btn.classList.add("btn-success");
            }
        }
    }


   // ==========================
    // REMOVE A PLAYER
    // ==========================
    
    async function removePlayer(name) {
        if (!isHost) return;

        const roomRef = doc(db, "rooms", roomId);

        const updatedPlayers = roomData.players.filter(p => p.name !== name);

        await updateDoc(roomRef, {
            players: updatedPlayers
        });

        toast(`${name} removed ❌`);
    }


    // ==========================
    // TOGGLE READY
    // ==========================
    async function toggleReady() {

        if (roomData.phase !== "lobby") return; // ✅ KEY FIX

        const btn = document.getElementById("readyBtn");

        btn.disabled = true;
        btn.innerText = "✅ Ready";

        const roomRef = doc(db, "rooms", roomId);

        const updated = roomData.players.map(p => {
            if (p.name === playerName) {
                return { ...p, ready: true };
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

        const updatedPlayers =
            roomData.players.filter(
                p => p.name !== playerName
            );

        const update = {
            players: updatedPlayers
        };

        if (
            roomData.host === playerName &&
            updatedPlayers.length > 0
        ) {
            update.host = updatedPlayers[0].name;
        }

        await updateDoc(roomRef, update);
        localStorage.removeItem("roomId");
        localStorage.removeItem("playerName");

        location.reload();
    }



    // ==========================
    // START APP
    // ==========================
    async function startApp() {


        const savedLang = localStorage.getItem("language");
        if (savedLang) currentLanguage = savedLang;
        updateLanguageBadge();

        // ✅ CONNECT BUTTONS FIRST (VERY IMPORTANT)
        const createBtn = document.getElementById("createRoomBtn");
        if (createBtn) {
            createBtn.addEventListener("click", () => {
                console.log("Create clicked ✅");
                createRoom();
            });
        }

        const joinBtn = document.getElementById("joinRoomBtn");
        if (joinBtn) {
            joinBtn.addEventListener("click", () => {
                console.log("Join clicked ✅");
                joinRoom();
            });
        }

        // ✅ SHOW START SCREEN IMMEDIATELY
        showScreen("start");

        // ✅ THEN load words (in background)
        loadWords();

        // ✅ check link
        if (quickJoinCheck()) return;
    }

// ✅ IMPORTANT
window.addEventListener("DOMContentLoaded", () => {
    startApp();
});

    // ==========================
    // GAME STATE (PART 2)
    // ==========================
    let words = [];
    let myRole = null;
    let gameWord = null;
    let impostor = null;

    // ==========================
    // LOAD WORDS
    // ==========================
    async function loadWords() {
    try {
        const res = await fetch(`./words_${currentLanguage}.txt`);

        if (!res.ok) {
        throw new Error("File not found");
        }

        const text = await res.text();

        words = text
        .split("\n")
        .map(w => w.trim())
        .filter(Boolean);

        console.log(`✅ Words loaded (${currentLanguage}):`, words.length);

    } catch (err) {
        console.error("❌ Failed to load words:", err);

        words = ["Pizza", "Car", "School"]; // fallback
    }
    }

    console.log("WORDS LOADED");

        


    // ==========================
    // START GAME (HOST ONLY)
    // ==========================
    async function startGame() {

        if (!isHost) return;

        
        if (roomData.phase !== "lobby") {
            return toast("Game already started");
        }


        const readyPlayers =
            roomData.players.filter(p => p.ready);

        if (readyPlayers.length < 3) {
            return toast("Need at least 3 ready players");
        }

        if (!words.length) {
            return toast("No words loaded");
        }
        const randomWord =
            words[Math.floor(Math.random() * words.length)];

        const randomPlayer =
            roomData.players[
                Math.floor(Math.random() * roomData.players.length)
            ];

        const roomRef = doc(db, "rooms", roomId);

        await updateDoc(roomRef, {
            started: true,
            phase: "playing",
            word: randomWord,
            impostor: randomPlayer.name,
            revealedPlayers: [],
            readyForDiscussion: [],
            votes: {},
            voteStarted: null
        });
    }
    // ==========================
    // SHOW PASS SCREEN
    // ==========================

    async function revealMyRole() {
        document.getElementById("revealRoleBtn").disabled = true;
        console.log("Reveal clicked ✅");
        const data = roomData;
        if (!data) return;

        const roomRef = doc(db, "rooms", roomId);

        if (playerName === data.impostor) {
            myRole = "IMPOSTOR";
        } else {
            myRole = "INNOCENT";
            gameWord = data.word;
        }

        
        console.log("👀 Reveal clicked");
        console.log("👀 My role:", myRole);


        showScreen("role");

        
        const readyList = data.readyForDiscussion || [];
        const revealedList = data.revealedPlayers || [];
        const updates = {};

        if (!revealedList.includes(playerName)) {
            updates.revealedPlayers = [...revealedList, playerName];
        }


        if (Object.keys(updates).length > 0) {
            setTimeout(async () => {
                await updateDoc(roomRef, updates);
                console.log("✅ Player ready + revealed (delayed)");
            }, 500); // ✅ 0.5 sec delay
        }


        const el = document.getElementById("roleContent");

        if (myRole === "IMPOSTOR") {
            el.innerHTML = "🕵️ YOU ARE THE IMPOSTOR";
        } else {
            el.innerHTML = "🧠 WORD: " + gameWord;
        }
    }

    // ==========================
    // START DISCUSSION PHASE
    // ==========================


    async function startDiscussion() {
        const roomRef = doc(db, "rooms", roomId);
        console.log("🚀 STARTING DISCUSSION (HOST)");

        try {

            await updateDoc(roomRef, {
                phase: "discussion",
                timeStarted: Date.now(),
                discussionTime: 60 //change time - disc
            });

        } catch (err) {

            console.error(err);
            toast("Connection error");

        }
    }




    // ==========================
    // DISCUSSION SCREEN + TIMER
    // ==========================
    function showDiscussion() {

        discussionStarted = true;
        showScreen("discussion");

        const skipBtn = document.getElementById("skipDiscussionBtn");

        // ✅ SHOW ONLY FOR HOST
        if (isHost) {
            skipBtn.style.display = "block";
        } else {
            skipBtn.style.display = "none";
        }

        // ✅ 👇 ADD IT RIGHT HERE
        skipBtn.onclick = async () => {
            console.log("⏭ HOST SKIPPED DISCUSSION");

            clearGameTimer();

            await startVoting(); // ✅ jump directly to voting
        };

        timeLeft = roomData.discussionTime || 120;
        updateTimer();

        clearGameTimer();

        timerInterval = setInterval(() => {

            const started = roomData?.timeStarted;

            if (!started) return;

            const now = Date.now();
            const elapsed = Math.floor((now - started) / 1000);

            const duration = roomData.discussionTime || 120;

            timeLeft = Math.max(duration - elapsed, 0);

            updateTimer();

            if (timeLeft <= 0) {
                clearGameTimer();

                if (isHost && roomData.phase === "discussion") {
                    startVoting();
                }
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

    discussionStarted = false;
    await updateDoc(roomRef, {
        phase: "voting",
        votes: {},
        voteStarted: Date.now() // ✅ important
    });
    }

    // ==========================
    // SHOW VOTING UI
    // ==========================
    function showVoting() {
        votingStarted = true;

        clearGameTimer();
        showScreen("voting");

        const container = document.getElementById("voteList");
        container.innerHTML = "";

        // ✅ TIMER DISPLAY
        const timerEl = document.createElement("div");
        timerEl.id = "voteTimer";
        timerEl.style.marginBottom = "10px";
        timerEl.style.fontSize = "20px";
        container.appendChild(timerEl);

        // ✅ INFO DISPLAY
        const info = document.createElement("div");
        info.id = "voteInfo"; // ✅ IMPORTANT
        info.style.marginBottom = "10px";
        container.appendChild(info);

        // ✅ PLAYER BUTTONS (ONLY ONCE)
        roomData.players.forEach(p => {
            if (p.name === playerName) return;

            const btn = document.createElement("button");
            btn.className = "vote-btn";
            btn.innerText = p.name;

            btn.onclick = () => votePlayer(p.name);

            container.appendChild(btn);
        });

        startVoteTimer(); // ✅ move timer logic out
    }

    // ==========================
    // update Voting UI
    // ==========================

    function updateVotingUI() {
        const votes = roomData.votes || {};
        const total = roomData.players.length;

        const info = document.getElementById("voteInfo");
        if (info) {
            info.innerText = `Votes: ${Object.keys(votes).length}/${total}`;
        }

        // ✅ update buttons state
        const buttons = document.querySelectorAll(".vote-btn");

        buttons.forEach(btn => {
            const name = btn.innerText;
            const myVote = votes[playerName];

            if (myVote) {
                btn.disabled = true;
                btn.style.opacity = "0.6";
            }

            if (myVote === name) {
                btn.style.background = "#22c55e";
            }
        });
    }



    function startVoteTimer() {
        timerInterval = setInterval(() => {

            const votes = roomData.votes || {};
            const total = roomData.players.length;

            // ✅ instant finish
            if (Object.keys(votes).length === total) {
                clearGameTimer();

                if (isHost && roomData.phase === "voting") {
                    calculateResults();
                }
                return;
            }

            const start = roomData.voteStarted;
            if (!start) return;

            const elapsed = Math.floor((Date.now() - start) / 1000);
            const remaining = 60 - elapsed;

            const el = document.getElementById("voteTimer");
            if (el) el.innerText = `⏳ ${Math.max(remaining, 0)}s`;

            if (remaining <= 0) {
                clearGameTimer();

                if (isHost) {
                    calculateResults();
                }
            }

        }, 1000);
    }
    // ==========================
    // VOTE PLAYER
    // ==========================

    async function votePlayer(target) {

        // ✅ prevent self vote
        if (target === playerName) {
            return toast("You cannot vote for yourself");
        }

        // ✅ prevent double vote
        if (roomData.votes && roomData.votes[playerName]) {
            return toast("You already voted");
        }

        // ✅ UI feedback
        const buttons = document.querySelectorAll(".vote-btn");

        buttons.forEach(btn => {
            if (btn.innerText === target) {
                btn.style.background = "#22c55e";
            }
            btn.disabled = true;
            btn.style.opacity = "0.6";
        });

        const roomRef = doc(db, "rooms", roomId);

        await updateDoc(roomRef, {
            [`votes.${playerName}`]: target
        });

    }

    // ==========================
    // CALCULATE RESULTS
    // ==========================

    async function calculateResults() {
        const roomRef = doc(db, "rooms", roomId);

        await updateDoc(roomRef, {
            phase: "results"
        });

        showResults();
    }


    // ==========================
    // SHOW RESULTS
    // ==========================
  
    function showResults() {
        document.body.classList.remove("win", "lose");
        showScreen("results");

        const votes = roomData.votes || {};
        const content = document.getElementById("resultsContent");

        const impostor = roomData.impostor;

        let winners = [];

        // ✅ find players who guessed impostor
        Object.keys(votes).forEach(player => {
            if (votes[player] === impostor) {
                winners.push(player);
            }
        });

        // ✅ create badges (NEW ✨)
        const winnerHTML = winners.map(name =>
            `<span class="badge">${name}</span>`
        ).join("");
     
        if (winners.length > 0) {

        content.innerHTML = `
            <h2 class="result-title">🎯 Impostor Found!</h2>

            <div class="impostor-box">
            <span>🕵️ Impostor</span>
            <strong>${impostor}</strong>
            </div>

            <div class="winner-box">
            <span>✅ Winners</span>
            <div class="winner-list">
                ${winners.map(name => `<span class="badge">${name}</span>`).join("")}
            </div>
            </div>
        `;

        } else {

        content.innerHTML = `
            <h2 class="result-title">🕵️ Impostor Wins!</h2>

            <div class="impostor-box">
            <span>🕵️ Impostor</span>
            <strong>${impostor}</strong>
            </div>

            <div class="winner-box">
            <span>👑 Winner</span>
            <div class="winner-list">
                <span class="badge impostor">${impostor}</span>
            </div>
            </div>
        `;
        }

        // ✅ ✅ ADD THIS RIGHT HERE
        const btn = document.getElementById("nextRoundBtn");

        btn.onclick = () => {
        console.log("🔄 NEXT ROUND CLICKED");
        btn.disabled = true;
        nextRound();
        };
    }








    // ==========================
    // NEXT ROUND
    // ==========================
async function nextRound() {
    const roomRef = doc(db, "rooms", roomId);

    console.log("🔄 NEXT ROUND CLICKED");

    try {
        await updateDoc(roomRef, {
            phase: "lobby",
            players: roomData.players.map(p => ({
                ...p,
                ready: false // ✅ RESET READY
            })),
            votes: {},
            impostor: null,
            word: null,
            started: false,
            readyForDiscussion: [],
            revealedPlayers: [],
            timeStarted: null,
            voteStarted: null
        });

        // ✅ LOCAL RESET (VERY IMPORTANT)
        passShown = false;
        discussionStarted = false;
        votingStarted = false;

        clearGameTimer();

        console.log("✅ NEXT ROUND RESET DONE");

    } catch (err) {
        console.error("❌ nextRound error:", err);
    }
}

    function showPassScreen() {
        clearGameTimer();
        showScreen("pass");

        const revealBtn = document.getElementById("revealRoleBtn");
        const continueBtn = document.getElementById("continueBtn");

        // ✅ initial state (disabled, yellow)
        revealBtn.disabled = false;
        revealBtn.innerText = "Reveal My Role";

        continueBtn.disabled = true;
        continueBtn.innerText = "Continue";

        continueBtn.classList.remove("btn-success");
        continueBtn.classList.add("btn-warning");

        // ✅ AFTER REVEAL → TURN GREEN
        revealBtn.onclick = () => {
            revealMyRole();

            continueBtn.disabled = false;
            continueBtn.innerText = "Continue";

            // ✅ GREEN
            continueBtn.classList.remove("btn-warning");
            continueBtn.classList.add("btn-success");
        };

        // ✅ AFTER CONTINUE → TURN YELLOW + WAITING
        continueBtn.onclick = async () => {
            console.log("➡️ Continue clicked");

            if (continueBtn.disabled) return;

            try {
                continueBtn.disabled = true;

                // ✅ SWITCH TO YELLOW + WAITING TEXT
                continueBtn.innerText = "Waiting...";
                continueBtn.classList.remove("btn-success");
                continueBtn.classList.add("btn-warning");

                await updateDoc(doc(db, "rooms", roomId), {
                    readyForDiscussion: arrayUnion(playerName)
                });

                console.log("✅ READY SENT:", playerName);

            } catch (err) {
                console.error(err);

                continueBtn.disabled = false;

                // ✅ back to GREEN if failed
                continueBtn.innerText = "Continue";
                continueBtn.classList.remove("btn-warning");
                continueBtn.classList.add("btn-success");

                toast("Failed to continue");
            }
        };
    }

    

window.setLanguage = function (lang) {
  currentLanguage = lang;

  localStorage.setItem("language", lang); // ✅ save

  loadWords();

  document.getElementById("langMenu").style.display = "none";

  updateLanguageBadge();

  toast("Language: " + lang);
};


function updateLanguageBadge() {
  const badge = document.getElementById("langBadge");

  const map = {
    english: "EN",
    arabic: "AR",
    swedish: "SE"
  };

  badge.innerText = map[currentLanguage];

  // ✅ highlight active language
  document.querySelectorAll("#langMenu div").forEach(item => {
    if (item.dataset.lang === currentLanguage) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById("langMenu");
  const btn = document.getElementById("langBtn");

  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = "none";
  }
});
