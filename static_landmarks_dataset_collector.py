import cv2
import mediapipe as mp
import csv
import time
import os
import json

DATASET_DIR = "datasets"
CSV_FILE = os.path.join(DATASET_DIR, "gesture_landmarks.csv")
CONFIG_FILE = os.path.join(DATASET_DIR, "gesture_config.json")

CAPTURE_INTERVAL = 0.08

SAMPLE_OPTIONS = {
    ord('1'): 50,
    ord('2'): 100,
    ord('3'): 150,
    ord('4'): 200
}

def initialize():
    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR)
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, "w", newline="") as f:
            writer = csv.writer(f)
            header = ["label"]
            for i in range(21):
                header += [f"x{i}", f"y{i}", f"z{i}"]
            writer.writerow(header)

def update_config(gesture):
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
    else:
        config = {"gestures": []}
    if gesture not in config["gestures"]:
        config["gestures"].append(gesture)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.75
)
mp_draw = mp.solutions.drawing_utils

def save_landmarks(label, landmarks):
    row = [label]
    for lm in landmarks:
        row.append(lm.x)
        row.append(lm.y)
        row.append(lm.z)
    with open(CSV_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(row)

def draw_progress_bar(frame, progress):
    h, w, _ = frame.shape
    bar_width = int(w * 0.6)
    bar_height = 30
    x = int((w - bar_width) / 2)
    y = h - 60
    filled = int(bar_width * progress)
    cv2.rectangle(frame, (x, y), (x + bar_width, y + bar_height), (50,50,50), -1)
    cv2.rectangle(frame, (x, y), (x + filled, y + bar_height), (0,255,0), -1)
    cv2.rectangle(frame, (x, y), (x + bar_width, y + bar_height), (255,255,255), 2)
    percent = int(progress * 100)
    cv2.putText(frame, f"{percent}%", (x + bar_width//2 - 30, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)

def main():
    initialize()
    gesture_name = input("\nEnter gesture name: ").strip()
    if gesture_name == "":
        print("Invalid name")
        return
    update_config(gesture_name)
    print("\nSelect sample size:")
    print("1 → 50 samples")
    print("2 → 100 samples")
    print("3 → 150 samples")
    print("4 → 200 samples")
    target_samples = None
    while True:
        choice = input("Enter choice (1/2/3/4): ").strip()
        if choice in ["1", "2", "3", "4"]:
            target_samples = {"1": 50, "2": 100, "3": 150, "4": 200}[choice]
            break
        else:
            print("Invalid choice. Try again.")
    print("\nPress SPACE to start recording")
    cap = cv2.VideoCapture(0)
    recording = False
    sample_count = 0
    last_capture = 0
    while True:
        ret, frame = cap.read()
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb)
        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            if recording:
                now = time.time()
                if now - last_capture >= CAPTURE_INTERVAL:
                    save_landmarks(gesture_name, hand_landmarks.landmark)
                    sample_count += 1
                    last_capture = now
        progress = sample_count / target_samples if target_samples else 0
        draw_progress_bar(frame, progress)
        cv2.putText(frame, f"Gesture: {gesture_name}", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)
        if not recording:
            cv2.putText(frame, "Press SPACE to start", (10,70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
        cv2.imshow("Gesture Recorder", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 32:
            recording = True
        if sample_count >= target_samples:
            break
        if key == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()
    print("\nRecording complete.")

if __name__ == "__main__":
    main()