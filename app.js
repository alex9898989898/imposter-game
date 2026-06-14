
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
    const exists = data.players.some(
        p => p.name.toLowerCase() === playerName.toLowerCase()
    );

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

        setupRoomListener();
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

            // ✅ 1. ALWAYS CLEANUP FIRST (prevents stuck players)
            if (roomData.phase !== "discussion") {
                clearInterval(timerInterval);
                discussionStarted = false;
            }

            // ✅ 2. HANDLE PLAYING
            if (
                roomData.phase === "playing" &&
                !screens.pass.classList.contains("active") &&
                !screens.role.classList.contains("active")
            ) {
                showPassScreen();
            }

            // ✅ 3. HANDLE DISCUSSION
            if (
                roomData.phase === "discussion" &&
                !screens.discussion.classList.contains("active")
            ) {
                showDiscussion();
            }

            // ✅ 4. HANDLE VOTING
            if (
                roomData.phase === "voting" &&
                !screens.voting.classList.contains("active")
            ) {
                showVoting();
            }

            // ✅ 5. HANDLE RESULTS
            if (
                roomData.phase === "results" &&
                !screens.results.classList.contains("active")
            ) {
                showResults(roomData.eliminated);
            }

            // ✅ 6. READY LOGIC
            const readyList = roomData.readyForDiscussion || [];
            const revealed = roomData.revealedPlayers || [];

            // 🔘 Update button if this player already clicked Continue
            if (readyList.includes(playerName)) {
                const btn = document.getElementById("continueBtn");
                if (btn) {
                    btn.disabled = true;
                    btn.innerText = `Waiting (${readyList.length}/${roomData.players.length})`;

                    btn.classList.remove("btn-primary");
                    btn.classList.add("btn-warning");
                }
            }

            // ✅ ONLY start when ALL revealed + ALL ready
            
            if (
                readyList.length === roomData.players.length &&
                roomData.phase === "playing"
            ){
                if (isHost) {
                    startDiscussion();
                }
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

            li.innerText =
                p.name +
                (p.ready ? " ✅" : " ⏳") +
                (roomData.host === p.name ? " 👑" : "");

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
    // TOGGLE READY
    // ==========================
    async function toggleReady() {
        const btn = document.getElementById("readyBtn");

        // ✅ disable instantly
        btn.disabled = true;
        btn.innerText = "✅ Ready";
        btn.classList.remove("btn-success");
        btn.classList.add("btn-warning");

        const roomRef = doc(db, "rooms", roomId);

        const updated = roomData.players.map(p => {
            if (p.name === playerName) {
                return { ...p, ready: true }; // ✅ set ONLY true
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

    await loadWords();

    setTimeout(() => {
        if (!quickJoinCheck()) showScreen("start");
    }, 800);

    // ✅ ADD THIS PART
    document.getElementById("createRoomBtn").onclick = createRoom;
    document.getElementById("joinRoomBtn").onclick = joinRoom;
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
        phase: "playing",
        started: true,
        word,
        impostor: impostorPlayer,

        // ✅ reset
        readyForDiscussion: [],
        revealedPlayers: [] // ✅ ADD THIS
        });


    }

    
    function showPassScreen() {
        showScreen("pass");

        document.getElementById("revealRoleBtn").onclick = revealMyRole;
    }


    // ==========================
    // SHOW PASS SCREEN
    // ==========================

    async function revealMyRole() {
        const data = roomData;
        if (!data) return;

        const roomRef = doc(db, "rooms", roomId);

        if (playerName === data.impostor) {
            myRole = "IMPOSTOR";
        } else {
            myRole = "INNOCENT";
            gameWord = data.word;
        }

        showScreen("role");

        // ✅ mark player as revealed
        const revealedList = data.revealedPlayers || [];
        if (!revealedList.includes(playerName)) {
            await updateDoc(roomRef, {
                revealedPlayers: [...revealedList, playerName]
            });
        }

        const el = document.getElementById("roleContent");

        if (myRole === "IMPOSTOR") {
            el.innerHTML = "🕵️ YOU ARE THE IMPOSTOR";
        } else {
            el.innerHTML = "🧠 WORD: " + gameWord;
        }

        document.getElementById("continueBtn").onclick = async () => {

            const btn = document.getElementById("continueBtn");

            // ✅ UI update
            btn.disabled = true;
            btn.innerText = `Waiting (1/${roomData.players.length})`;
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-warning");

            const snap = await getDoc(roomRef);
            const updated = snap.data();

            let ready = updated.readyForDiscussion || [];
            let revealed = updated.revealedPlayers || [];

            // ✅ add to ready list
            if (!ready.includes(playerName)) {
                ready.push(playerName);

                await updateDoc(roomRef, {
                    readyForDiscussion: ready
                });
            }

            // ✅ check start condition (FINAL)
            if (
                isHost &&
                ready.length === updated.players.length &&
                updated.phase === "playing"
            ) {
                startDiscussion();
            }
        };
    }

    // ==========================
    // START DISCUSSION PHASE
    // ==========================


    async function startDiscussion() {
        const roomRef = doc(db, "rooms", roomId);

        await updateDoc(roomRef, {
            phase: "discussion",
            timeStarted: Date.now(),
            discussionTime: 60 // ✅ set time here
        });
    }




    // ==========================
    // DISCUSSION SCREEN + TIMER
    // ==========================
    function showDiscussion() {

        // ✅ PREVENT DOUBLE START
        if (discussionStarted) return;
        discussionStarted = true;

        showScreen("discussion");

        clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const started = roomData.timeStarted;

            if (!started) return;

            const now = Date.now();
            const elapsed = Math.floor((now - started) / 1000);

            const duration = roomData.discussionTime || 120;
            const remaining = duration - elapsed;

            timeLeft = remaining > 0 ? remaining : 0;

            updateTimer();


            if (timeLeft <= 0) {
                clearInterval(timerInterval);

                // ✅ extra safety check
                if (
                    isHost &&
                    roomData.phase === "discussion"
                ) {
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
    
        
    if (votingStarted) return;
    votingStarted = true;

    clearInterval(timerInterval); // ✅ VERY IMPORTANT

    showScreen("voting");

    const container = document.getElementById("voteList");
    container.innerHTML = "";

    // ✅ TIMER
    const timerEl = document.createElement("div");
    timerEl.id = "voteTimer";
    timerEl.style.marginBottom = "10px";
    timerEl.style.fontSize = "20px";
    container.appendChild(timerEl);

    // ✅ ADD THIS HERE (RIGHT UNDER TIMER)
    const votes = roomData.votes || {};

    const info = document.createElement("div");
    info.style.marginBottom = "10px";

    const votedCount = Object.keys(votes).length;
    const total = roomData.players.length;

    info.innerText = `Votes: ${votedCount}/${total}`;
    container.appendChild(info);

    // ✅ PLAYERS BUTTONS
    roomData.players.forEach(p => {

        // ✅ SKIP yourself completely
        if (p.name === playerName) return;

        const btn = document.createElement("button");
        btn.className = "vote-btn";
        btn.innerText = p.name;

        const alreadyVoted = votes[playerName];

        if (alreadyVoted === p.name) {
            btn.style.background = "#22c55e";
        }

        if (alreadyVoted) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
        } else {
            btn.onclick = () => votePlayer(p.name);
        }

        container.appendChild(btn);
    });


    // ✅ Timer logic
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const start = roomData.voteStarted;
        const now = Date.now();

        const elapsed = Math.floor((now - start) / 1000);
        const remaining = 10 - elapsed;

        document.getElementById("voteTimer").innerText =
        `⏳ ${remaining > 0 ? remaining : 0}s`;

        if (remaining <= 0) {
        clearInterval(timerInterval);

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

        // ✅ BUILD UPDATED VOTES (single source of truth)
        const updatedVotes = { ...(roomData.votes || {}) };
        updatedVotes[playerName] = target;

        // ✅ SINGLE UPDATE
        await updateDoc(roomRef, { votes: updatedVotes });

        // ✅ CHECK AFTER UPDATE
        const votedCount = Object.keys(updatedVotes).length;
        const totalPlayers = roomData.players.length;

        if (votedCount === totalPlayers) {
            calculateResults();
        }
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

        // ✅ CASE 1: players guessed correctly
        if (winners.length > 0) {

            content.innerHTML = `
                <h2 class="result-title">🎯 Impostor Found!</h2>

                <div class="result-row">
                    <span>🕵️ Impostor</span>
                    <strong>${impostor}</strong>
                </div>

                <div class="result-row winner">
                    <span>✅ Winners</span>
                    <div>${winnerHTML}</div>
                </div>
            `;

        } else {
            // ✅ CASE 2: nobody guessed → impostor wins

            content.innerHTML = `
                <h2 class="result-title">🕵️ Nobody Found the Impostor</h2>

                <div class="result-row">
                    <span>🕵️ Impostor</span>
                    <strong>${impostor}</strong>
                </div>

                <div class="result-row loser">
                    <span>👑 Winner</span>
                    <div><span class="badge impostor">${impostor}</span></div>
                </div>
            `;
        }

        document.getElementById("nextRoundBtn").onclick = nextRound;
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
