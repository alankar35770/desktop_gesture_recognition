import cv2
import mediapipe as mp
import pickle
import json
import numpy as np
import os

MODELS_DIR = "models"

MODEL_FILE = os.path.join(MODELS_DIR, "gesture_knn_model.pkl")
SCALER_FILE = os.path.join(MODELS_DIR, "gesture_scaler.pkl")
CLASS_FILE = os.path.join(MODELS_DIR, "class_names_knn.json")

CONFIDENCE_THRESHOLD = 60

print("Loading gesture detection model...")

if not os.path.exists(MODEL_FILE):
    print("ERROR: Model not found. Run retrain.py first.")
    # Do NOT exit here - allow dashboard to continue
    # exit()

knn = None
scaler = None
class_names = []

if os.path.exists(MODEL_FILE):
    knn = pickle.load(open(MODEL_FILE, "rb"))
    scaler = pickle.load(open(SCALER_FILE, "rb"))
    class_names = json.load(open(CLASS_FILE, "r"))
    print("Model loaded successfully.")
    print("Classes:", class_names)
else:
    print("No model available yet - train first via dashboard")

mp_hands = mp.solutions.hands

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.75
)

mp_draw = mp.solutions.drawing_utils

def detect_gesture(frame):
    global knn, scaler, class_names
    if knn is None or scaler is None:
        return None, 0

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)
    if not results.multi_hand_landmarks:
        return None, 0

    hand_landmarks = results.multi_hand_landmarks[0]
    features = []
    for lm in hand_landmarks.landmark:
        features.append(lm.x)
        features.append(lm.y)
        features.append(lm.z)
    features = np.array(features).reshape(1, -1)
    features = scaler.transform(features)
    prediction = knn.predict(features)[0]
    probabilities = knn.predict_proba(features)[0]
    confidence = np.max(probabilities) * 100
    gesture_name = class_names[prediction]
    return gesture_name, confidence

def reload_model():
    global knn, scaler, class_names
    if os.path.exists(MODEL_FILE):
        knn = pickle.load(open(MODEL_FILE, "rb"))
        scaler = pickle.load(open(SCALER_FILE, "rb"))
        class_names = json.load(open(CLASS_FILE, "r"))
        print("Model reloaded successfully.")
    else:
        print("No model file found - cannot reload")

reload_model()

if __name__ == "__main__":
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot access camera")
    else:
        print("\nPress Q to quit")
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            gesture, confidence = detect_gesture(frame)
            text = f"{gesture} ({confidence:.1f}%)" if gesture and confidence >= CONFIDENCE_THRESHOLD else "No gesture detected"
            color = (0, 255, 0) if gesture and confidence >= CONFIDENCE_THRESHOLD else (0, 0, 255)
            cv2.putText(frame, text, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            cv2.imshow("Gesture Detection", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    cap.release()
    cv2.destroyAllWindows()