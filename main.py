from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import threading
import time
import json
import os
import csv

from gesture_detector import detect_gesture, predict_from_landmarks, reload_model, CONFIDENCE_THRESHOLD
from action_executor import execute_action, load_actions, update_action, remove_action
import retrain


app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

current_gesture = None
current_confidence = 0
system_running = False
global_confidence_threshold = CONFIDENCE_THRESHOLD

DATASET_DIR = "datasets"
CSV_FILE = os.path.join(DATASET_DIR, "gesture_landmarks.csv")
CONFIG_FILE = os.path.join(DATASET_DIR, "gesture_config.json")

def update_config(gesture):
    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR)
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
        except json.JSONDecodeError:
            config = {"gestures": []}
    else:
        config = {"gestures": []}
    if gesture not in config["gestures"]:
        config["gestures"].append(gesture)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)

def camera_loop():
    # Camera loop is no longer used for detection.
    # Landmarks are now sent directly from the browser via /predict.
    global system_running
    print("System ready - using browser-side MediaPipe for detection")
    while system_running:
        time.sleep(1)
    print("System stopped")

@app.get("/")
def home():
    return {"message": "Gesture Backend Running"}

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/start")
def start_system():
    global system_running
    if system_running:
        return {"status": "already running"}
    system_running = True
    thread = threading.Thread(target=camera_loop, daemon=True)
    thread.start()
    return {"status": "system started"}

@app.get("/stop")
def stop_system():
    global system_running
    system_running = False
    return {"status": "system stopped"}

@app.get("/gesture")
def get_gesture():
    return {"gesture": current_gesture, "confidence": current_confidence}

@app.post("/delete_gesture")
async def delete_gesture(request: Request):
    data = await request.json()
    gesture = data.get("gesture")

    if not gesture:
        return {"status": "error", "message": "No gesture specified"}


    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            try:
                config = json.load(f)
            except json.JSONDecodeError:
                config = {"gestures": []}
        if gesture in config.get("gestures", []):
            config["gestures"].remove(gesture)
            with open(CONFIG_FILE, "w") as f:
                json.dump(config, f, indent=4)


    if os.path.exists(CSV_FILE):
        import pandas as pd
        try:
            df = pd.read_csv(CSV_FILE)
            if "label" in df.columns:
                before = len(df)
                df = df[df["label"] != gesture]
                after = len(df)
                df.to_csv(CSV_FILE, index=False)
                print(f"Deleted {before - after} samples for gesture '{gesture}'")
        except Exception as e:
            print(f"Error cleaning CSV: {e}")


    return {"status": "success", "message": f"Gesture '{gesture}' deleted"}

@app.get("/actions")
def get_actions():
    return load_actions()

@app.post("/execute/{gesture}")
def execute(gesture: str):
    execute_action(gesture)
    return {"status": "action executed"}

@app.post("/retrain")
def retrain_model():
    retrain.main()
    reload_model()
    return {"status": "model retrained"}

@app.post("/add_landmarks")
async def add_landmarks(request: Request):
    data = await request.json()
    gesture = data["gesture"]
    landmarks_list = data["landmarks"]
    update_config(gesture)
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, "w", newline="") as f:
            writer = csv.writer(f)
            header = ["label"] + [f"{coord}{i}" for i in range(21) for coord in ["x","y","z"]]
            writer.writerow(header)
    with open(CSV_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        for landmarks in landmarks_list:
            flat = [coord for lm in landmarks for coord in [lm["x"], lm["y"], lm["z"]]]
            writer.writerow([gesture] + flat)
    return {"status": "landmarks added"}

@app.post("/update_action")
async def update_action_api(request: Request):
    data = await request.json()
    gesture = data["gesture"]
    action = data["action"]
    update_action(gesture, action)
    return {"status": "action updated"}

@app.post("/remove_mapping")
async def remove_mapping_api(request: Request):
    data = await request.json()
    gesture = data.get("gesture")
    if not gesture:
        return JSONResponse({"status": "error", "message": "No gesture specified"})
    success = remove_action(gesture)
    if success:
        return {"status": "success", "message": f"Mapping for '{gesture}' removed"}
    return JSONResponse({"status": "error", "message": f"No mapping found for '{gesture}'"})


@app.get("/gestures")
def get_gestures():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            try:
                return json.load(f).get("gestures", [])
            except:
                return []
    return []

@app.post("/settings/confidence")
async def update_confidence(request: Request):
    global global_confidence_threshold
    data = await request.json()
    global_confidence_threshold = float(data["threshold"])
    return {"status": "updated"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

@app.post("/predict")
async def predict(request: Request):
    global current_gesture, current_confidence
    data = await request.json()
    landmarks = data.get("landmarks")
    gesture, confidence = predict_from_landmarks(landmarks)
    current_gesture = gesture
    current_confidence = confidence
    if gesture and confidence > global_confidence_threshold and system_running:
        execute_action(gesture)
    return {"gesture": gesture, "confidence": confidence}