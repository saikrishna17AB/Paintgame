// ── Join Game Logic ────────────────────────────────────────────────────────────

const WS_URL = "ws://localhost:8765"; // ← Change to your server URL

function joinGame() {
    const nameInput = document.getElementById("playerName");
    const errorMsg = document.getElementById("error-msg");
    const name = nameInput.value.trim();

    // Validate name
    if (!name) {
        errorMsg.style.display = "block";
        nameInput.focus();

        // Re-trigger shake animation
        errorMsg.style.animation = "none";
        errorMsg.offsetHeight; // reflow trick to restart animation
        errorMsg.style.animation = "shake 0.3s ease";
        return;
    }

    errorMsg.style.display = "none";

    // Save name to sessionStorage so drawer/guesser pages can use it
    sessionStorage.setItem("playerName", name);

    // ── Connect to server and send join request ────────────────────────────
    const socket = new WebSocket(WS_URL);

    // Show loading state on button
    const joinBtn = document.querySelector(".join-btn");
    joinBtn.innerText = "Connecting... ⏳";
    joinBtn.disabled = true;

    socket.onopen = () => {
        // Send join request — server will decide if player is drawer or guesser
        socket.send(JSON.stringify({
            type: "join",
            name: name
        }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.role === "drawer") {
            // Server assigned this player as the drawer
            sessionStorage.setItem("playerRole", "drawer");
            window.location.href = "drawer.html";

        } else if (data.role === "guesser") {
            // Server assigned this player as a guesser
            sessionStorage.setItem("playerRole", "guesser");
            window.location.href = "guesser.html";
        }
    };

    socket.onerror = () => {
        errorMsg.innerText = "⚠️ Could not connect to server. Try again.";
        errorMsg.style.display = "block";

        // Reset button
        joinBtn.innerText = "Join Game 🎮";
        joinBtn.disabled = false;
    };

    socket.onclose = () => {
        // Reset button if connection closes before redirect
        if (!sessionStorage.getItem("playerRole")) {
            joinBtn.innerText = "Join Game 🎮";
            joinBtn.disabled = false;
        }
    };
}

// ── Keyboard Support ───────────────────────────────────────────────────────────
document.getElementById("playerName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        joinGame();
    }
});