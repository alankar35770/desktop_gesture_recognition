window.onload = async () => {
    console.log("dashboard.js loaded");
    loadGestures();
    loadMappings();
    setInterval(updateCurrentGesture, 800); // 800ms is more stable than 500ms
};

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

async function loadGestures() {
    const res = await fetch('/gestures');
    const gestures = await res.json();
    const select = document.getElementById('gesture-select');
    select.innerHTML = '<option value="">Select...</option>';
    gestures.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.text = g;
        select.appendChild(opt);
    });
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
    const action = document.getElementById('action-select').value;
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

// Load gestures into BOTH selects (mapping and delete)
async function loadGestures() {
    const res = await fetch('/gestures');
    const gestures = await res.json();

    // For mapping select
    const mapSelect = document.getElementById('gesture-select');
    mapSelect.innerHTML = '<option value="">Select...</option>';
    gestures.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.text = g;
        mapSelect.appendChild(opt);
    });

    // For delete select
    const deleteSelect = document.getElementById('delete-gesture-select');
    if (deleteSelect) {
        deleteSelect.innerHTML = '<option value="">Select...</option>';
        gestures.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.text = g;
            deleteSelect.appendChild(opt);
        });
    }
}

// Delete gesture
async function deleteGesture() {
    const gesture = document.getElementById('delete-gesture-select').value;
    if (!gesture) {
        alert("Please select a gesture to delete");
        return;
    }

    if (!confirm(`Are you sure you want to delete gesture "${gesture}" and all its samples?`)) {
        return;
    }

    try {
        const res = await fetch('/delete_gesture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gesture })
        });

        const result = await res.json();

        if (result.status === "success") {
            document.getElementById('output').innerText = result.message;
            document.getElementById('output').className = 'status success';
            loadGestures();         // refresh both selects
            loadMappings();         // refresh action mappings
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


// Browser-based recording with MediaPipe Hands JS


let handsInstance, videoEl, canvasEl, ctx, samples = 0, target = 0, collected = [];

// async function startRecording() {
//     const gesture = document.getElementById('gesture-name').value.trim();
//     targetSamples = parseInt(document.getElementById('sample-count').value);
//     if (!gesture) return alert('Enter gesture name');

//     videoElement = document.getElementById('video');
//     canvasElement = document.getElementById('canvas');
//     canvasCtx = canvasElement.getContext('2d');

    
//     videoElement.style.display = 'none';
//     canvasElement.style.display = 'block';

//     try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         videoElement.srcObject = stream;

//         hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`});
//         hands.setOptions({
//             maxNumHands: 1,
//             modelComplexity: 1,
//             minDetectionConfidence: 0.75,
//             minTrackingConfidence: 0.75
//         });
//         hands.onResults(onResults);

//         const camera = new Camera(videoElement, {
//             onFrame: async () => {
//                 await hands.send({image: videoElement});
//             },
//             width: 640,
//             height: 480
//         });
//         camera.start();

//         landmarksList = [];
//         samplesCollected = 0;
//         document.getElementById('progress').innerText = 'Progress: 0%';

//     } catch (err) {
//         console.error("Recording camera error:", err);
//         alert("Failed to access camera: " + err.message);
//     }
// }

function onResultsHandler(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

    if (results.multiHandLandmarks?.length > 0 && samples < target) {
        const landmarks = results.multiHandLandmarks[0];
        // Simple visualization
        for (const lm of landmarks) {
            const x = lm.x * canvasEl.width;
            const y = lm.y * canvasEl.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#00ff00';
            ctx.fill();
        }
        collected.push(landmarks.map(lm => ({x: lm.x, y: lm.y, z: lm.z})));
        samples++;
        document.getElementById('progress').innerText = `Progress: ${Math.round((samples / target) * 100)}%`;

        if (samples >= target) {
            sendCollectedData();
        }
    }
    ctx.restore();
}

async function sendCollectedData() {
    const name = document.getElementById('gesture-name').value.trim();
    await fetch('/add_landmarks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({gesture: name, landmarks: collected})
    });
    document.getElementById('output').innerText = 'Gesture samples saved successfully';
    document.getElementById('output').className = 'status success';

    // Cleanup
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.style.display = 'none';
    canvasEl.style.display = 'none';
    loadGestures(); // refresh list
}




// PERMANENT LIVE PREVIEW - raw camera OR landmarks


let previewCanvas = null;
let previewCtx = null;
let previewHands = null;
let previewCamera = null;
let isPreviewVisible = false;
let isPreviewRunning = false;
let previewMode = 'raw'; // 'raw' or 'landmarks'

const previewToggleBtn = document.getElementById('toggle-live-preview');
const previewStatus = document.getElementById('preview-status');
const previewWrapper = document.getElementById('live-preview-wrapper');
const previewInfo = document.getElementById('preview-info');

// Toggle preview visibility
if (previewToggleBtn) {
    previewToggleBtn.addEventListener('click', () => {
        isPreviewVisible = !isPreviewVisible;
        previewWrapper.style.display = isPreviewVisible ? 'block' : 'none';

        const icon = isPreviewVisible ? 'fa-eye-slash' : 'fa-eye';
        const text = isPreviewVisible ? 'Hide Live Preview' : 'Show Live Preview';
        previewToggleBtn.innerHTML = `<i class="fas ${icon}"></i> ${text}`;

        previewStatus.innerText = isPreviewVisible ? 'Preview: visible' : 'Preview: hidden';

        if (isPreviewVisible && system_running && !isPreviewRunning) {
            startPreview();
        }
    });
}

async function startPreview() {
    if (isPreviewRunning) return;

    previewCanvas = document.getElementById('live-preview-canvas');
    previewCtx = previewCanvas.getContext('2d');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });

        const hiddenVideo = document.createElement('video');
        hiddenVideo.width = 480;
        hiddenVideo.height = 360;
        hiddenVideo.autoplay = true;
        hiddenVideo.playsinline = true;
        hiddenVideo.muted = true;
        hiddenVideo.srcObject = stream;
        document.body.appendChild(hiddenVideo);

        if (previewMode === 'landmarks') {
            previewHands = new Hands({
                locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
            });
            previewHands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.65,
                minTrackingConfidence: 0.65
            });
            previewHands.onResults(onPreviewLandmarks);
            previewCamera = new Camera(hiddenVideo, {
                onFrame: async () => await previewHands.send({ image: hiddenVideo }),
                width: 480,
                height: 360
            });
            previewCamera.start();
            previewInfo.innerText = 'Detecting hands...';
        } else {
            // Raw mode: just mirror the video on canvas
            hiddenVideo.onloadedmetadata = () => {
                function drawRaw() {
                    if (!hiddenVideo.srcObject) return;
                    previewCtx.save();
                    previewCtx.translate(previewCanvas.width, 0);
                    previewCtx.scale(-1, 1);
                    previewCtx.drawImage(hiddenVideo, 0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.restore();
                    requestAnimationFrame(drawRaw);
                }
                drawRaw();
            };
            previewInfo.innerText = 'Raw camera feed';
        }

        isPreviewRunning = true;

    } catch (err) {
        console.error("Preview error:", err);
        previewInfo.innerText = 'Camera error: ' + err.message;
        previewInfo.style.color = '#ff5555';
    }
}

function onPreviewLandmarks(results) {
    if (!previewCtx) return;

    previewCtx.save();
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Flip horizontally
    previewCtx.translate(previewCanvas.width, 0);
    previewCtx.scale(-1, 1);
    previewCtx.drawImage(results.image, 0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);

    if (results.multiHandLandmarks?.length > 0) {
        const lm = results.multiHandLandmarks[0];
        for (const p of lm) {
            const x = (1 - p.x) * previewCanvas.width;
            const y = p.y * previewCanvas.height;
            previewCtx.beginPath();
            previewCtx.arc(x, y, 4, 0, 2 * Math.PI);
            previewCtx.fillStyle = '#00ff88';
            previewCtx.fill();
        }
        previewInfo.innerText = 'Hand detected';
        previewInfo.style.color = '#00ff88';
    } else {
        previewInfo.innerText = 'No hand detected';
        previewInfo.style.color = '#ffcc00';
    }

    previewCtx.restore();
}

function stopPreview() {
    if (previewCamera) previewCamera.stop();
    if (previewHands) previewHands.close();
    if (previewCtx) previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    isPreviewRunning = false;
    previewInfo.innerText = 'Preview stopped';
}

// Recording - show ONLY landmarks canvas
async function startRecording() {
    const gesture = document.getElementById('gesture-name').value.trim();
    target = parseInt(document.getElementById('sample-count').value);
    if (!gesture) return alert('Enter gesture name');

    const videoEl = document.getElementById('video');
    const canvasEl = document.getElementById('canvas');
    const ctx = canvasEl.getContext('2d');

    // Hide permanent preview while recording
    if (previewWrapper) {
        previewWrapper.style.display = 'none';
        previewStatus.innerText = 'Hidden during recording';
    }

    document.getElementById('recording-preview').style.display = 'block';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoEl.srcObject = stream;

        const hands = new Hands({locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`});
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.75,
            minTrackingConfidence: 0.75
        });
        hands.onResults(results => {
            ctx.save();
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

            // Mirror
            ctx.translate(canvasEl.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            if (results.multiHandLandmarks?.length > 0 && samples < target) {
                const lm = results.multiHandLandmarks[0];
                for (const p of lm) {
                    const x = (1 - p.x) * canvasEl.width;
                    const y = p.y * canvasEl.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#00ff00';
                    ctx.fill();
                }
                collected.push(lm.map(p => ({x: 1 - p.x, y: p.y, z: p.z})));
                samples++;
                document.getElementById('progress').innerText = `Progress: ${Math.round((samples / target) * 100)}%`;

                if (samples >= target) sendCollectedData();
            }
            ctx.restore();
        });

        const camera = new Camera(videoEl, {
            onFrame: async () => await hands.send({image: videoEl}),
            width: 640,
            height: 480
        });
        camera.start();

        samples = 0;
        collected = [];

    } catch (err) {
        console.error("Recording error:", err);
        alert("Camera access failed: " + err.message);
    }
}

async function sendCollectedData() {
    const name = document.getElementById('gesture-name').value.trim();
    await fetch('/add_landmarks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({gesture: name, landmarks: collected})
    });

    document.getElementById('output').innerText = 'Gesture saved';
    document.getElementById('output').className = 'status success';

    // Cleanup
    document.getElementById('video').srcObject?.getTracks().forEach(t => t.stop());
    document.getElementById('recording-preview').style.display = 'none';

    // Restore permanent preview if it was visible
    if (isPreviewVisible && system_running) {
        previewWrapper.style.display = 'block';
        previewStatus.innerText = 'Preview visible';
        startPreview();
    }

    loadGestures();
}

// Hook system buttons
const origStart = startSystem;
startSystem = async () => {
    await origStart();
    if (isPreviewVisible) startPreview();
};

const origStop = stopSystem;
stopSystem = async () => {
    await origStop();
    stopPreview();
};