
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
    let resultsShown = false;
    let qrScanner = null;
    let roomData = null;
    let isHost = false;
    let discussionStarted = false;
    let votingStarted = false;
    let unsubscribeRoom = null;
    let timerInterval = null;
    let timeLeft = 0; //✅ IMPORTANT
    let passShown = false;
    let currentLanguage = "english";
    let resultsTriggered = false;
    let nextRoundStarted = false;
    let lastPhase = null;
    let justCreatedRoom = false;
    let startMode = "create";
    let lastCleanup = 0;
    let presenceInterval = null;
    let playerSessionId =
        sessionStorage.getItem("playerSessionId") ||
        (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    sessionStorage.setItem("playerSessionId", playerSessionId);
    let cleanupRunning = false;
    let continueCountdownInterval = null;
    let continueAutoTimeout = null;

    function clearContinueCountdown() {
        if (continueCountdownInterval) {
            clearInterval(continueCountdownInterval);
            continueCountdownInterval = null;
        }
        if (continueAutoTimeout) {
            clearTimeout(continueAutoTimeout);
            continueAutoTimeout = null;
        }
    }


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


    function launchConfetti() {
    for (let i = 0; i < 30; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";

        piece.style.left = Math.random() * 100 + "vw";
        piece.style.animationDuration = (2 + Math.random() * 2) + "s";
        piece.style.background =
            ["#22c55e", "#3b82f6", "#facc15", "#ef4444", "#a855f7"][
                Math.floor(Math.random() * 5)
            ];

        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 4000);
    }
}


function showScreen(name) {
    Object.values(screens).forEach(s => {
        s.classList.remove("active");
        s.style.pointerEvents = "none";
    });

    const active = screens[name];
    active.classList.add("active");
    active.style.pointerEvents = "auto";

    const footer = document.querySelector(".site-footer");
    if (footer) {
        footer.style.display = name === "start" ? "block" : "none";
    }
}

    // ==========================
    // TOAST
    // ==========================

    function toast(msg) {
        const el = document.getElementById("toast");
        el.innerText = msg;
        el.classList.add("show");

        setTimeout(() => {
            el.classList.remove("show");
            el.style.display = "none";
        }, 2000);

        el.style.display = "block";
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



    function stopPresenceHeartbeat() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
    }
}


async function touchPresence() {
    if (!roomId || !playerName) return;

    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) return;

    const data = snap.data();
    const players = data.players || [];

    const found = players.some(p => p.sessionId === playerSessionId);
    if (!found) return;

    const updatedPlayers = players.map(p => {
        if (p.sessionId === playerSessionId) {
            return {
                ...p,
                lastSeen: Date.now()
            };
        }
        return p;
    });

    await updateDoc(roomRef, {
        players: updatedPlayers
    });
}


function startPresenceHeartbeat() {
    stopPresenceHeartbeat();

    // touch immediately once
    touchPresence().catch(err => console.error("❌ touchPresence error:", err));

    // then keep updating
    presenceInterval = setInterval(() => {
        touchPresence().catch(err => console.error("❌ heartbeat error:", err));
    }, 8000);
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
    justCreatedRoom = true;

    console.log("Room ID:", roomId);
    console.log("Player:", playerName);

    const roomRef = doc(db, "rooms", roomId);

    await setDoc(roomRef, {
    host: playerName,
    phase: "lobby",
    started: false,
    language: currentLanguage,
    discussionTime: 60,
    impostorCount: 1,
    impostors: [],
    nextRoundReady: [],
    readyForDiscussion: [],
    revealedPlayers: [],
    votes: {},
    voteStarted: null,
    timeStarted: null,
    players: [
        {
        name: playerName,
        ready: false,
        score: 0,
        sessionId: playerSessionId,
        lastSeen: Date.now()
        }
    ]
    });

    // ✅ SAVE SESSION AFTER FIREBASE SUCCESS

    sessionStorage.setItem("roomId", roomId);
    sessionStorage.setItem("playerName", playerName);


    console.log("✅ Firebase write success");
    setupRoomListener();
    showCreatedRoom();
    startPresenceHeartbeat();

  } catch (err) {
    console.error("❌ ERROR:", err);
    toast("Something failed");
  }
};







function updateHostLobbyButton() {
    const btn = document.getElementById("hostLobbyBtn");
    if (!btn) return;

    const gamePhases = ["lobby", "playing", "discussion", "voting", "results"];
    const shouldShow =
        isHost &&
        !!roomId &&
        !!roomData &&
        gamePhases.includes(roomData.phase);

    btn.style.display = shouldShow ? "inline-flex" : "none";
}



    // ==========================
    // SHOW CREATED ROOM SCREEN
    // ==========================
function showCreatedRoom() {
    showScreen("created");

    const link = `${window.location.origin}?room=${roomId}`;

    document.getElementById("shareLinkInput").value = link;

    const qrWrap = document.getElementById("qrWrap");
    const qr = document.getElementById("qrCode");
    qr.innerHTML = "";
    qrWrap.style.display = "none";

    // generate QR once
    
    
new QRCode(qr, {
  text: link,
  width: 160,
  height: 160
});



    // Copy Link
    document.getElementById("copyLinkBtn").onclick = async () => {
        await navigator.clipboard.writeText(link);
        toast("Copied!");
    };

    // Invite (share if available, else copy)
    document.getElementById("inviteBtn").onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Join my Imposter room",
                    text: `Join my room: ${roomId}`,
                    url: link
                });
            } catch (err) {
                console.log("Invite cancelled");
            }
        } else {
            await navigator.clipboard.writeText(link);
            toast("Invite link copied!");
        }
    };

    // Share
    document.getElementById("shareBtn").onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Join my Imposter room",
                    url: link
                });
            } catch (err) {
                console.log("Share cancelled");
            }
        } else {
            await navigator.clipboard.writeText(link);
            toast("Sharing not supported — link copied!");
        }
    };

    // QR toggle
    document.getElementById("qrToggleBtn").onclick = () => {
        qrWrap.style.display = qrWrap.style.display === "none" ? "block" : "none";
    };

    // Go to lobby
    document.getElementById("goLobbyBtn").onclick = () => {
        justCreatedRoom = false;
        showLobby();
    };
}

    // ==========================
    // JOIN ROOM
    // ==========================
    window.joinRoom = async function () {
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

        // ✅ load room language
        if (data.language) {
            currentLanguage = data.language;
            localStorage.setItem("language", currentLanguage);
            await loadWords();
            updateLanguageBadge();
        }

        // ✅ duplicate name protection
        const exists = data.players.some(
            p => p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (exists) {
            return toast("Name already taken ❌");
        }

        // ✅ if game already started -> join as spectator
        if (data.phase !== "lobby") {
            toast("Game already started — joining as spectator");

            await updateDoc(roomRef, {
                players: arrayUnion({
                    name: playerName,
                    ready: false,
                    score: 0,
                    sessionId: playerSessionId,
                    lastSeen: Date.now(),
                    spectator: true
                })
            });

            sessionStorage.setItem("roomId", roomId);
            sessionStorage.setItem("playerName", playerName);

            setupRoomListener();
            showLobby(); // later you can replace with custom spectator screen
            startPresenceHeartbeat();
            return;
        }

        // ✅ normal join in lobby only
        await updateDoc(roomRef, {
            players: arrayUnion({
                name: playerName,
                ready: false,
                score: 0,
                sessionId: playerSessionId,
                lastSeen: Date.now(),
                spectator: false
            })
        });

        sessionStorage.setItem("roomId", roomId);
        sessionStorage.setItem("playerName", playerName);

        setupRoomListener();
        showLobby();
        startPresenceHeartbeat();
    };






    // ==========================
    // UPDATE LANGUAGE
    // ==========================
const themeBtn = document.getElementById("themeBtn");
const langBtn = document.getElementById("langBtn");

function updateLanguageControl() {
  if (isHost) {
    langBtn.disabled = false;
    langBtn.style.opacity = "1";
    langBtn.style.cursor = "pointer";
  } else {
    langBtn.disabled = true;
    langBtn.style.opacity = "0.3";  
    langBtn.style.cursor = "not-allowed";
  }
}


const languages = ["english", "arabic", "swedish"];




langBtn.onclick = () => {
  if (!isHost) {
    return toast("Only host can change language ❌");
  }

  const menu = document.getElementById("langMenu");

  menu.style.display =
    menu.style.display === "flex" ? "none" : "flex";
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

// ✅ if game already started -> spectator
if (data.phase !== "lobby") {
    toast("Game already started — joining as spectator");

    await updateDoc(roomRef, {
        players: arrayUnion({
            name: playerName,
            ready: false,
            score: 0,
            sessionId: playerSessionId,
            lastSeen: Date.now(),
            spectator: true
        })
    });

        sessionStorage.setItem("roomId", roomId);
        sessionStorage.setItem("playerName", playerName);

        setupRoomListener();
        showLobby();
        startPresenceHeartbeat();
        return;
    }

    // ✅ normal join
    await updateDoc(roomRef, {
        players: arrayUnion({
            name: playerName,
            ready: false,
            score: 0,
            sessionId: playerSessionId,
            lastSeen: Date.now(),
            spectator: false
        })
    });

    sessionStorage.setItem("roomId", roomId);
    sessionStorage.setItem("playerName", playerName);

    setupRoomListener();
    showLobby();
startPresenceHeartbeat();

        };

        return true;
    }

    return false;
    }


async function cleanupStalePlayers() {
    if (!isHost || !roomData || cleanupRunning) return;

    // ✅ never auto-kick in active gameplay
    if (!["lobby", "results"].includes(roomData.phase)) return;

    const now = Date.now();
    if (now - lastCleanup < 20000) return;
    lastCleanup = now;

    cleanupRunning = true;

    try {
        const timeoutMs = 240000; // 4 minutes

        const players = roomData.players || [];

        const alivePlayers = players.filter(p => {
            if (!p.lastSeen) return true;
            if (p.sessionId === playerSessionId) return true;
            return now - p.lastSeen < timeoutMs;
        });

        if (alivePlayers.length === players.length) return;

        const validNames = alivePlayers.map(p => p.name);

        const cleanedVotes = {};
        Object.entries(roomData.votes || {}).forEach(([voter, target]) => {
            if (validNames.includes(voter) && validNames.includes(target)) {
                cleanedVotes[voter] = target;
            }
        });

        const update = {
            players: alivePlayers,
            votes: cleanedVotes,
            readyForDiscussion: (roomData.readyForDiscussion || []).filter(name => validNames.includes(name)),
            revealedPlayers: (roomData.revealedPlayers || []).filter(name => validNames.includes(name)),
            nextRoundReady: (roomData.nextRoundReady || []).filter(name => validNames.includes(name))
        };

        if (!alivePlayers.some(p => p.name === roomData.host) && alivePlayers.length > 0) {
            update.host = alivePlayers[0].name;
        }

        await updateDoc(doc(db, "rooms", roomId), update);

    } catch (err) {
        console.error("❌ cleanup error:", err);
    } finally {
        cleanupRunning = false;
    }
}


function setupRoomListener() {

    // Remove previous listener
    if (unsubscribeRoom) {
        unsubscribeRoom();
    }
    const roomRef = doc(db, "rooms", roomId);
    console.log("=================================");
    unsubscribeRoom = onSnapshot(roomRef, async (snap) => {

        if (!snap.exists()) {
            sessionStorage.removeItem("roomId");
            sessionStorage.removeItem("playerName");
            stopPresenceHeartbeat();

            toast("Room closed");
            location.reload();
            return;
        }
        const data = snap.data();
        console.log("Snapshot:", data);
        // ✅ SAFETY CHECK
        if (!data || !data.phase || !data.players) return;

        roomData = data;
// ✅ FORCE MIN 3 PLAYERS DURING GAME
const activePlayersCount = roomData.players.filter(p => !p.spectator).length;

if (activePlayersCount < 3 && roomData.phase !== "lobby") {
    const amHost = roomData.host === playerName;

    if (amHost) {
        await updateDoc(doc(db, "rooms", roomId), {
            phase: "lobby",
            started: false,
            nextRoundReady: [],
            readyForDiscussion: [],
            revealedPlayers: [],
            votes: {},
            voteStarted: null,
            timeStarted: null,
            players: roomData.players.map(p => ({
                ...p,
                ready: false,
                spectator: false
}))

        });
    }

    toast("Not enough active players");
    return;
}
        const previousPhase = lastPhase;
        lastPhase = roomData.phase;
        // ✅ reset local state when going directly from results -> playing
if (previousPhase === "results" && roomData.phase === "playing") {
    console.log("🔄 RESET AFTER RESULTS -> PLAYING");

    passShown = false;
    discussionStarted = false;
    votingStarted = false;
    resultsShown = false;
    resultsTriggered = false;
    nextRoundStarted = false;

    timeLeft = 0;
    clearGameTimer();

    document.body.classList.remove("win", "lose");
}

        let loadingLanguage = false;

        if (
            roomData.language &&
            roomData.language !== currentLanguage &&
            !loadingLanguage
        ) {
            loadingLanguage = true;
            currentLanguage = roomData.language;

            loadWords().then(() => {
                loadingLanguage = false;
            });

            updateLanguageBadge();
        }
        // ✅ UPDATE WAITING UI LIVE
        if (roomData.phase === "playing" && roomData.timeStarted === null) {

            const ready = roomData.readyForDiscussion || [];
            const total = roomData.players.filter(p => !p.spectator).length;

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

            if (justCreatedRoom && screens.created.classList.contains("active")) {
                console.log("🛑 Keeping created room screen visible");
            } else if (previousPhase && previousPhase !== "lobby") {
                console.log("🔄 FULL RESET (LOBBY)");

                votingStarted = false;
                resultsShown = false;
                resultsTriggered = false;
                nextRoundStarted = false;

                clearGameTimer();
                timeLeft = 0;

                if (!screens.lobby.classList.contains("active")) {
                    showLobby();
                }
            } else {
                console.log("📍 Already in lobby state");
            }
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

            sessionStorage.removeItem("roomId");
            sessionStorage.removeItem("playerName");
            stopPresenceHeartbeat();

            setTimeout(() => location.reload(), 1000);
            return;
        }
        
        const me = roomData.players.find(p => p.name === playerName);
        const amSpectator = !!me?.spectator;


        // ✅ HOST CHECK
        const previousHost = isHost;
        isHost = roomData.host === playerName;
        if (!isHost) {
        document.getElementById("langMenu").style.display = "none";
        }
        updateHostLobbyButton();
        
        if (previousHost !== isHost && roomData.phase === "lobby") {
            showLobby();
        }
        

        updateLanguageControl();
        updateLobbyUI();


       
        if (isHost && roomData.phase === "lobby") {
            cleanupStalePlayers();
        }



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
            roomData.timeStarted === null &&
            !passShown &&
            !resultsShown &&
            !amSpectator
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
        if (roomData.phase === "playing" && roomData.started === true) {
            const ready = roomData.readyForDiscussion || [];
            const totalPlayers = roomData.players.filter(p => !p.spectator).length;

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
            roomData.phase === "playing" &&
            roomData.timeStarted === null &&
            ready.length === totalPlayers &&
            totalPlayers > 0
            ) {
            console.log("🚀 START DISCUSSION (SAFE)");
            startDiscussion();
            }
        }
        // ✅ discussion

        if (roomData.phase === "discussion" && roomData.timeStarted) {
            if (!screens.discussion.classList.contains("active")) {
                showDiscussion();
            }
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

        // ✅ RESULTS
        if (roomData.phase === "results") {
            if (!resultsShown) {
                resultsShown = true;
                showResults();
            }
        }
    
    
        // ✅ NEXT ROUND SYNC SYSTEM
if (roomData.phase === "results") {
    const ready = roomData.nextRoundReady || [];
    const total = roomData.players.length;

    const btn = document.getElementById("nextRoundBtn");
    if (btn) {
        btn.innerText = `Next Round (${ready.length}/${total})`;

        if (ready.includes(playerName)) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
        } else {
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }

    console.log("NEXT ROUND READY:", ready.length, "/", total);

    // ✅ if too few players remain, stop and go back to lobby
    if (total < 3 && isHost && !nextRoundStarted) {
        nextRoundStarted = true;

        await updateDoc(doc(db, "rooms", roomId), {
            phase: "lobby",
            started: false,
            nextRoundReady: [],
            readyForDiscussion: [],
            revealedPlayers: [],
            votes: {},
            voteStarted: null,
            timeStarted: null,

            players: roomData.players.map(p => ({
                ...p,
                ready: false,
                spectator: false
            }))

        });

        toast("Need at least 3 players for next round");
        return;
    }

    // ✅ start next round immediately when all remaining players are ready
    if (
        isHost &&
        ready.length === total &&
        total >= 3 &&
        !nextRoundStarted
    ) {
        nextRoundStarted = true;

        console.log("🚀 STARTING NEXT ROUND IMMEDIATELY");

        nextRound();
    }
}



    });
}


async function updateDiscussionTime(value) {
    if (!isHost) return;
    if (roomData.phase !== "lobby") return;

    const roomRef = doc(db, "rooms", roomId);

    await updateDoc(roomRef, {
        discussionTime: Number(value)
    });
}



function updateDiscussionTimeButtons() {
    const timeButtons = document.querySelectorAll(".time-btn");
    const current = Number(roomData?.discussionTime || 60);

    timeButtons.forEach(btn => {
        const value = Number(btn.dataset.time);
        if (value === current) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    const discussionTimeInput = document.getElementById("discussionTimeInput");
    if (discussionTimeInput) {
        discussionTimeInput.value = current;
    }
}
    // ==========================
    // SHOW LOBBY
    // ==========================



function showLobby() {
    justCreatedRoom = false;
    showScreen("lobby");

    const startBtn = document.getElementById("startGameBtn");
    const readyBtn = document.getElementById("readyBtn");
    const leaveBtn = document.getElementById("leaveBtn");

    const discussionTimeWrap = document.getElementById("discussionTimeWrap");
    const hostControls = document.getElementById("hostControls");

    const timeButtons = document.querySelectorAll(".time-btn");
    const discussionTimeInput = document.getElementById("discussionTimeInput");
    const applyDiscussionTimeBtn = document.getElementById("applyDiscussionTimeBtn");

    const impostorCountWrap = document.getElementById("impostorCountWrap");

    if (isHost) {
        startBtn.style.display = "block";
        if (discussionTimeWrap) discussionTimeWrap.style.display = "block";
        if (hostControls) hostControls.style.display = "flex";
        if (impostorCountWrap) impostorCountWrap.style.display = "block";

        timeButtons.forEach(btn => {
            btn.disabled = false;
            btn.onclick = () => {
                const value = Number(btn.dataset.time);
                updateDiscussionTime(value);
            };
        });

        if (applyDiscussionTimeBtn && discussionTimeInput) {
            applyDiscussionTimeBtn.onclick = () => {
                const value = Number(discussionTimeInput.value);
                if (!value || value < 10 || value > 900) {
                    return toast("Set 10–900 seconds");
                }
                updateDiscussionTime(value);
            };
        }
    } else {
        startBtn.style.display = "none";
        if (discussionTimeWrap) discussionTimeWrap.style.display = "none";
        if (hostControls) hostControls.style.display = "none";
        if (impostorCountWrap) impostorCountWrap.style.display = "none";
    }

    startBtn.onclick = startGame;
    readyBtn.onclick = toggleReady;
    leaveBtn.onclick = leaveRoom;

    updateDiscussionTimeButtons();
    updateImpostorCountUI();
}







    // ==========================
    // UPDATE LOBBY UI
    // ==========================
   
function updateLobbyUI() {
    if (!roomData) return;

    document.getElementById("roomTitle").innerText =
        `${roomId} (${currentLanguage.toUpperCase()})`;

    updateDiscussionTimeButtons();

    const activePlayers = roomData.players.filter(p => !p.spectator);
    const readyCount = activePlayers.filter(p => p.ready).length;

    document.getElementById("playerCount").innerText =
        `${readyCount}/${activePlayers.length} Ready`;

    const list = document.getElementById("playersList");
    list.innerHTML = "";

    roomData.players.forEach(p => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.alignItems = "center";
        li.style.justifyContent = "space-between";

        const left = document.createElement("div");

        const icon = p.spectator ? "👀 " : (p.ready ? "✅ " : "⏳ ");
        const spectatorTag = p.spectator ? " (spectator)" : "";
        const crown = roomData.host === p.name ? " 👑" : "";

        left.innerText = icon + p.name + spectatorTag + crown;
        li.appendChild(left);

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

    const updatedPlayers = roomData.players.filter(p => p.name !== name);
    const validNames = updatedPlayers.map(p => p.name);

    const cleanedVotes = {};
    Object.entries(roomData.votes || {}).forEach(([voter, target]) => {
        if (validNames.includes(voter) && validNames.includes(target)) {
            cleanedVotes[voter] = target;
        }
    });

    const update = {
        players: updatedPlayers,
        votes: cleanedVotes,
        nextRoundReady: (roomData.nextRoundReady || []).filter(n => validNames.includes(n)),
        readyForDiscussion: (roomData.readyForDiscussion || []).filter(n => validNames.includes(n)),
        revealedPlayers: (roomData.revealedPlayers || []).filter(n => validNames.includes(n))
    };

    // if host removes the current host somehow, transfer host
    if (roomData.host === name && updatedPlayers.length > 0) {
        update.host = updatedPlayers[0].name;
    }

    await updateDoc(doc(db, "rooms", roomId), update);
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

        // ✅ remove this player
        const updatedPlayers = roomData.players.filter(
            p => p.name !== playerName
        );

        // ✅ build valid players list
        const validNames = updatedPlayers.map(p => p.name);

        // ✅ clean ALL invalid votes
        const cleanedVotes = {};

        Object.entries(roomData.votes || {}).forEach(([voter, target]) => {
            if (validNames.includes(voter) && validNames.includes(target)) {
                cleanedVotes[voter] = target;
            }
        });

        const update = {
            players: updatedPlayers,
            votes: cleanedVotes, // ✅ IMPORTANT FIX

            nextRoundReady: (roomData.nextRoundReady || []).filter(n => n !== playerName),
            readyForDiscussion: (roomData.readyForDiscussion || []).filter(n => n !== playerName),
            revealedPlayers: (roomData.revealedPlayers || []).filter(n => n !== playerName)
        };

        // ✅ fix host transfer
        if (roomData.host === playerName && updatedPlayers.length > 0) {
            update.host = updatedPlayers[0].name;
        }

        await updateDoc(roomRef, update);

        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("playerName");
        stopPresenceHeartbeat();

        location.reload();
    }


    // ==========================
    // SET START MODE 
    // ==========================
    function setStartMode(mode) {
        startMode = mode;

        const createBtn = document.getElementById("createRoomBtn");
        const joinBtn = document.getElementById("joinRoomBtn");
        const roomCodeWrap = document.getElementById("roomCodeWrap");
        const modeCreateBtn = document.getElementById("modeCreateBtn");
        const modeJoinBtn = document.getElementById("modeJoinBtn");

        if (mode === "create") {
            createBtn.style.display = "block";
            joinBtn.style.display = "none";
            roomCodeWrap.style.display = "none";

            modeCreateBtn.classList.add("active");
            modeJoinBtn.classList.remove("active");
        } else {
            createBtn.style.display = "none";
            joinBtn.style.display = "block";
            roomCodeWrap.style.display = "block";

            modeCreateBtn.classList.remove("active");
            modeJoinBtn.classList.add("active");
        }
    }




    async function tryRestoreSession() {
   
    const savedRoomId = sessionStorage.getItem("roomId");
    const savedPlayerName = sessionStorage.getItem("playerName");


    if (!savedRoomId || !savedPlayerName) return false;

    try {
        const roomRef = doc(db, "rooms", savedRoomId);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
            
        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("playerName");

            return false;
        }

        const data = snap.data();
        
        const me = data.players.find(p => p.name === savedPlayerName);
        const amSpectator = !!me?.spectator;


        const stillExists = data.players.some(
            p => p.name.toLowerCase() === savedPlayerName.toLowerCase()
        );

        if (!stillExists) {
           
            sessionStorage.removeItem("roomId");
            sessionStorage.removeItem("playerName");

            return false;
        }

        // ✅ restore player session
        roomId = savedRoomId;
        playerName = savedPlayerName;
        isHost = data.host === playerName;

        if (data.language) {
            currentLanguage = data.language;
            localStorage.setItem("language", currentLanguage);
            await loadWords();
            updateLanguageBadge();
        }

        setupRoomListener();
        startPresenceHeartbeat();

        // ✅ restore correct screen based on phase
        if (data.phase === "lobby") {
            showLobby();
        } else if (data.phase === "playing" && data.timeStarted === null) {
            if (amSpectator) {
                showLobby(); // spectator waits for next round
            } else {
                passShown = false;
                showPassScreen();
            }
        } else if (data.phase === "discussion") {
            showDiscussion();
        } else if (data.phase === "voting") {
            showVoting();
        } else if (data.phase === "results") {
            resultsShown = false;
            showResults();
        }
        return true;

    } catch (err) {
        console.error("❌ restore session failed:", err);
        return false;
    }
}

async function goToMainPage() {
    try {
        console.log("🏠 Logo clicked -> go to main page");

        // stop listeners/timers first
        stopPresenceHeartbeat();
        clearGameTimer();
        

        if (unsubscribeRoom) {
            unsubscribeRoom();
            unsubscribeRoom = null;
        }

        // if user is still in a room, leave properly
        const stillInRoom =
            roomId &&
            playerName &&
            roomData?.players?.some(p => p.name === playerName);

        if (stillInRoom) {
            await leaveRoom();
            return; // leaveRoom already reloads
        }

        // otherwise just clear session and return home
        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerSessionId");

        roomId = null;
        playerName = null;
        roomData = null;
        isHost = false;
        resultsShown = false;
        resultsTriggered = false;
        nextRoundStarted = false;
        discussionStarted = false;
        votingStarted = false;
        passShown = false;
        justCreatedRoom = false;
        lastPhase = null;

        // remove ?room=... from URL
        window.history.replaceState({}, "", window.location.pathname);
        updateHostLobbyButton();
        showScreen("start");
        setStartMode("create");

    } catch (err) {
        console.error("❌ goToMainPage failed:", err);

        // fallback: hard reload to clean home URL
        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerSessionId");

        window.location.href = window.location.pathname;
    }
}

function extractRoomCodeFromQr(text) {
  try {
    const url = new URL(text);
    const room = url.searchParams.get("room");

    if (room) {
      return room.trim().toUpperCase().slice(0, 6);
    }
  } catch (err) {
    // QR was not a full URL. Maybe it was only the room code.
  }

  return text.trim().toUpperCase().slice(0, 6);
}

async function openQrScanner() {
  const modal = document.getElementById("qrScannerModal");
  const roomInput = document.getElementById("roomCode");

  if (!window.Html5Qrcode) {
    console.error("Html5Qrcode library not found");
    toast("QR scanner not loaded");
    return;
  }

  modal.classList.add("show");

  try {
    // clean old scanner if exists
    if (qrScanner) {
      try {
        await qrScanner.stop();
        await qrScanner.clear();
      } catch (err) {
        console.warn("Old scanner already stopped");
      }
      qrScanner = null;
    }

    qrScanner = new window.Html5Qrcode("qrReader");

    const cameras = await window.Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      toast("No camera found");
      return;
    }

    // Prefer back camera on iPhone
    const backCamera =
      cameras.find(camera =>
        camera.label.toLowerCase().includes("back") ||
        camera.label.toLowerCase().includes("rear")
      ) || cameras[cameras.length - 1];

    await qrScanner.start(
      backCamera.id,
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        }
      },
        async (decodedText) => {
        const roomCode = extractRoomCodeFromQr(decodedText);

        console.log("✅ QR decoded:", decodedText);
        console.log("✅ Room code:", roomCode);

        roomInput.value = roomCode;

        await closeQrScanner();

        if (!document.getElementById("playerName").value.trim()) {
            toast("Enter your name first");
            return;
        }

        toast("Joining room...");

        await window.joinRoom();
        },
      () => {
        // ignore scanning misses
      }
    );
  } catch (err) {
    console.error("QR scanner error:", err);
    toast("Camera access failed");
    await closeQrScanner();
  }
}

async function closeQrScanner() {
  const modal = document.getElementById("qrScannerModal");

  try {
    if (qrScanner) {
      await qrScanner.stop();
      await qrScanner.clear();
      qrScanner = null;
    }
  } catch (err) {
    console.warn("Scanner already stopped");
  }

  if (modal) {
    modal.classList.remove("show");
  }
}


async function goBackToLobby() {
    if (!isHost || !roomId || !roomData) return;

    const roomRef = doc(db, "rooms", roomId);

    await updateDoc(roomRef, {
        phase: "lobby",
        started: false,
        nextRoundReady: [],
        readyForDiscussion: [],
        revealedPlayers: [],
        votes: {},
        voteStarted: null,
        timeStarted: null,
        revealedWord: null,
        roundWinners: [],

        players: roomData.players.map(p => ({
            ...p,
            ready: false,
            spectator: false,
            score: 0 // remove this line if you want to keep statistics
        }))
    });

    passShown = false;
    discussionStarted = false;
    votingStarted = false;
    resultsShown = false;
    resultsTriggered = false;
    nextRoundStarted = false;
    timeLeft = 0;
    clearGameTimer();

    toast("Returned to lobby");
}
    // ==========================
    // START APP
    // ==========================
async function startApp() {

    const impostorMinusBtn = document.getElementById("impostorMinusBtn");
const impostorPlusBtn = document.getElementById("impostorPlusBtn");

if (impostorMinusBtn) {
    impostorMinusBtn.onclick = () => updateImpostorCount(-1);
}

if (impostorPlusBtn) {
    impostorPlusBtn.onclick = () => updateImpostorCount(1);
}



    const endGameBtn = document.getElementById("endGameBtn");
if (endGameBtn) {
    endGameBtn.onclick = async () => {
        if (!isHost) return;

        await updateDoc(doc(db, "rooms", roomId), {
            phase: "lobby",
            started: false,
            votes: {},
            nextRoundReady: [],
            readyForDiscussion: [],
            revealedPlayers: [],
            voteStarted: null,
            timeStarted: null,
  
            players: roomData.players.map(p => ({
                ...p,
                ready: false,
                spectator: false
            }))

        });

        toast("Game ended by host");
    };
}

const refreshPlayersBtn = document.getElementById("refreshPlayersBtn");
if (refreshPlayersBtn) {
    refreshPlayersBtn.onclick = () => {
        cleanupStalePlayers();
        toast("Refreshing players...");
    };
}

const hostLobbyBtn = document.getElementById("hostLobbyBtn");
if (hostLobbyBtn) {
    hostLobbyBtn.onclick = async () => {
        await goBackToLobby();
    };
}

const showInviteBtn = document.getElementById("showInviteBtn");
if (showInviteBtn) {
    showInviteBtn.onclick = async () => {
        const qr = document.getElementById("qrCodeGame");
        const qrInviteBox = document.getElementById("qrInviteBox");
        if (!qr || !qrInviteBox) return;

        const isOpen =
            qrInviteBox.style.display === "flex" ||
            getComputedStyle(qrInviteBox).display === "flex";

        if (isOpen) {
            qrInviteBox.style.display = "none";
            qr.innerHTML = "";
            showInviteBtn.innerText = "📨 Invite Players";
            return;
        }

        const link = `${window.location.origin}?room=${roomId}`;

        try {
            await navigator.clipboard.writeText(link);
            toast("Invite link copied ✅");
        } catch (err) {
            toast("Could not copy link");
        }

        qr.innerHTML = "";
        new QRCode(qr, {
            text: link,
            width: 130,
            height: 130
        });

        qrInviteBox.style.display = "flex";
        showInviteBtn.innerText = "❌ Hide Invite";
    };
}





    const savedLang = localStorage.getItem("language");
    if (savedLang) currentLanguage = savedLang;
    updateLanguageBadge();

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

    const modeCreateBtn = document.getElementById("modeCreateBtn");
    const modeJoinBtn = document.getElementById("modeJoinBtn");
    const scanQrBtn = document.getElementById("scanQrBtn");
    const closeScannerBtn = document.getElementById("closeScannerBtn");

    if (scanQrBtn) {
    scanQrBtn.addEventListener("click", openQrScanner);
    }

    if (closeScannerBtn) {
    closeScannerBtn.addEventListener("click", closeQrScanner);
    }

    if (modeCreateBtn && modeJoinBtn) {
        modeCreateBtn.addEventListener("click", () => setStartMode("create"));
        modeJoinBtn.addEventListener("click", () => setStartMode("join"));
    }

    // ✅ logo click -> back to home
    const homeLogo = document.getElementById("homeLogo");
    if (homeLogo) {
        homeLogo.addEventListener("click", goToMainPage);

        homeLogo.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goToMainPage();
            }
        });
    }

    showScreen("start");
    setStartMode("create");

    await loadWords();

    const restored = await tryRestoreSession();
    if (restored) return;

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

        








    function getImpostorNames(data = roomData) {
    if (Array.isArray(data?.impostors) && data.impostors.length > 0) {
        return data.impostors;
    }
    if (data?.impostor) {
        return [data.impostor];
    }
    return [];
}

async function updateImpostorCount(delta) {
    if (!isHost || roomData.phase !== "lobby") return;

    const activePlayers = (roomData.players || []).filter(p => !p.spectator);
    const maxImpostors = Math.max(1, Math.min(3, activePlayers.length - 2));

    const current = Number(roomData.impostorCount || 1);
    const next = Math.max(1, Math.min(maxImpostors, current + delta));

    await updateDoc(doc(db, "rooms", roomId), {
        impostorCount: next
    });
}

function updateImpostorCountUI() {
    const el = document.getElementById("impostorCountValue");
    if (el) {
        el.innerText = String(roomData?.impostorCount || 1);
    }
}

    // ==========================
    // START GAME (HOST ONLY)
    // ==========================
   async function startGame() {
    if (!isHost) return;

    if (roomData.phase !== "lobby") {
        return toast("Game already started");
    }

    const activePlayers = roomData.players.filter(p => !p.spectator);
    const readyPlayers = activePlayers.filter(p => p.ready);

    const impostorCount = Number(roomData.impostorCount || 1);

    if (readyPlayers.length < 3) {
        return toast("Need at least 3 ready players");
    }

    if (readyPlayers.length < impostorCount + 2) {
        return toast("Need at least 2 more players than impostors");
    }

    if (!words.length) {
        await loadWords();
    }

    if (!words.length) {
        return toast("No words loaded ❌");
    }

    const randomWord = words[Math.floor(Math.random() * words.length)];

    const shuffled = [...readyPlayers].sort(() => Math.random() - 0.5);
    const impostorNames = shuffled.slice(0, impostorCount).map(p => p.name);

    const roomRef = doc(db, "rooms", roomId);

    await updateDoc(roomRef, {
        started: true,
        phase: "playing",
        word: randomWord,
        impostor: impostorNames[0],   // backward compatibility
        impostors: impostorNames,
        nextRoundReady: [],
        revealedPlayers: [],
        readyForDiscussion: [],
        votes: {},
        voteStarted: null,
        timeStarted: null
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

        const impostorNames = getImpostorNames(data);

if (impostorNames.includes(playerName)) {
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

        document.body.classList.remove("role-impostor", "role-innocent");

        if (myRole === "IMPOSTOR") {
            document.body.classList.add("role-impostor");
        } else {
            document.body.classList.add("role-innocent");
        }


        const el = document.getElementById("roleContent");

        if (myRole === "IMPOSTOR") {
            el.innerHTML = `
                <div class="role-box impostor-role reveal-pop">
                    <div class="role-icon">🕵️</div>
                    <div class="role-title">YOU ARE THE IMPOSTOR</div>
                    <div class="role-subtitle">Blend in and avoid detection.</div>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="role-box innocent-role reveal-pop">
                    <div class="role-icon">🧠</div>
                    <div class="role-title">SECRET WORD</div>
                    <div class="role-word">${gameWord}</div>
                    <div class="role-subtitle">Talk naturally and find the impostor.</div>
                </div>
            `;
        }
    }

    // ==========================
    // START DISCUSSION PHASE
    // ==========================


async function startDiscussion() {
    const roomRef = doc(db, "rooms", roomId);
    console.log("🚀 STARTING DISCUSSION (HOST)");

    discussionStarted = true;

    try {
        await updateDoc(roomRef, {
            phase: "discussion",
            timeStarted: Date.now(),
            discussionTime: roomData?.discussionTime || 60
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

    // ✅ host control
    if (isHost) {
        skipBtn.style.display = "block";
    } else {
        skipBtn.style.display = "none";
    }

    skipBtn.onclick = async () => {
        console.log("⏭ HOST SKIPPED DISCUSSION");
        clearGameTimer();
        await startVoting();
    };

    clearGameTimer();

    // ✅ ✅ FIX: calculate time IMMEDIATELY (important)
    function calculateTimeLeft() {
        const started = roomData?.timeStarted;
        const duration = roomData?.discussionTime || 120;

        if (!started) return duration;

        const elapsed = Math.floor((Date.now() - started) / 1000);
        return Math.max(duration - elapsed, 0);
    }

    // ✅ instant update (FIXES RELOAD BUG)
    timeLeft = calculateTimeLeft();
    updateTimer();

    // ✅ interval
    timerInterval = setInterval(() => {

        const started = roomData?.timeStarted;
        if (!started) return;

        const duration = roomData.discussionTime || 120;
        const elapsed = Math.floor((Date.now() - started) / 1000);

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


    
function getActivePlayers() {
    return (roomData.players || []).filter(p => !p.spectator);
}

function getEligibleVoters() {
    const impostorNames = getImpostorNames();
    return (roomData.players || []).filter(
        p => !p.spectator && !impostorNames.includes(p.name)
    );
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

    const timerEl = document.createElement("div");
    timerEl.id = "voteTimer";
    timerEl.style.marginBottom = "10px";
    timerEl.style.fontSize = "20px";
    container.appendChild(timerEl);

    const info = document.createElement("div");
    info.id = "voteInfo";
    info.style.marginBottom = "10px";
    container.appendChild(info);

    // ✅ impostor sees message only, no vote buttons
    
const impostorNames = getImpostorNames();

if (impostorNames.includes(playerName)) {

        const msg = document.createElement("div");
        msg.className = "center";
        msg.innerText = "🕵️ Impostor cannot vote";
        msg.style.marginBottom = "12px";
        container.appendChild(msg);

        startVoteTimer();
        return;
    }

    // ✅ everyone else can vote for ANY other active non-spectator player
    // including the impostor
    const voteTargets = (roomData.players || []).filter(
        p => !p.spectator && p.name !== playerName
    );

    voteTargets.forEach(p => {
        const btn = document.createElement("button");
        btn.className = "vote-btn";
        btn.innerText = p.name;
        btn.onclick = () => votePlayer(p.name);
        container.appendChild(btn);
    });

    startVoteTimer();
}


    // ==========================
    // update Voting UI
    // ==========================

function updateVotingUI() {
    const votes = roomData.votes || {};
    const total = getEligibleVoters().length;

    const info = document.getElementById("voteInfo");
    if (info) {
        info.innerText = `Votes: ${Object.keys(votes).length}/${total}`;
    }

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


    // ==========================
    // START VOTE TIMER
    // ==========================


function startVoteTimer() {
    clearGameTimer();

    timerInterval = setInterval(() => {
        const votes = roomData.votes || {};
        const eligibleNames = getEligibleVoters().map(p => p.name);

        const validVotes = Object.entries(votes).filter(([voter]) =>
            eligibleNames.includes(voter)
        );

        if (validVotes.length === eligibleNames.length) {
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
        if (el) {
            el.innerText = `⏳ ${Math.max(remaining, 0)}s`;
        }

        if (remaining <= 0) {
            clearGameTimer();

            if (isHost && roomData.phase === "voting") {
                calculateResults();
            }
        }
    }, 1000);
}




    // ==========================
    // VOTE PLAYER
    // ==========================

async function votePlayer(target) {
    // ✅ impostor cannot vote
    
const impostorNames = getImpostorNames();

if (impostorNames.includes(playerName)) {

        return toast("Impostor cannot vote");
    }

    // ✅ no self vote
    if (target === playerName) {
        return toast("You cannot vote for yourself");
    }

    // ✅ no double vote
    if (roomData.votes && roomData.votes[playerName]) {
        return toast("You already voted");
    }

    const buttons = document.querySelectorAll(".vote-btn");

    buttons.forEach(btn => {
        if (btn.innerText === target) {
            btn.style.background = "#22c55e";
        }
        btn.disabled = true;
        btn.style.opacity = "0.6";
    });

    await updateDoc(doc(db, "rooms", roomId), {
        [`votes.${playerName}`]: target
    });
}









function computeRoundOutcome(data) {
    const votes = data.votes || {};
    const impostorNames = getImpostorNames(data);

    const correctGuessers = Object.keys(votes).filter(
        voter => impostorNames.includes(votes[voter])
    );

    const impostorEscaped = correctGuessers.length === 0;

    return {
        impostorNames,
        word: data.word,
        correctGuessers,
        roundWinners: impostorEscaped ? impostorNames : correctGuessers,
        impostorEscaped
    };
}

    // ==========================
    // CALCULATE RESULTS
    // ==========================

async function calculateResults() {
    if (resultsTriggered) return;

    resultsTriggered = true;

    const roomRef = doc(db, "rooms", roomId);
    const outcome = computeRoundOutcome(roomData);

    const updatedPlayers = roomData.players.map(p => {
        if (outcome.roundWinners.includes(p.name)) {
            return {
                ...p,
                score: (p.score || 0) + 1
            };
        }
        return p;
    });

    await updateDoc(roomRef, {
        phase: "results",
        players: updatedPlayers,
        roundWinners: outcome.roundWinners,
        revealedWord: outcome.word
    });
}

function renderStatistics() {
    const statsContent = document.getElementById("statsContent");
    if (!statsContent || !roomData?.players) return;

    const sorted = [...roomData.players]
        .filter(p => !p.spectator)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const topScore = sorted.length ? (sorted[0].score || 0) : 0;
    const leaders = sorted.filter(p => (p.score || 0) === topScore);

    statsContent.innerHTML = `
        <div class="stats-header">
            <strong>🏆 Leader${leaders.length > 1 ? "s" : ""}:</strong>
            ${leaders.map(p => `${p.name} (${p.score || 0})`).join(", ")}
        </div>
        <div class="stats-list">
            ${sorted.map((p, index) => `
                <div class="stats-row">
                    <span>${index + 1}. ${p.name}</span>
                    <strong>${p.score || 0} pt</strong>
                </div>
            `).join("")}
        </div>
    `;
}



async function backToLobby() {
    if (!isHost) return;

    const roomRef = doc(db, "rooms", roomId);

    await updateDoc(roomRef, {
        phase: "lobby",
        started: false,
        nextRoundReady: [],
        readyForDiscussion: [],
        revealedPlayers: [],
        votes: {},
        voteStarted: null,
        timeStarted: null,

        // reset players for a fresh lobby
        players: roomData.players.map(p => ({
            ...p,
            ready: false,
            spectator: false,
            score: 0   // ✅ remove this line if you want to KEEP scores
        }))
    });

    // local reset
    passShown = false;
    discussionStarted = false;
    votingStarted = false;
    resultsShown = false;
    resultsTriggered = false;
    nextRoundStarted = false;
    timeLeft = 0;
    clearGameTimer();

    toast("Back to lobby");
}
    // ==========================
    // SHOW RESULTS
    // ==========================
    function showResults() {

        const oldLeaveBtn = document.getElementById("leaveResultsBtn");

        if (oldLeaveBtn) {
            const newLeaveBtn = oldLeaveBtn.cloneNode(true);
            oldLeaveBtn.parentNode.replaceChild(newLeaveBtn, oldLeaveBtn);

            newLeaveBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                    await leaveRoom();
                } catch (err) {
                    console.error("❌ leave from results failed:", err);
                    toast("Failed to leave");
                }
            };
        }
        document.body.classList.remove("win", "lose");
        showScreen("results");

        const backToLobbyBtn = document.getElementById("backToLobbyBtn");

if (backToLobbyBtn) {
    if (isHost) {
        backToLobbyBtn.style.display = "block";
        backToLobbyBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await backToLobby();
        };
    } else {
        backToLobbyBtn.style.display = "none";
    }
}

        const votes = roomData.votes || {};
        const content = document.getElementById("resultsContent");
        const impostor = roomData.impostor;
        const revealedWord = roomData.revealedWord || roomData.word || "-";

        const impostorNames = getImpostorNames(roomData);
        const impostorLabel = impostorNames.join(", ");

        let winners = [];

        Object.keys(votes).forEach(player => {
            if (impostorNames.includes(votes[player])) {
                winners.push(player);
            }
        });

       const impostorNames = getImpostorNames(roomData);
        const impostorLabel = impostorNames.join(", ");
        const guessedCorrectly = winners.includes(playerName);
        const iAmImpostor = impostorNames.includes(playerName);

        // ==========================
        // CASE 1: Impostor was found
        // ==========================
        if (winners.length > 0) {

            if (guessedCorrectly) {
                // ✅ This player wins
                document.body.classList.add("win");
                launchConfetti();

                content.innerHTML = `
                    <div class="results-animate">
                        <h2 class="result-title bounce-in">🎉 You Win!</h2>

                        <div class="impostor-box slide-up red-glow">
                            <span>🕵️ Impostor</span>
                            <strong>${impostor}</strong>
                        </div>
                        
                        <div class="winner-box slide-up delay-1">
                        <span>🧠 Secret Word</span>
                        <strong>${revealedWord}</strong>
                        </div>


                        <div class="winner-box slide-up green-glow delay-1">
                            <span>✅ Correct Guessers</span>
                            <div class="winner-list">
                                ${winners.map(name => `<span class="badge pop-in">${name}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // ❌ This player loses
                document.body.classList.add("lose");

                content.innerHTML = `
                    <div class="results-animate">
                        <h2 class="result-title bounce-in">❌ You Lose!</h2>

                        <div class="impostor-box slide-up red-glow">
                            <span>🕵️ Impostor</span>
                            <strong>${impostor}</strong>
                        </div>


                        <div class="winner-box slide-up delay-1">
                        <span>🧠 Secret Word</span>
                        <strong>${revealedWord}</strong>
                        </div>

                        <div class="winner-box slide-up green-glow delay-1">
                            <span>✅ Correct Guessers</span>
                            <div class="winner-list">
                                ${winners.map(name => `<span class="badge pop-in">${name}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // ==========================
        // CASE 2: Impostor wins
        // ==========================
        else {

            if (iAmImpostor) {
                // ✅ Impostor wins
                document.body.classList.add("win");
                launchConfetti();

                content.innerHTML = `
                    <div class="results-animate">
                        <h2 class="result-title bounce-in">🕵️ You Win!</h2>

                        <div class="impostor-box slide-up red-glow">
                            <span>🕵️ Impostor</span>
                            <strong>${impostor}</strong>
                        </div>

                        <div class="winner-box slide-up delay-1">
                        <span>🧠 Secret Word</span>
                        <strong>${revealedWord}</strong>
                        </div>

                        <div class="winner-box slide-up dark-glow delay-1">
                            <span>👑 Winner</span>
                            <div class="winner-list">
                                <span class="badge impostor pop-in">${impostor}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // ❌ Innocent player loses
                document.body.classList.add("lose");

                content.innerHTML = `
                    <div class="results-animate">
                        <h2 class="result-title bounce-in">💀 You Lose!</h2>

                        <div class="impostor-box slide-up red-glow">
                            <span>🕵️ Impostor</span>
                            <strong>${impostor}</strong>
                        </div>

                        <div class="winner-box slide-up delay-1">
                        <span>🧠 Secret Word</span>
                        <strong>${revealedWord}</strong>
                        </div>

                        <div class="winner-box slide-up dark-glow delay-1">
                            <span>👑 Winner</span>
                            <div class="winner-list">
                                <span class="badge impostor pop-in">${impostor}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // ==========================
        // NEXT ROUND BUTTON
        // ==========================
        const oldBtn = document.getElementById("nextRoundBtn");

        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.type = "button";
        newBtn.disabled = false;
        newBtn.style.pointerEvents = "auto";
        newBtn.style.zIndex = "9999";
        newBtn.style.position = "relative";
        newBtn.style.opacity = "1";

        function updateNextBtn() {
            const ready = roomData?.nextRoundReady || [];
            const total = roomData?.players?.length || 0;

            newBtn.innerText = `Next Round (${ready.length}/${total})`;

            if (ready.includes(playerName)) {
                newBtn.disabled = true;
                newBtn.style.opacity = "0.6";
            } else {
                newBtn.disabled = false;
                newBtn.style.opacity = "1";
            }
        }

        updateNextBtn();
        const statsPanel = document.getElementById("statsPanel");
        const toggleStatsBtn = document.getElementById("toggleStatsBtn");

        renderStatistics();

        if (toggleStatsBtn && statsPanel) {
            toggleStatsBtn.onclick = () => {
                const isOpen = statsPanel.style.display === "block";
                statsPanel.style.display = isOpen ? "none" : "block";
                toggleStatsBtn.innerText = isOpen ? "📈 Show Statistics" : "📉 Hide Statistics";
            };
        }

        newBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log("🟢 NEXT ROUND BUTTON CLICKED:", playerName);

            if (newBtn.disabled) return;

            try {
                newBtn.disabled = true;
                newBtn.style.opacity = "0.6";

                await updateDoc(doc(db, "rooms", roomId), {
                    nextRoundReady: arrayUnion(playerName)
                });

                console.log("✅ Ready for next round saved:", playerName);
            } catch (err) {
                console.error("❌ next round click failed:", err);

                newBtn.disabled = false;
                newBtn.style.opacity = "1";

                toast("Failed to go next round");
            }
        };
    }
   

    // ==========================
    // NEXT ROUND
    // ==========================
async function nextRound() {
    const roomRef = doc(db, "rooms", roomId);

    console.log("🔄 NEXT ROUND CLICKED");

    try {
        const totalPlayers = roomData.players.filter(p => !p.spectator).length;

        // ✅ if not enough players, return to lobby
        if (totalPlayers < 3) {
            await updateDoc(roomRef, {
                phase: "lobby",
                started: false,
                nextRoundReady: [],
                readyForDiscussion: [],
                revealedPlayers: [],
                votes: {},
                voteStarted: null,
                timeStarted: null,
                players: roomData.players.map(p => ({
                    ...p,
                    ready: false,
                    spectator: false
                }))
            });

            passShown = false;
            discussionStarted = false;
            votingStarted = false;
            timeLeft = 0;
            clearGameTimer();

            console.log("⚠️ Not enough players, back to lobby");
            return;
        }

        // ✅ make sure words are loaded
        if (!words.length) {
            await loadWords();
        }

        if (!words.length) {
            toast("No words loaded ❌");
            nextRoundStarted = false;
            return;
        }

        // ✅ pick new word + new impostor
        const randomWord = words[Math.floor(Math.random() * words.length)];
        const activePlayers = roomData.players.filter(p => !p.spectator);
        const impostorCount = Number(roomData.impostorCount || 1);

        const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
        const impostorNames = shuffled.slice(0, impostorCount).map(p => p.name);

        await updateDoc(roomRef, {
            phase: "playing",
            started: true,
            word: randomWord,
            impostor: impostorNames[0],
            impostors: impostorNames,

            // ✅ reset round fields
            nextRoundReady: [],
            readyForDiscussion: [],
            revealedPlayers: [],
            votes: {},
            voteStarted: null,
            timeStarted: null
        });

        // ✅ local reset
        passShown = false;
        discussionStarted = false;
        votingStarted = false;
        resultsShown = false;
        resultsTriggered = false;
        nextRoundStarted = false;
        timeLeft = 0;
        clearGameTimer();


        console.log("✅ NEXT ROUND STARTED IMMEDIATELY");

    } catch (err) {
        console.error("❌ nextRound error:", err);
        nextRoundStarted = false;
    }
}











function showPassScreen() {
    clearGameTimer();
    clearContinueCountdown();
    showScreen("pass");

    const revealBtn = document.getElementById("revealRoleBtn");
    const continueBtn = document.getElementById("continueBtn");

    revealBtn.disabled = false;
    revealBtn.innerText = "Reveal My Role";

    continueBtn.disabled = true;
    continueBtn.innerText = "Continue";
    continueBtn.classList.remove("btn-success");
    continueBtn.classList.add("btn-warning");

    revealBtn.onclick = () => {
        revealMyRole();

        continueBtn.disabled = false;
        continueBtn.classList.remove("btn-warning");
        continueBtn.classList.add("btn-success");

        clearContinueCountdown();

        let secondsLeft = 5;
        continueBtn.innerText = `Continue in ${secondsLeft}s`;

        continueCountdownInterval = setInterval(() => {
            secondsLeft -= 1;

            if (secondsLeft > 0) {
                continueBtn.innerText = `Continue in ${secondsLeft}s`;
            } else {
                clearContinueCountdown();
                if (!continueBtn.disabled) {
                    continueBtn.click();
                }
            }
        }, 1000);

        continueAutoTimeout = setTimeout(() => {
            clearContinueCountdown();
            if (!continueBtn.disabled) {
                continueBtn.click();
            }
        }, 5000);
    };

    continueBtn.onclick = async () => {
        if (continueBtn.disabled) return;

        clearContinueCountdown();

        try {
            continueBtn.disabled = true;
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
            continueBtn.innerText = "Continue";
            continueBtn.classList.remove("btn-warning");
            continueBtn.classList.add("btn-success");

            toast("Failed to continue");
        }
    };
}






    

window.setLanguage = async function (lang) {

  if (!isHost) {
    return toast("Only host can change language ❌");
  }

  // ✅ NEW: block mid-game changes
  if (roomData.phase !== "lobby") {
    return toast("Can't change language during game ❌");
  }

  currentLanguage = lang;

  await updateDoc(doc(db, "rooms", roomId), {
    language: lang
  });

  localStorage.setItem("language", lang);

  await loadWords(); // ✅ IMPORTANT

  document.getElementById("langMenu").style.display = "none";

  updateLanguageBadge();

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

function isDiscussionStarted() {
  return roomData.timeStarted !== null;
}

window.addEventListener("pagehide", () => {
    stopPresenceHeartbeat();
});






async function forceVoting() {
    if (!isHost) return;

    await updateDoc(doc(db, "rooms", roomId), {
        phase: "voting",
        voteStarted: Date.now()
    });
}


async function forceResults() {
    if (!isHost) return;

    await updateDoc(doc(db, "rooms", roomId), {
        phase: "results"
    });
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        touchPresence().catch(err => console.error("❌ visibility touch error:", err));
    }
});