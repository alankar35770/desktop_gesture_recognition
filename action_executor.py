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

def remove_action(gesture):
    actions = load_actions()
    if gesture in actions:
        del actions[gesture]
        with open(ACTION_FILE, "w") as f:
            json.dump(actions, f, indent=4)
        return True
    return False

def execute_action(gesture):
    actions = load_actions()
    if gesture not in actions:
        print(f"No action assigned to {gesture}")
        return
    action = actions[gesture]
    print(f"Executing action: {action}")

    # ── Media ──
    if action == "play_pause":
        pyautogui.press("playpause")
    elif action == "next_track":
        pyautogui.press("nexttrack")
    elif action == "prev_track":
        pyautogui.press("prevtrack")
    elif action == "stop_media":
        pyautogui.press("stop")
    elif action == "mute" or action == "mute_volume":
        pyautogui.press("volumemute")
    elif action == "volume_up":
        pyautogui.press("volumeup")
    elif action == "volume_down":
        pyautogui.press("volumedown")

    # ── Window ──
    elif action == "next_window":
        pyautogui.hotkey("alt", "tab")
    elif action == "prev_window" or action == "previous_window":
        pyautogui.hotkey("alt", "shift", "tab")
    elif action == "minimize_window":
        pyautogui.hotkey("win", "down")
    elif action == "maximize_window":
        pyautogui.hotkey("win", "up")
    elif action == "close_window":
        pyautogui.hotkey("alt", "f4")
    elif action == "snap_left":
        pyautogui.hotkey("win", "left")
    elif action == "snap_right":
        pyautogui.hotkey("win", "right")

    # ── Desktop ──
    elif action == "screenshot":
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{timestamp}.png"
        path = os.path.join(os.getcwd(), filename)
        img = pyautogui.screenshot()
        img.save(path)
        print(f"Screenshot saved to {path}")
    elif action == "show_desktop":
        pyautogui.hotkey("win", "d")
    elif action == "task_view":
        pyautogui.hotkey("win", "tab")
    elif action == "virtual_desktop_next":
        pyautogui.hotkey("ctrl", "win", "right")
    elif action == "virtual_desktop_prev":
        pyautogui.hotkey("ctrl", "win", "left")
    elif action == "open_taskbar":
        pyautogui.hotkey("win", "b")

    # ── System ──
    elif action == "lock_screen":
        pyautogui.hotkey("win", "l")
    elif action == "sleep":
        subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
    elif action == "brightness_up":
        # Uses PowerShell to increase brightness by 10%
        subprocess.Popen(["powershell", "-Command",
            "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods)"
            ".WmiSetBrightness(1,[math]::Min(100,(Get-WmiObject -Namespace root/WMI "
            "-Class WmiMonitorBrightness).CurrentBrightness+10))"])
    elif action == "brightness_down":
        subprocess.Popen(["powershell", "-Command",
            "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods)"
            ".WmiSetBrightness(1,[math]::Max(0,(Get-WmiObject -Namespace root/WMI "
            "-Class WmiMonitorBrightness).CurrentBrightness-10))"])
    elif action == "open_settings":
        subprocess.Popen(["ms-settings:"], shell=True)
    elif action == "open_terminal":
        subprocess.Popen("cmd.exe")
    elif action == "open_file_manager" or action == "open_explorer":
        subprocess.Popen("explorer")
    elif action == "open_calculator":
        subprocess.Popen("calc.exe")
    elif action == "toggle_system":
        print("System toggle requested")

    # ── Scroll ──
    elif action == "scroll_up":
        pyautogui.scroll(5)
    elif action == "scroll_down":
        pyautogui.scroll(-5)
    elif action == "scroll_left":
        pyautogui.hscroll(-5)
    elif action == "scroll_right":
        pyautogui.hscroll(5)
    elif action == "page_up":
        pyautogui.press("pageup")
    elif action == "page_down":
        pyautogui.press("pagedown")
    elif action == "scroll_top":
        pyautogui.hotkey("ctrl", "home")
    elif action == "scroll_bottom":
        pyautogui.hotkey("ctrl", "end")

    # ── Browser ──
    elif action == "browser_back":
        pyautogui.hotkey("alt", "left")
    elif action == "browser_forward":
        pyautogui.hotkey("alt", "right")
    elif action == "browser_refresh":
        pyautogui.press("f5")
    elif action == "new_tab":
        pyautogui.hotkey("ctrl", "t")
    elif action == "close_tab":
        pyautogui.hotkey("ctrl", "w")
    elif action == "next_tab":
        pyautogui.hotkey("ctrl", "tab")
    elif action == "prev_tab":
        pyautogui.hotkey("ctrl", "shift", "tab")
    elif action == "reopen_tab":
        pyautogui.hotkey("ctrl", "shift", "t")

    # ── Clipboard ──
    elif action == "copy":
        pyautogui.hotkey("ctrl", "c")
    elif action == "paste":
        pyautogui.hotkey("ctrl", "v")
    elif action == "cut":
        pyautogui.hotkey("ctrl", "x")
    elif action == "undo":
        pyautogui.hotkey("ctrl", "z")
    elif action == "redo":
        pyautogui.hotkey("ctrl", "y")
    elif action == "select_all":
        pyautogui.hotkey("ctrl", "a")

    # ── Legacy / Chrome ──
    elif action == "open_chrome":
        subprocess.Popen("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")

    else:
        print(f"Unknown action: {action}")

if __name__ == "__main__":
    initialize_actions()
    actions = load_actions()
    print("Available gestures:")
    for gesture in actions:
        print(gesture)
    gesture = input("\nEnter gesture to test: ")
    execute_action(gesture)