const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");

const gestureOutput = document.getElementById("gesture-output");
const cursorElement = document.getElementById("virtual-cursor");

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

let isDrawing = false;
let brushWidth = 5;
let segmentSize = 0;
let currentTool = "solid";
let lastElement = null;
let eventHandler = null;

document.getElementById("tool-size").innerHTML = brushWidth
document.getElementById("segment-size").innerHTML = segmentSize


const WS_URL = "ws://localhost:8765"; // ← Change to server URL
let socket = null;
let wsConnected = false;

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        wsConnected = true;
        console.log("[WS] Connected to server");
        updateWSStatus(true);
    };

    socket.onclose = () => {
        wsConnected = false;
        console.warn("[WS] Disconnected. Retrying in 3s...");
        updateWSStatus(false);
        setTimeout(connectWebSocket, 3000); // Auto-reconnect
    };

    socket.onerror = (err) => {
        console.error("[WS] Error:", err);
        wsConnected = false;
        updateWSStatus(false);
    };

    socket.onmessage = (event) => {
        // Handle any messages from server (e.g. round start, word to draw)
        const data = JSON.parse(event.data);
        console.log("[WS] From server:", data);
    };
}

function updateWSStatus(connected) {
    const statusEl = document.getElementById("ws-status");
    if (statusEl) {
        statusEl.innerText = connected ? " Connected" : " Disconnected";
    }
}

function sendToServer(data) {
    if (wsConnected && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } else {
        console.warn("[WS] Not connected — data not sent:", data.type);
    }
}

function normalise(x, y) {
    return {
        x: parseFloat((x / canvas.width*100).toFixed(2)),
        y: parseFloat((y / canvas.height*100).toFixed(2))
    };
}

function sendDrawPoint(x, y) {
    const norm = normalise(x, y);
    sendToServer({
        type: "draw_point",
        x: norm.x,
        y: norm.y,
        color: colorPicker.value,
        brushWidth: brushWidth,
        tool: currentTool,
        segmentSize: segmentSize
    });
}

function sendStrokeEnd() {
    sendToServer({ type: "stroke_end" });
}

function sendSnapshot() {
    // JPEG at 60% quality keeps size small (~20-40KB vs ~150KB PNG)
    const imageData = canvas.toDataURL("image/jpeg", 0.6);
    sendToServer({ type: "snapshot", image: imageData });
}

function sendClear() {
    sendToServer({ type: "clear" });
}

//Functions to draw
function ClearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sendClear();
}

function SaveCanvas() {
    let Image = canvas.toDataURL("image/png");
    const ImageElement = document.createElement("a");
    ImageElement.href = Image;
    ImageElement.download = "MediaPaintCanvas.png"
    ImageElement.click()
}

function activateSolid() {
    currentTool = "solid";
    segmentSize = 0;
    document.getElementById("segment-size").innerHTML = segmentSize;
    document.getElementById("tool-status").innerHTML = "Brush Size";
}

function activateDotted() {
    currentTool = "dotted";
    segmentSize = 15;
    document.getElementById("segment-size").innerHTML = segmentSize;
    document.getElementById("tool-status").innerHTML = "Brush Size";
}

function activateEraser() {
    currentTool = "eraser";
    segmentSize = 0;
    document.getElementById("segment-size").innerHTML = segmentSize;
    document.getElementById("tool-status").innerHTML = "Eraser Size";
}

function unselect()
{
    let hoveredElements = document.getElementsByClassName('hover');
    while (hoveredElements.length)
        hoveredElements[0].classList.remove('hover');
}

function checkSelect(Xpos,Ypos) {
    let hoverElement = document.elementFromPoint(Xpos,Ypos);
    if (hoverElement === null) return;

    if (hoverElement !== lastElement)
    {
        if (lastElement)
        {
            if (eventHandler)
            {
                unselect();
                lastElement.removeEventListener('transitionend',eventHandler);
                eventHandler = null;
            }
        }
        if (hoverElement)
        {
            eventHandler = function(e){
                if (e.propertyName!=='transform')
                {
                    return;
                }
                const target = e.target;
                target.click();
                unselect();
                hoverElement.removeEventListener('transitionend',eventHandler);
                eventHandler = null;
                lastElement = null;
            }

            function select()
            {
                hoverElement.classList.add("hover");
            }

            hoverElement.addEventListener('transitionend',eventHandler);
            setTimeout(select(),10);
        }
        lastElement = hoverElement;
    }
}

const startDraw = (x,y) => {
    if(currentTool === "solid")
    {
        ctx.globalCompositeOperation="source-over";
        ctx.setLineDash([])
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }
    else if (currentTool === "dotted")
    {
        ctx.globalCompositeOperation="source-over";
        isDrawing = true;
        ctx.beginPath();
        ctx.lineWidth = brushWidth;
        ctx.strokeStyle = colorPicker.value;
        ctx.setLineDash([segmentSize, segmentSize]);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }
    else if (currentTool === "eraser")
    {
        ctx.globalCompositeOperation="destination-out";
        isDrawing = true;
        ctx.beginPath();
        ctx.lineWidth = brushWidth;
    }
    else
    {
        return;
    }
    isDrawing = true;
    ctx.beginPath();
    ctx.lineWidth = brushWidth;
    ctx.strokeStyle = colorPicker.value;
    ctx.moveTo(x,y);

    sendDrawPoint(x, y);
}

const drawing = (x,y) => {
    if (!isDrawing) return;
    ctx.lineTo(x, y);
    ctx.stroke();

    sendDrawPoint(x, y);
}

const stopDraw = () => {
    if(!isDrawing) return;
    isDrawing = false;

    sendStrokeEnd(); 
    sendSnapshot(); 
}


// Event Handlers
canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    drawing(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseleave", stopDraw);


cursorElement.style.position = "fixed";
cursorElement.style.pointerEvents = "none";
cursorElement.style.zIndex = "9999";

function update() {
    if (typeof window.HandTracker !== "undefined") {

        const xNorm = window.HandTracker.x;
        const yNorm = window.HandTracker.y;
        const gesture = window.HandTracker.gesture;
        const isHand = window.HandTracker.isHandPresent();

        if (isHand) {
            cursorElement.style.display = "block";

            const screenX = Math.max(0, Math.min(1, xNorm)) * window.innerWidth;
            const screenY = Math.max(0, Math.min(1, yNorm)) * window.innerHeight;

            cursorElement.style.left = screenX + "px";
            cursorElement.style.top = screenY + "px";
            const currentColor = colorPicker.value;
            cursorElement.style.backgroundColor = currentColor;
            gestureOutput.innerText = "Gesture: " + (gesture || "none");

            const canvasRect = canvas.getBoundingClientRect();
            const canvasX = screenX - canvasRect.left;
            const canvasY = screenY - canvasRect.top;

            if (gesture === "write") {
                unselect();
                
                if (!isDrawing)
                {
                    startDraw(canvasX,canvasY);
                }
                else
                {
                    drawing(canvasX,canvasY);
                }
            }
            else if (gesture === "hover") {
                stopDraw();
                
                checkSelect(screenX,screenY);
            }
            else {
                stopDraw();
                ctx.beginPath();
            }
        } else {
            cursorElement.style.display = "none";
            gestureOutput.innerText = "Gesture: none";
        }
    }

    requestAnimationFrame(update);
}

function increaseBrushSize()
{
    if (brushWidth < 10)
    {
        brushWidth += 1;
    }
    document.getElementById("tool-size").innerHTML = brushWidth;
    cursorElement.style.height = `${brushWidth}px`;
    cursorElement.style.width = `${brushWidth}px`;
}

function decreaseBrushSize()
{
    if (brushWidth > 1)
    {
        brushWidth -= 1;
    }
    document.getElementById("tool-size").innerHTML = brushWidth;
    cursorElement.style.height = `${brushWidth}px`;
    cursorElement.style.width = `${brushWidth}px`;
}

connectWebSocket();
requestAnimationFrame(update);