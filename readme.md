# 🖐️ Gesture Control — Smart Desktop Interface

A real-time hand gesture recognition system that lets you control your Windows desktop using nothing but your webcam and hand gestures. Record custom gestures, bind them to system actions, and control media, windows, browser, clipboard and more — all from a web dashboard.

---

## ✨ Features

- **Browser-side detection** — MediaPipe Hands runs entirely in the browser; the backend stays lightweight with no OpenCV camera conflicts
- **Position & scale invariant recognition** — landmarks are wrist-subtracted and scale-normalised before training and inference, so gestures work anywhere in the frame at any distance
- **Custom gesture training** — record any hand gesture directly from the dashboard with a live mirrored camera preview and zero black-screen interruptions
- **47 bindable system actions** — media, window management, desktop, browser tabs, scrolling, clipboard, brightness, and more
- **Per-action cooldowns** — each action has an individually tuned cooldown so gestures like screenshot or play/pause don't fire repeatedly on a held pose
- **3-state engine control** — Start (detect + execute), Pause (detect only, no actions), Stop (release camera entirely)
- **Live confidence display** — detected gesture and confidence score shown in real time in the navbar
- **Gesture & mapping management** — add, delete gestures (including all training data from CSV) and remove individual action bindings from the dashboard
- **No black screen during recording** — the live feed reuses the existing MediaPipe instance when switching to training mode; no camera restart needed
- **Rolling activity log** — last 3 actions shown with timestamps and colour-coded status icons
- **Adjustable confidence threshold** — fine-tune how certain the model must be before triggering an action
- **One-click model retraining** — retrain the KNN classifier live without leaving the dashboard


---

## 🏗️ Architecture

```
Browser (MediaPipe Hands JS)
    │
    │  21 hand landmarks per frame (x, y, z)
    ▼
landmark_utils.py  ──→  wrist subtraction + scale normalisation
    │
    ▼
FastAPI /predict  ──→  KNN Classifier  ──→  Cooldown check  ──→  Action Executor  ──→  PyAutoGUI / OS
                    (gesture_detector.py)   (action_executor.py)
    │
    ▼
Dashboard UI (dashboard.html / dashboard.js)
```

Detection runs entirely client-side in the browser using MediaPipe Hands JS. Each frame, 21 hand landmark coordinates are sent to the `/predict` endpoint. The backend normalises them, runs them through the trained KNN model, checks the per-action cooldown, and — if the system is running and confidence clears the threshold — executes the bound system action via PyAutoGUI.

This architecture eliminates the common problem of OpenCV and browser MediaPipe competing for the same camera.

---

## 🗂️ Project Structure

```
project/
├── datasets/
│   ├── gesture_landmarks.csv       # collected (normalised) landmark training data
│   └── gesture_config.json         # registered gesture names
├── models/
│   ├── gesture_knn_model.pkl       # trained KNN model
│   ├── gesture_scaler.pkl          # StandardScaler for features
│   └── class_names_knn.json        # gesture label index
├── static/
│   └── dashboard.js                # all frontend logic
├── templates/
│   └── dashboard.html              # active dashboard theme
├── gesture_actions.json            # gesture → action bindings
├── action_executor.py              # action dispatch + per-action cooldown system
├── gesture_detector.py             # KNN prediction from landmarks
├── landmark_utils.py               # shared normalisation (wrist subtraction + scale)
├── main.py                         # FastAPI server + all endpoints
├── retrain.py                      # model training script
├── static_landmarks_dataset_collector.py  # legacy CLI collector
└── requirements.txt
```

> **Theme files** — rename whichever you prefer to `dashboard.html` inside `templates/`:
> - `axiom.html` — precision instrument, electric teal, `Oxanium` + `DM Mono`
> - `flux.html` — glassmorphism, aurora gradients, `Plus Jakarta Sans` + `Fira Code`
> - `ghost.html` — editorial brutalism, monochrome, `Bebas Neue` + `IBM Plex Mono`

---

## ⚙️ Installation

### Prerequisites

- Python 3.11 or higher
- Windows (action execution uses Windows-specific hotkeys and `ctypes.windll`)
- A working webcam

### Setup

**1. Clone or download the project**

```bash
git clone https://github.com/yourname/gesture-control.git
cd gesture-control
```

**2. Create and activate a virtual environment**

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Train the initial model** (models are not included in the repo due to `.gitignore`)

```bash
python retrain.py
```

**5. Start the server**

```bash
uvicorn main:app --reload
```

**6. Open the dashboard**

Navigate to [http://127.0.0.1:8000/dashboard](http://127.0.0.1:8000/dashboard)

---



## 🚀 Getting Started

### Step 1 — Record a gesture

1. In the **Training Lab** panel, type a name for your gesture (e.g. `thumbs_up`)
2. Choose a sample count — 100 is recommended; 200 for gestures similar to existing ones
3. Click **Start Recording** and hold the gesture steady in front of your webcam
4. Green dots appear on your hand landmarks as samples are captured; progress fills automatically
5. Recording stops and saves automatically when the target count is reached

### Step 2 — Retrain the model

Click **Retrain Model** in the Neural Logic panel. Do this every time you add or delete a gesture. Accuracy and a classification report are printed to the server terminal.

### Step 3 — Bind an action

1. In the **Command Map** panel, select your gesture from the dropdown
2. Choose a system action from the categorised list
3. Click **Bind Action** — the mapping appears as a chip in Active Mappings

### Step 4 — Run

Click **Start** in the top bar. The system detects gestures from the live camera feed and executes bound actions. The status indicator turns green and pulses while running.

---

## 🎮 Engine States

| Button | State | Indicator | Camera | Detection | Actions |
|--------|-------|-----------|--------|-----------|---------|
| **Start** | Running | 🟢 Green pulse | On | Yes | Yes |
| **Pause** | Paused | 🟡 Amber | On | Yes | No |
| **Stop** | Stopped | 🔴 Red | **Off** | No | No |

Clicking **Start** after a full Stop restarts the camera automatically.

---

## 🗺️ Available System Actions

| Category | Actions |
|----------|---------|
| 🎵 Media | Play/Pause, Next/Prev Track, Stop, Mute, Volume Up/Down |
| 🪟 Window | Next/Prev Window, Minimize, Maximize, Close, Snap Left/Right |
| 🖥️ Desktop | Screenshot, Show Desktop, Task View, Virtual Desktops, Taskbar |
| ⚙️ System | Lock Screen, Sleep, Brightness Up/Down, Settings, Terminal, File Manager, Calculator |
| 📜 Scroll | Scroll Up/Down/Left/Right, Page Up/Down, Jump to Top/Bottom |
| 🌐 Browser | Back, Forward, Refresh, New Tab, Close Tab, Next/Prev Tab, Reopen Tab |
| ✂️ Clipboard | Copy, Paste, Cut, Undo, Redo, Select All |

---

## 🔧 Configuration

### Confidence Threshold

Controls how certain the model must be before an action fires. Found in the **Sensitivity** section. Default is 60%. Raise it to reduce false positives; lower it if gestures aren't being picked up.

### Per-action Cooldowns

Each action has a built-in cooldown in `action_executor.py` (`ACTION_COOLDOWNS` dict) to prevent repeated firing on a held gesture. Key defaults:

| Action | Cooldown |
|--------|----------|
| Screenshot | 2.0 s |
| Play / Pause | 1.5 s |
| Lock Screen | 2.0 s |
| Sleep | 3.0 s |
| Volume Up/Down | 0.4 s |
| Scroll Up/Down | 0.15 s |
| Close Window | 1.5 s |
| Browser Refresh | 1.0 s |
| Undo / Redo | 0.3 s |

Actions not listed in `ACTION_COOLDOWNS` fire on every detection with no cooldown.

---

## 🤖 How the Model Works

### Landmark normalisation (`landmark_utils.py`)

Before any landmark data is saved to the CSV or used for inference, it passes through two-step normalisation:

1. **Wrist subtraction** — landmark 0 (wrist) is subtracted from all 21 points. Coordinates become relative to the wrist, making the gesture **position-invariant** (same gesture anywhere in the frame = same features)
2. **Scale normalisation** — all coordinates are divided by the max absolute value, making the gesture **scale-invariant** (same gesture near or far from the camera = same features)

This normalisation is applied consistently in three places: saving recorded samples (`main.py`), loading the dataset for training (`retrain.py`), and at inference time (`gesture_detector.py`).

### Classifier

A **K-Nearest Neighbors** classifier (k=5, distance-weighted, Euclidean metric) from scikit-learn. After normalisation, features are additionally scaled through a `StandardScaler`.

**Feature vector:** 21 landmarks × 3 coordinates = 63 features per sample.

**Training:** 80/20 stratified train/test split. Trains in under a second on typical datasets.

**Detection flow per frame:**
1. MediaPipe JS extracts 21 landmarks in the browser
2. Raw coordinates `POST`ed to `/predict`
3. Backend applies wrist subtraction + scale normalisation, then StandardScaler
4. KNN predicts class and probability — confidence = max class probability × 100
5. If confidence > threshold, system is running, and cooldown elapsed → action fires

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | Serve the dashboard UI |
| `GET` | `/start` | Start the engine (enable action execution) |
| `GET` | `/stop` | Stop the engine (also called by Pause — camera stays on client side) |
| `GET` | `/gesture` | Get current detected gesture and confidence |
| `GET` | `/gestures` | List all registered gesture names |
| `GET` | `/actions` | Get all gesture → action mappings |
| `POST` | `/predict` | Submit 21 landmarks, receive gesture + confidence |
| `POST` | `/add_landmarks` | Save a batch of normalised landmark samples to CSV |
| `POST` | `/update_action` | Bind a gesture to a system action |
| `POST` | `/remove_mapping` | Remove a single gesture → action binding |
| `POST` | `/delete_gesture` | Delete gesture from config and remove all its CSV rows |
| `POST` | `/retrain` | Retrain the KNN model from current dataset |
| `POST` | `/settings/confidence` | Update the live confidence threshold |
| `POST` | `/execute/{gesture}` | Manually trigger an action by gesture name |

---




## 🛠️ Tips for Better Recognition

- **Lighting matters most** — face a light source; avoid strong backlight
- **100+ samples minimum** per gesture; 200 for gestures similar to each other
- **Distinct shapes** — the KNN works on static poses, not motion; gestures that look similar in a single frame will confuse it
- **Retrain after every change** — adding or deleting a gesture without retraining leaves the model out of sync
- **Use the confidence threshold** — raise it to reduce false triggers; lower it if gestures aren't being picked up
- **Pause instead of Stop** — temporarily disables actions without releasing the camera
- **Re-record if accuracy is low** — delete the gesture and record fresh samples in consistent, well-lit conditions

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI + Uvicorn |
| ML model | scikit-learn KNN  |
| Hand detection (browser) | MediaPipe Hands JS |
| Desktop automation | PyAutoGUI |
| Data processing | pandas, NumPy |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Icons | Font Awesome 6 |

---

## 📋 Key Dependencies

```
fastapi==0.129.0
uvicorn==0.40.0
scikit-learn==1.8.0
pandas==3.0.0
numpy==1.26.4
pyautogui==0.9.54
mediapipe==0.10.9      # used only by retrain.py and legacy CLI collector
opencv-python==4.9.0.80  # same — not used by the server at runtime
```

> `mediapipe` and `opencv-python` remain in `requirements.txt` for `retrain.py` and the legacy `static_landmarks_dataset_collector.py`. The live server does **not** use them — detection runs entirely in the browser via MediaPipe JS.

Full pinned list: see `requirements.txt`.

---

## 🪟 Windows Notes

- The project targets **Windows**. `action_executor.py` uses `ctypes.windll` for DPI awareness and many actions use Windows-specific hotkeys (`Win+L`, `Win+D`, `Win+Tab`, etc.)
- Run your terminal as a **regular user**, not Administrator — PyAutoGUI has known issues with elevated permissions
- If brightness controls don't work, your monitor likely doesn't support WMI brightness management (common with external displays)
- The browser camera indicator light turns off when you click **Stop**, confirming camera tracks are properly released

---

<!-- ## 📄 License

MIT License — use freely, attribution appreciated. -->