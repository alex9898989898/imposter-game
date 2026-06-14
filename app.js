
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

    function clearGameTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
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

        playerName = document.getElementById("playerName").value.trim();

        if (!playerName) return toast("Enter name");

        roomId = generateRoomId();
        isHost = true;

        // Save room info locally
        localStorage.setItem("roomId", roomId);
        localStorage.setItem("playerName", playerName);

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
        if (
            roomData.phase === "playing" &&
            !roomData.timeStarted &&
            !screens.pass.classList.contains("active") &&
            !screens.role.classList.contains("active")
        ) {
            showPassScreen();
        }

        // ✅ AUTO START DISCUSSION
        if (roomData.phase === "playing") {
            const ready = roomData.readyForDiscussion || [];

            
        if (
            ready.length === roomData.players.length &&
            isHost &&
            !roomData.timeStarted   // ✅ ONLY RUN ONCE
        ) {
            startDiscussion();
        }

        }


        // ✅ discussion
        if (
            roomData.phase === "discussion" &&
            !timerInterval   // ✅ KEY FIX
        ) {
            showDiscussion();
        }



        // ✅ VOTING
        if (roomData.phase === "voting") {
            showVoting();
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

            const text = document.createElement("span");
            text.innerText =
                p.name +
                (p.ready ? " ✅" : " ⏳") +
                (roomData.host === p.name ? " 👑" : "");

            li.appendChild(text);

            // ✅ SHOW REMOVE BUTTON ONLY FOR HOST and NOT yourself
            if (isHost && p.name !== playerName) {
                const btn = document.createElement("button");
                btn.innerText = "❌";
                btn.style.marginLeft = "10px";

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
    console.log("APP STARTING...");
    async function startApp() {

        await loadWords();

        // ✅ CONNECT BUTTONS HERE
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

        const savedRoom = localStorage.getItem("roomId");
        const savedPlayer = localStorage.getItem("playerName");

        
        // ✅ check link first
        if (quickJoinCheck()) {
            return; // stop here if link join
        }

        showScreen("start");

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

        
    function showPassScreen() {
            showScreen("pass");

            document.getElementById("revealRoleBtn").onclick = revealMyRole;
    }

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

            // UI update
            btn.disabled = true;
            
            const total = roomData.players.length;
            const ready = roomData.readyForDiscussion?.length || 0;

            btn.innerText = `Waiting... (${ready}/${total})`;

            btn.classList.remove("btn-primary");
            btn.classList.add("btn-warning");

            
            const interval = setInterval(() => {
                const total = roomData.players.length;
                const ready = roomData.readyForDiscussion?.length || 0;

                btn.innerText = `Waiting... (${ready}/${total})`;

                if (ready === total) {
                    clearInterval(interval);
                }
            }, 500);


            const roomRef = doc(db, "rooms", roomId);

            // mark player ready (SAFE atomic update)asdas
            await updateDoc(roomRef, {
                readyForDiscussion: arrayUnion(playerName)
            });

            // get fresh snapshot AFTER update
            const snap = await getDoc(roomRef);
            const updated = snap.data();


        };
    }

    // ==========================
    // START DISCUSSION PHASE
    // ==========================


    async function startDiscussion() {
        const roomRef = doc(db, "rooms", roomId);

        try {

            await updateDoc(roomRef, {
                phase: "discussion",
                timeStarted: Date.now(),
                discussionTime: 5 //change time - disc
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
        
        timeLeft = roomData.discussionTime || 120;
        updateTimer();


        clearGameTimer();

        timerInterval = setInterval(() => {


            
            const started = roomData?.timeStarted;

            if (!started) {
                console.log("❌ timeStarted missing");
                return;
            }


            console.log("timeStarted:", started);

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

    
    
    const votesNow = roomData.votes || {};
    const votedCountNow = Object.keys(votesNow).length;

    info.innerText = `Votes: ${votedCountNow}/${total}`;


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
    timerInterval = setInterval(() => {
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

        const resetPlayers =
            roomData.players.map(p => ({
                ...p,
                ready: false
            }));

        await updateDoc(roomRef,{
            phase: "lobby",
            players: resetPlayers,
            votes: {},
            impostor: null,
            word: null,
            started: false,
            readyForDiscussion: [],
            revealedPlayers: [],
            timeStarted: null,
            voteStarted: null
        });

        // ✅ RESET LOCAL STATE
        discussionStarted = false;
        votingStarted = false;

        document.body.classList.remove("win", "lose");

        showLobby();
    }
