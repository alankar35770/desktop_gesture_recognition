window.onload = async () => {
    console.log("dashboard.js loaded");
    loadGestures();
    loadMappings();
    setInterval(updateCurrentGesture, 800);
    startLiveFeed();
};

// ─── SYSTEM ──────────────────────────────────────────────────────────────────

async function startSystem() {
    await fetch('/start');
    document.getElementById('output').innerText = 'System started';
    document.getElementById('output').className = 'status success';
}

async function stopSystem() {
    await fetch('/stop');
    document.getElementById('output').innerText = 'System stopped';
    document.getElementById('output').className = 'status';
}

async function updateCurrentGesture() {
    try {
        const res = await fetch('/gesture');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        document.getElementById('current-gesture').innerText =
            `Current Gesture: ${data.gesture || 'None'} (${data.confidence.toFixed(1)}%)`;
    } catch (err) {
        console.error("Gesture fetch error:", err);
        document.getElementById('current-gesture').innerText = "Current Gesture: Error fetching";
    }
}

// ─── GESTURES / MAPPINGS ─────────────────────────────────────────────────────

async function loadGestures() {
    const res = await fetch('/gestures');
    const gestures = await res.json();

    const mapSelect = document.getElementById('gesture-select');
    mapSelect.innerHTML = '<option value="">Select...</option>';
    gestures.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.text = g;
        mapSelect.appendChild(opt);
    });

    const deleteSelect = document.getElementById('delete-gesture-select');
    if (deleteSelect) {
        deleteSelect.innerHTML = '<option value="">Select...</option>';
        gestures.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.text = g;
            deleteSelect.appendChild(opt);
        });
    }
}

async function loadMappings() {
    const res = await fetch('/actions');
    const actions = await res.json();
    const ul = document.querySelector('#current-mappings ul');
    ul.innerHTML = '';
    Object.entries(actions).forEach(([g, a]) => {
        const li = document.createElement('li');
        li.textContent = `${g} → ${a}`;
        ul.appendChild(li);
    });
}

async function updateAction() {
    const gesture = document.getElementById('gesture-select').value;
    const action  = document.getElementById('action-select').value;
    if (!gesture) return alert("Select a gesture first");
    await fetch('/update_action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({gesture, action})
    });
    loadMappings();
    document.getElementById('output').innerText = 'Mapping updated';
    document.getElementById('output').className = 'status success';
}

async function deleteGesture() {
    const gesture = document.getElementById('delete-gesture-select').value;
    if (!gesture) { alert("Please select a gesture to delete"); return; }
    if (!confirm(`Are you sure you want to delete gesture "${gesture}" and all its samples?`)) return;

    try {
        const res = await fetch('/delete_gesture', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ gesture })
        });
        const result = await res.json();
        if (result.status === "success") {
            document.getElementById('output').innerText = result.message;
            document.getElementById('output').className = 'status success';
            loadGestures();
            loadMappings();
        } else {
            document.getElementById('output').innerText = result.message || "Failed to delete gesture";
            document.getElementById('output').className = 'status error';
        }
    } catch (err) {
        console.error("Delete error:", err);
        document.getElementById('output').innerText = "Error deleting gesture";
        document.getElementById('output').className = 'status error';
    }
}

async function retrainModel() {
    await fetch('/retrain', {method: 'POST'});
    document.getElementById('output').innerText = 'Model retrained';
    document.getElementById('output').className = 'status success';
}

async function updateThreshold() {
    const threshold = parseFloat(document.getElementById('confidence-threshold').value) || 60;
    await fetch('/settings/confidence', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({threshold})
    });
    document.getElementById('output').innerText = 'Threshold updated';
    document.getElementById('output').className = 'status success';
}

// ─── ALWAYS-ON LIVE FEED ─────────────────────────────────────────────────────

let liveFeedVideo   = null;
let liveFeedCamera  = null;
let liveFeedHands   = null;
let liveFeedRunning = false;

async function startLiveFeed() {
    if (liveFeedRunning) return;

    const canvas = document.getElementById('canvas');
    const ctx    = canvas.getContext('2d');

    liveFeedVideo             = document.createElement('video');
    liveFeedVideo.width       = 640;
    liveFeedVideo.height      = 480;
    liveFeedVideo.autoplay    = true;
    liveFeedVideo.playsinline = true;
    liveFeedVideo.muted       = true;
    liveFeedVideo.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;';
    document.body.appendChild(liveFeedVideo);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        liveFeedVideo.srcObject = stream;

        liveFeedHands = new Hands({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
        });
        liveFeedHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        liveFeedHands.onResults(results => {
            if (isRecording) return; // recording handler owns the canvas

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            if (results.multiHandLandmarks?.length > 0) {
                const lm = results.multiHandLandmarks[0];
                for (const p of lm) {
                    const x = (1 - p.x) * canvas.width;
                    const y = p.y * canvas.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#7c83ff';
                    ctx.fill();
                }
            }
            ctx.restore();
        });

        liveFeedCamera = new Camera(liveFeedVideo, {
            onFrame: async () => await liveFeedHands.send({ image: liveFeedVideo }),
            width: 640,
            height: 480
        });
        liveFeedCamera.start();
        liveFeedRunning = true;

        // Show canvas, hide placeholder, update dot
        document.getElementById('canvas').style.display           = 'block';
        document.getElementById('feed-placeholder').style.display = 'none';
        document.getElementById('feed-dot').style.color           = 'var(--accent)';
        document.getElementById('feed-toggle').checked            = true;

    } catch (err) {
        console.error("Live feed error:", err);
        document.getElementById('feed-placeholder').style.display = 'flex';
        document.getElementById('canvas').style.display           = 'none';
        document.getElementById('feed-dot').style.color           = 'var(--muted)';
    }
}

function stopLiveFeed() {
    if (liveFeedCamera) { liveFeedCamera.stop(); liveFeedCamera = null; }
    if (liveFeedHands)  { liveFeedHands.close();  liveFeedHands  = null; }

    if (liveFeedVideo) {
        if (liveFeedVideo.srcObject) {
            // Stop every track so the browser camera indicator light turns off
            liveFeedVideo.srcObject.getTracks().forEach(t => t.stop());
            liveFeedVideo.srcObject = null;
        }
        liveFeedVideo.remove();
        liveFeedVideo = null;
    }

    liveFeedRunning = false;

    // Clear canvas and show placeholder
    const canvas = document.getElementById('canvas');
    const ctx    = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas.style.display = 'none';
    document.getElementById('feed-placeholder').style.display = 'flex';
    document.getElementById('feed-dot').style.color           = 'var(--muted)';
}

// ─── FEED TOGGLE ─────────────────────────────────────────────────────────────

let feedVisible = true;
let isRecording = false;

function toggleFeed(on) {
    // During recording the feed must always stay on — snap toggle back
    if (isRecording) {
        document.getElementById('feed-toggle').checked = true;
        return;
    }

    feedVisible = on;

    if (on) {
        startLiveFeed(); // restarts camera + MediaPipe from scratch
    } else {
        stopLiveFeed();  // fully kills camera — indicator light goes off
    }
}

function lockFeedOn() {
    isRecording = true;
    feedVisible = true;
    const toggle    = document.getElementById('feed-toggle');
    toggle.checked  = true;
    toggle.disabled = true;
    document.getElementById('canvas').style.display           = 'block';
    document.getElementById('feed-placeholder').style.display = 'none';
    document.getElementById('feed-dot').style.color           = 'var(--accent)';
}

function unlockFeed() {
    isRecording = false;
    document.getElementById('feed-toggle').disabled = false;
    // If user had toggled off before recording, respect that
    if (!feedVisible) toggleFeed(false);
}

// ─── RECORDING ───────────────────────────────────────────────────────────────

let recordingCanvasEl = null;
let recordingCtx      = null;
let recordingCamera   = null;
let recordingHands    = null;
let recordingVideoEl  = null;

let samples   = 0;
let target    = 0;
let collected = [];

async function startRecording() {
    const gesture = document.getElementById('gesture-name').value.trim();
    target = parseInt(document.getElementById('sample-count').value);
    if (!gesture) return alert('Enter gesture name');

    recordingCanvasEl = document.getElementById('canvas');
    recordingCtx      = recordingCanvasEl.getContext('2d');

    recordingVideoEl             = document.createElement('video');
    recordingVideoEl.width       = 640;
    recordingVideoEl.height      = 480;
    recordingVideoEl.autoplay    = true;
    recordingVideoEl.playsinline = true;
    recordingVideoEl.muted       = true;
    recordingVideoEl.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;';
    document.body.appendChild(recordingVideoEl);

    samples   = 0;
    collected = [];
    document.getElementById('progress').innerText = 'Progress: 0%';

    // Stop live feed before recording takes over the canvas
    // (recording uses its own camera stream at higher confidence)
    if (liveFeedRunning) stopLiveFeed();

    lockFeedOn();
    document.getElementById('stop-btn').style.display = 'inline-flex';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        recordingVideoEl.srcObject = stream;

        recordingHands = new Hands({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
        });
        recordingHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.75,
            minTrackingConfidence: 0.75
        });

        recordingHands.onResults(results => {
            recordingCtx.save();
            recordingCtx.clearRect(0, 0, recordingCanvasEl.width, recordingCanvasEl.height);
            recordingCtx.translate(recordingCanvasEl.width, 0);
            recordingCtx.scale(-1, 1);
            recordingCtx.drawImage(results.image, 0, 0, recordingCanvasEl.width, recordingCanvasEl.height);
            recordingCtx.setTransform(1, 0, 0, 1, 0, 0);

            if (results.multiHandLandmarks?.length > 0 && samples < target) {
                const lm = results.multiHandLandmarks[0];
                for (const p of lm) {
                    const x = (1 - p.x) * recordingCanvasEl.width;
                    const y = p.y * recordingCanvasEl.height;
                    recordingCtx.beginPath();
                    recordingCtx.arc(x, y, 5, 0, 2 * Math.PI);
                    recordingCtx.fillStyle = '#00ff00';
                    recordingCtx.fill();
                }
                collected.push(lm.map(p => ({x: 1 - p.x, y: p.y, z: p.z})));
                samples++;
                document.getElementById('progress').innerText =
                    `Progress: ${Math.round((samples / target) * 100)}%`;

                if (samples >= target) sendCollectedData();
            }
            recordingCtx.restore();
        });

        recordingCamera = new Camera(recordingVideoEl, {
            onFrame: async () => await recordingHands.send({ image: recordingVideoEl }),
            width: 640,
            height: 480
        });
        recordingCamera.start();

    } catch (err) {
        console.error("Recording error:", err);
        alert("Camera access failed: " + err.message);
        cleanupRecording();
    }
}

function stopRecording() {
    cleanupRecording();
    document.getElementById('output').innerText   = 'Recording stopped.';
    document.getElementById('output').className   = 'status';
    document.getElementById('progress').innerText = 'Capture: 0%';
}

function cleanupRecording() {
    if (recordingCamera) { recordingCamera.stop(); recordingCamera = null; }
    if (recordingHands)  { recordingHands.close();  recordingHands  = null; }

    if (recordingVideoEl) {
        if (recordingVideoEl.srcObject) {
            recordingVideoEl.srcObject.getTracks().forEach(t => t.stop());
            recordingVideoEl.srcObject = null;
        }
        recordingVideoEl.remove();
        recordingVideoEl = null;
    }

    document.getElementById('stop-btn').style.display = 'none';

    // unlockFeed checks feedVisible — if it was on before recording, restart live feed
    unlockFeed();
    if (feedVisible) startLiveFeed();
}

async function sendCollectedData() {
    const name = document.getElementById('gesture-name').value.trim();

    await fetch('/add_landmarks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ gesture: name, landmarks: collected })
    });

    document.getElementById('output').innerText   = 'Gesture saved successfully!';
    document.getElementById('output').className   = 'status success';
    document.getElementById('progress').innerText = 'Capture: 100% ✓';

    cleanupRecording();
    loadGestures();
}