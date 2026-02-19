import ctypes
ctypes.windll.user32.SetProcessDPIAware()
from datetime import datetime
import pyautogui
import subprocess
import json
import os

ACTION_FILE = "gesture_actions.json"

DEFAULT_ACTIONS = {
    "left": "previous_window",
    "right": "next_window",
    "up": "volume_up",
    "down": "volume_down",
    "palm": "play_pause",
    "peace": "screenshot",
    "yo": "toggle_system",
    "thumbs_up": "lock_screen",
    "thumbs_down": "mute_volume",
    "fist": "open_explorer",
    "point": "open_terminal"
}

def initialize_actions():
    if not os.path.exists(ACTION_FILE):
        with open(ACTION_FILE, "w") as f:
            json.dump(DEFAULT_ACTIONS, f, indent=4)

def load_actions():
    initialize_actions()
    with open(ACTION_FILE, "r") as f:
        actions = json.load(f)
    return actions

def update_action(gesture, action):
    actions = load_actions()
    actions[gesture] = action
    with open(ACTION_FILE, "w") as f:
        json.dump(actions, f, indent=4)

def execute_action(gesture):
    actions = load_actions()
    if gesture not in actions:
        print(f"No action assigned to {gesture}")
        return
    action = actions[gesture]
    print(f"Executing action: {action}")

    if action == "screenshot":
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{timestamp}.png"
        path = os.path.join(os.getcwd(), filename)

        img = pyautogui.screenshot()
        img.save(path)

        print(f"Screenshot saved to {path}")

    elif action == "volume_up":
        pyautogui.press("volumeup")
    elif action == "volume_down":
        pyautogui.press("volumedown")
    elif action == "play_pause":
        pyautogui.press("playpause")
    elif action == "next_window":
        pyautogui.hotkey("alt", "tab")
    elif action == "previous_window":
        pyautogui.hotkey("alt", "shift", "tab")
    elif action == "open_chrome":
        subprocess.Popen("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    elif action == "toggle_system":
        print("System toggle requested")
    elif action == "lock_screen":
        pyautogui.hotkey("win", "l")
    elif action == "mute_volume":
        pyautogui.press("volumemute")
    elif action == "open_explorer":
        subprocess.Popen("explorer")
    elif action == "open_terminal":
        subprocess.Popen("cmd.exe")
    else:
        print("Unknown action")

if __name__ == "__main__":
    initialize_actions()
    actions = load_actions()
    print("Available gestures:")
    for gesture in actions:
        print(gesture)
    gesture = input("\nEnter gesture to test: ")
    execute_action(gesture)