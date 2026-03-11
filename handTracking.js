const video = document.createElement("video");
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.display = "none";
document.body.appendChild(video);

window.HandTracker = {
    x: 0,
    y: 0,
    gesture: "none",
    isHandPresent: () => false
};

const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(results => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        window.HandTracker.isHandPresent = () => false;
        window.HandTracker.gesture = "none";
        return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];

    window.HandTracker.x = 1 - indexTip.x;
    window.HandTracker.y = indexTip.y;
    window.HandTracker.isHandPresent = () => true;

    const indexUp = landmarks[8].y < landmarks[6].y;
    const middleUp = landmarks[12].y < landmarks[10].y;

    if (indexUp && middleUp) {
        window.HandTracker.gesture = "write";
    } else if (indexUp && !middleUp) {
        window.HandTracker.gesture = "hover";
    }
});

const cam = new Camera(video, {
    width: 640,
    height: 480,
    onFrame: async () => {
        await hands.send({ image: video });
    }
});

cam.start();