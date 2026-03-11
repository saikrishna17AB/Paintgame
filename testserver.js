const WebSocket = require("ws");

const PORT = 8765;
const wss = new WebSocket.Server({ port: PORT });

console.log(`\n Test WebSocket server running on ws://localhost:${PORT}`);
console.log(` Waiting for connections...\n`);

wss.on("connection", (ws) => {
    console.log(" Client connected!\n");

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case "draw_point":
                console.log(`🖊️  draw_point → x: ${data.x}%, y: ${data.y}% | color: ${data.color} | tool: ${data.tool} | brushWidth: ${data.brushWidth}`);
                break;

            case "stroke_end":
                console.log(` stroke_end → stroke finished\n`);
                break;

            case "snapshot":
                // Don't print the full base64 — just show the size
                const sizeKB = (data.image.length * 0.75 / 1024).toFixed(1);
                console.log(` snapshot → canvas image received (${sizeKB} KB)\n`);
                break;

            case "clear":
                console.log(`clear → canvas was cleared\n`);
                break;

            default:
                console.log(` Unknown message type:`, data);
        }
    });

    ws.on("close", () => {
        console.log("\n Client disconnected");
    });
});
