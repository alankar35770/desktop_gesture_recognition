# Gesture Recognition Desktop Control System

A modern, real-time hand gesture recognition tool that lets you control your desktop (volume, windows, screenshots, lock screen, etc.) using hand gestures detected via webcam.

Built with **MediaPipe** + **K-Nearest Neighbors (KNN)** + **FastAPI** backend and a clean neumorphic web dashboard frontend.

## Features

- Real-time gesture detection using MediaPipe Hands
- Browser-based gesture recording (no external tools needed)
- Map any gesture to desktop actions (PyAutoGUI)
- Add, delete, and retrain gestures live from the dashboard
- Confidence threshold adjustment
- Mirrored camera preview (natural feel)
- Only landmarks shown during recording (clean UI)
- Dark neumorphic UI with toggleable live preview

## Tech Stack

**Backend**
- Python 3.11+
- MediaPipe 0.10.9
- OpenCV 4.9.0
- scikit-learn 1.8.0 (KNN)
- FastAPI 0.129.0 + Uvicorn
- PyAutoGUI 0.9.54

**Frontend**
- HTML5 + CSS3 (custom neumorphic dark theme)
- Vanilla JavaScript
- MediaPipe Hands JS (browser landmark detection)
- Font Awesome 6 icons

## Project Structure
gesture_backend/
├── datasets/
│   ├── gesture_landmarks.csv      # all collected landmark data
│   └── gesture_config.json        # list of gesture names
├── models/
│   ├── gesture_model.pkl          # trained KNN model
│   ├── scaler.pkl                 # feature scaler
│   └── class_names_knn.json       # gesture labels
├── static/
│   └── dashboard.js               # frontend logic
├── templates/
│   └── dashboard.html             # main dashboard UI
├── gesture_actions.json           # gesture → action mappings
├── action_executor.py
├── gesture_detector.py
├── main.py                        # FastAPI server
├── retrain.py                     # model training script
├── static_landmarks_dataset_collector.py  # legacy console collector
└── requirements.txt


## Installation & Setup

1. **Clone or extract the project**

2. **Create & activate virtual environment**

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. **Install dependencies**
    ```bash
   pip install -r requirements.txt
   ```
3. **Run the server**

    ```bash
   uvicorn main:app --reload
   ```

   