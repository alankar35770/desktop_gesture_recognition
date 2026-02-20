window.onload = async () => {
    console.log("dashboard.js loaded");
    loadGestures();
    loadMappings();
    startLiveFeed();
};

// ─── SYSTEM ──────────────────────────────────────────────────────────────────

// systemState: 'idle' | 'running' | 'paused' | 'stopped'
let systemState = 'idle';

async function startSystem() {
    await fetch('/start');
    systemState = 'running';
    addLog('System started — detecting & executing actions', 'success');
    setSystemStatus('running');
    if (!liveFeedRunning) startLiveFeed();  // restart camera if it was stopped
}

async function pauseSystem() {
    if (systemState === 'stopped') return;
    await fetch('/stop');   // tells backend to detect but not execute
    systemState = 'paused';
    addLog('System paused — detecting gestures only', 'info');
    setSystemStatus('paused');
}

async function stopSystem() {
    await fetch('/stop');
    systemState = 'stopped';
    addLog('System stopped — camera released', 'info');
    setSystemStatus('stopped');
    updateGestureDisplay(null, 0);
    stopLiveFeed();   // fully release camera so indicator light goes off
}

function updateGestureDisplay(gesture, confidence) {
    const nameEl = document.getElementById('gesture-name-display');
    const confEl = document.getElementById('gesture-conf-display');
    if (gesture) {
        nameEl.innerText = gesture;
        confEl.innerText = `(${confidence.toFixed(1)}%)`;
    } else {
        nameEl.innerText = 'None';
        confEl.innerText = '';
    }
}

function setSystemStatus(state) {
    const dot  = document.getElementById('system-dot');
    const text = document.getElementById('system-status-text');
    const states = {
        idle:    { cls: '',        label: 'Idle'    },
        running: { cls: 'active',  label: 'Running' },
        paused:  { cls: 'paused',  label: 'Paused'  },
        stopped: { cls: 'stopped', label: 'Stopped' },
    };
    const s = states[state] || states.idle;
    dot.className  = `status-dot ${s.cls}`;
    text.innerText = s.label;
}

async function sendLandmarksForPrediction(landmarks) {
    try {
        const res = await fetch('/predict', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ landmarks })
        });
        if (!res.ok) return;
        const data = await res.json();
        updateGestureDisplay(data.gesture, data.confidence);
    } catch (err) {
        console.error("Predict error:", err);
    }
}


// ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────

const LOG_MAX = 3;

function addLog(message, type = 'info') {
    const list = document.getElementById('log-list');
    if (!list) return;

    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const now   = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <i class="fas ${icons[type] || icons.info} log-icon"></i>
        <span class="log-text">${message}</span>
        <span class="log-time">${now}</span>
    `;

    // Prepend so newest is on top
    list.insertBefore(entry, list.firstChild);

    // Keep only LOG_MAX entries
    while (list.children.length > LOG_MAX) {
        list.removeChild(list.lastChild);
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
    renderMappings(actions);
}

function renderMappings(actions) {
    const scroll  = document.getElementById('mappings-scroll');
    const empty   = document.getElementById('mappings-empty');
    const badge   = document.getElementById('mapping-count');
    const entries = Object.entries(actions);

    badge.textContent = entries.length;

    // Remove all chips (keep the empty placeholder node)
    scroll.querySelectorAll('.mapping-chip').forEach(el => el.remove());

    if (entries.length === 0) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    entries.forEach(([gesture, action]) => {
        const chip = document.createElement('div');
        chip.className = 'mapping-chip';
        chip.dataset.gesture = gesture;

        chip.innerHTML = `
            <div class="chip-left">
                <span class="chip-gesture" title="${gesture}">${gesture}</span>
                <i class="fas fa-long-arrow-alt-right chip-sep"></i>
                <span class="chip-action" title="${action}">${action.replace(/_/g, ' ')}</span>
            </div>
            <button class="chip-remove" title="Remove mapping" onclick="removeMapping('${gesture.replace(/'/g, "\\'")}')">
                <i class="fas fa-times"></i>
            </button>
        `;

        scroll.appendChild(chip);
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
    addLog(`Mapped: ${gesture} → ${action.replace(/_/g, ' ')}`, 'success');
}

async function removeMapping(gesture) {
    try {
        const res = await fetch('/remove_mapping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ gesture })
        });
        const result = await res.json();
        if (result.status === "success") {
            // Animate chip out
            const chip = document.querySelector(`.mapping-chip[data-gesture="${CSS.escape(gesture)}"]`);
            if (chip) {
                chip.style.transition = 'opacity 0.2s, transform 0.2s';
                chip.style.opacity    = '0';
                chip.style.transform  = 'translateX(8px)';
                setTimeout(() => loadMappings(), 220);
            } else {
                loadMappings();
            }
            addLog(`Mapping removed: ${gesture}`, 'success');
        } else {
            addLog(result.message || 'Failed to remove mapping', 'error');
        }
    } catch (err) {
        console.error("Remove mapping error:", err);
        addLog('Error removing mapping', 'error');
    }
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
            addLog(result.message, 'success');
            loadGestures();
            loadMappings();
        } else {
            addLog(result.message || 'Failed to delete gesture', 'error');
        }
    } catch (err) {
        console.error("Delete error:", err);
        addLog('Error deleting gesture', 'error');
    }
}

async function retrainModel() {
    await fetch('/retrain', {method: 'POST'});
    addLog('Model retrained successfully', 'success');
}

async function updateThreshold() {
    const threshold = parseFloat(document.getElementById('confidence-threshold').value) || 60;
    await fetch('/settings/confidence', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({threshold})
    });
    addLog(`Confidence threshold set to ${threshold}%`, 'success');
}

// ─── ALWAYS-ON LIVE FEED ─────────────────────────────────────────────────────

let liveFeedVideo     = null;
let liveFeedCamera   = null;
let liveFeedHands    = null;
let liveFeedRunning  = false;
let liveFeedOnResults = null;

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
            modelComplexity: 0,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.5
        });

        // Named function so recording cleanup can restore it
        liveFeedOnResults = results => {
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
                sendLandmarksForPrediction(lm.map(p => ({x: p.x, y: p.y, z: p.z})));
            } else {
                updateGestureDisplay(null, 0);
            }
            ctx.restore();
        };

        liveFeedHands.onResults(liveFeedOnResults);

        liveFeedCamera = new Camera(liveFeedVideo, {
            onFrame: async () => await liveFeedHands.send({ image: liveFeedVideo }),
            width: 640,
            height: 480
        });
        liveFeedCamera.start();
        liveFeedRunning = true;

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
            liveFeedVideo.srcObject.getTracks().forEach(t => t.stop());
            liveFeedVideo.srcObject = null;
        }
        liveFeedVideo.remove();
        liveFeedVideo = null;
    }

    liveFeedRunning = false;

    const canvas = document.getElementById('canvas');
    const ctx    = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas.style.display = 'none';
    document.getElementById('feed-placeholder').style.display = 'flex';
    document.getElementById('feed-dot').style.color           = 'var(--muted)';
}

// ─── FEED TOGGLE ─────────────────────────────────────────────────────────────
// Toggle is visual-only: just hides/shows the canvas with a placeholder.
// It has NO effect on the camera, MediaPipe, recording, or start/stop.

let isRecording = false;

function toggleFeed(on) {
    const canvas      = document.getElementById('canvas');
    const placeholder = document.getElementById('feed-placeholder');
    const dot         = document.getElementById('feed-dot');
    if (on) {
        canvas.style.display      = 'block';
        placeholder.style.display = 'none';
        dot.style.color           = 'var(--accent)';
    } else {
        canvas.style.display      = 'none';
        placeholder.style.display = 'flex';
        dot.style.color           = 'var(--muted)';
    }
}

function lockFeedOn() {
    // Force feed visible during recording, disable toggle
    isRecording = true;
    const toggle   = document.getElementById('feed-toggle');
    toggle.checked  = true;
    toggle.disabled = true;
    toggleFeed(true);
}

function unlockFeed() {
    // Restore toggle after recording
    isRecording = false;
    const toggle = document.getElementById('feed-toggle');
    toggle.disabled = false;
    toggleFeed(toggle.checked);
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

    samples   = 0;
    collected = [];
    document.getElementById('progress').innerText = 'Progress: 0%';

    lockFeedOn();
    document.getElementById('stop-btn').style.display = 'inline-flex';

    // Reuse the live feed if already running — no camera restart, no black frame.
    // Just swap the onResults handler to recording mode.
    if (liveFeedRunning && liveFeedHands) {
        liveFeedHands.onResults(recordingOnResults);
        return;
    }

    // Fallback: live feed not running, start a fresh camera for recording
    try {
        recordingVideoEl             = document.createElement('video');
        recordingVideoEl.width       = 640;
        recordingVideoEl.height      = 480;
        recordingVideoEl.autoplay    = true;
        recordingVideoEl.playsinline = true;
        recordingVideoEl.muted       = true;
        recordingVideoEl.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;';
        document.body.appendChild(recordingVideoEl);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        recordingVideoEl.srcObject = stream;

        recordingHands = new Hands({
            locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`
        });
        recordingHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.65,
            minTrackingConfidence: 0.5
        });
        recordingHands.onResults(recordingOnResults);

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

function recordingOnResults(results) {
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
}

function stopRecording() {
    cleanupRecording();
    addLog('Recording stopped', 'info');
    document.getElementById('progress').innerText = 'Capture: 0%';
}

function cleanupRecording() {
    // If we reused the live feed, just restore its onResults — no teardown needed
    if (liveFeedRunning && liveFeedHands) {
        liveFeedHands.onResults(liveFeedOnResults);
    }

    // Only tear down a separate recording camera if one was created
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
    unlockFeed();
}

async function sendCollectedData() {
    const name = document.getElementById('gesture-name').value.trim();

    await fetch('/add_landmarks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ gesture: name, landmarks: collected })
    });

    addLog('Gesture saved successfully!', 'success');
    document.getElementById('progress').innerText = 'Capture: 100% ✓';

    cleanupRecording();
    loadGestures();
}