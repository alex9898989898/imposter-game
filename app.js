
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
    let presenceInterval = null;
    let playerSessionId =
        sessionStorage.getItem("playerSessionId") ||
        (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    sessionStorage.setItem("playerSessionId", playerSessionId);

    let cleanupRunning = false;



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
    if (!roomId || !playerName || !roomData?.players) return;

    const roomRef = doc(db, "rooms", roomId);

    const found = roomData.players.some(p => p.sessionId === playerSessionId);
    if (!found) return;

    const updatedPlayers = roomData.players.map(p => {
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
    }, 5000);
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
        width: 120,
        height: 120
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

    // ✅ keep duplicate protection
    const exists = data.players.some(
        p => p.name.toLowerCase() === playerName.toLowerCase()
    );

    if (exists) {
        return toast("Name already taken ❌");
    }

    // ✅ normal join

        // ✅ normal join
        await updateDoc(roomRef, {
            players: arrayUnion({
                name: playerName,
                ready: false,
                score: 0,
                sessionId: playerSessionId,
                lastSeen: Date.now()
            })
        });



sessionStorage.setItem("roomId", roomId);
sessionStorage.setItem("playerName", playerName);


    setupRoomListener();
    showLobby();
    startPresenceHeartbeat();
};








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

        await updateDoc(roomRef, {

        players: arrayUnion({
            name: playerName,
            ready: false,
            score: 0,
            sessionId: playerSessionId,
            lastSeen: Date.now()
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
    if (!roomData || roomData.phase !== "lobby" || cleanupRunning) return;

    cleanupRunning = true;

    try {
        const now = Date.now();
        const timeoutMs = 15000; // 15 seconds without heartbeat => remove

        const players = roomData.players || [];

        const alivePlayers = players.filter(p => {
            // if old player object doesn't yet have lastSeen, keep it for compatibility
            if (!p.lastSeen) return true;
            return now - p.lastSeen < timeoutMs;
        });

        if (alivePlayers.length === players.length) {
            cleanupRunning = false;
            return;
        }

        const roomRef = doc(db, "rooms", roomId);
        const update = {
            players: alivePlayers
        };

        // if host was stale and removed, give host to first alive player
        if (!alivePlayers.some(p => p.name === roomData.host) && alivePlayers.length > 0) {
            update.host = alivePlayers[0].name;
        }

        console.log("🧹 Removing stale players:", players.length - alivePlayers.length);

        await updateDoc(roomRef, update);

    } catch (err) {
        console.error("❌ cleanupStalePlayers error:", err);
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
    unsubscribeRoom = onSnapshot(roomRef, (snap) => {

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
        
        const previousPhase = lastPhase;
        lastPhase = roomData.phase;

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

        // ✅ HOST CHECK
        const previousHost = isHost;
        isHost = roomData.host === playerName;
        if (!isHost) {
        document.getElementById("langMenu").style.display = "none";
        }
        if (previousHost !== isHost) {
            showLobby();
        }
        
        
        if (roomData.phase === "lobby") {
            cleanupStalePlayers();
        }

        updateLanguageControl();
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
            roomData.timeStarted === null &&
            !passShown &&
            !resultsShown   // ✅ ADD THIS
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

        if (roomData.phase === "discussion") {
            if (!screens.discussion.classList.contains("active")) {
                console.log("📺 FORCE SHOW DISCUSSION");
                discussionStarted = true;
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

            if (
                isHost &&
                ready.length === total &&
                total > 0 &&
                !nextRoundStarted
            ) {
                nextRoundStarted = true;

                console.log("🚀 STARTING NEXT ROUND (ONCE)");

                nextRound();
            }
        }



    });
}



    // ==========================
    // SHOW LOBBY
    // ==========================
    function showLobby() {
        justCreatedRoom = false;
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

                
        document.getElementById("roomTitle").innerText =
            `${roomId} (${currentLanguage.toUpperCase()})`;


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

        sessionStorage.removeItem("roomId");
        sessionStorage.removeItem("playerName");
        stopPresenceHeartbeat();


        location.reload();
    }
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
            passShown = false;
            showPassScreen();
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

    // ==========================
    // START APP
    // ==========================
async function startApp() {
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
            await loadWords(); // ✅ force load
        }

        if (!words.length) {
            return toast("No words loaded ❌");
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
            nextRoundReady: [], // ✅ ADD THIS
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

        discussionStarted = true; // ✅ ADD THIS

        try {

            await updateDoc(roomRef, {
                phase: "discussion",
                timeStarted: Date.now(),
                discussionTime: 60
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
            if (typeof started !== "number") return;

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
        if (resultsTriggered) return; // ✅ BLOCK DUPLICATES

        resultsTriggered = true;

        const roomRef = doc(db, "rooms", roomId);

        await updateDoc(roomRef, {
            phase: "results"
        });
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

        // ✅ Players who guessed the impostor correctly
        Object.keys(votes).forEach(player => {
            if (votes[player] === impostor) {
                winners.push(player);
            }
        });

        const guessedCorrectly = winners.includes(playerName);
        const iAmImpostor = playerName === impostor;

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
    
    console.log("RESET COMPLETE:", {
    readyForDiscussion: [],
    revealedPlayers: []
    });


    console.log("🔄 NEXT ROUND CLICKED");

    try {
            await updateDoc(roomRef, {
                phase: "lobby",
                started: false,
                language: roomData.language, // ✅ keep language stable
                nextRoundReady: [], // ✅ RESET HERE

                // ✅ reset game fields
                votes: {},
                impostor: null,
                word: null,

                // ✅ IMPORTANT RESETS
                readyForDiscussion: [],
                revealedPlayers: [],
                
                
                timeStarted: null,
                voteStarted: null,
                

                players: roomData.players.map(p => ({
                    ...p,
                    ready: false
                }))
            });

        // ✅ LOCAL RESET (VERY IMPORTANT)
        passShown = false;
        discussionStarted = false;
        votingStarted = false;
        timeLeft = 0;
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

            continueBtn.disabled = true;
            continueBtn.innerText = "Read carefully...";

            setTimeout(() => {
                continueBtn.disabled = false;
                continueBtn.innerText = "Continue";
                continueBtn.classList.remove("btn-warning");
                continueBtn.classList.add("btn-success");
            }, 1200);
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

function isDiscussionStarted() {
  return roomData.timeStarted !== null;
}

window.addEventListener("pagehide", () => {
    stopPresenceHeartbeat();
});
