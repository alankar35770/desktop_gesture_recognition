import pickle
import json
import numpy as np
import os

MODELS_DIR = "models"

MODEL_FILE = os.path.join(MODELS_DIR, "gesture_knn_model.pkl")
SCALER_FILE = os.path.join(MODELS_DIR, "gesture_scaler.pkl")
CLASS_FILE  = os.path.join(MODELS_DIR, "class_names_knn.json")

CONFIDENCE_THRESHOLD = 60

knn         = None
scaler      = None
class_names = []

def reload_model():
    global knn, scaler, class_names
    print("Loading gesture detection model...")
    if os.path.exists(MODEL_FILE):
        knn         = pickle.load(open(MODEL_FILE, "rb"))
        scaler      = pickle.load(open(SCALER_FILE, "rb"))
        class_names = json.load(open(CLASS_FILE, "r"))
        print("Model loaded successfully.")
        print("Classes:", class_names)
    else:
        print("ERROR: Model not found. Run retrain.py first.")

reload_model()

def predict_from_landmarks(landmarks):
    """
    Accept landmarks directly from the browser (MediaPipe JS output).
    landmarks: list of 21 dicts with keys x, y, z
    Returns: (gesture_name, confidence) or (None, 0)
    """
    global knn, scaler, class_names
    if knn is None or scaler is None:
        return None, 0
    if not landmarks or len(landmarks) != 21:
        return None, 0

    features = []
    for lm in landmarks:
        features.append(lm["x"])
        features.append(lm["y"])
        features.append(lm["z"])

    features    = np.array(features).reshape(1, -1)
    features    = scaler.transform(features)
    prediction  = knn.predict(features)[0]
    probs       = knn.predict_proba(features)[0]
    confidence  = np.max(probs) * 100
    gesture_name = class_names[prediction]
    return gesture_name, confidence

# detect_gesture kept as a stub so nothing else breaks if imported
def detect_gesture(frame):
    return None, 0