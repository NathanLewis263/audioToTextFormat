import sys
import os
import threading
import logging
import webbrowser
from pynput import keyboard
from dotenv import load_dotenv

from voice_engine import VoiceEngine
from commands import command_manager
from server import run_status_server, STATUS_SERVER_PORT

# --- Setup & Configuration ---
load_dotenv()

# Constants
HOTKEY = keyboard.Key.ctrl_l
HOTKEY_DISPLAY = "Ctrl left"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# --- Main Application Loop ---
def main():
    if not os.getenv("GROQ_API_KEY"):
        print("\n❌ CRITICAL: GROQ_API_KEY is missing from .env\n")
        return

    engine = VoiceEngine()
    
    # Start the Overlay Status API in the background
    threading.Thread(
        target=run_status_server,
        args=(engine, STATUS_SERVER_PORT, HOTKEY_DISPLAY),
        daemon=True
    ).start()

    print(f"Stream Dictation Ready")
    print(f"   • Press '{HOTKEY_DISPLAY}' to Toggle Recording")
    print(f"   • Hold '{HOTKEY_DISPLAY}' + 'g' to ask Gemini")
    print(f"   • Ctrl+C to Exit\n")

    # State tracking
    state = {
        "hotkey_pressed": False,
        "processing_command": False
    }

    def on_press(key):
        # 1. Main Hotkey Logic
        if key == HOTKEY:
            if not state["hotkey_pressed"]:
                state["hotkey_pressed"] = True
                state["processing_command"] = False
                
                # Toggle Recording
                if engine.is_recording:
                    # Stop & Process
                    threading.Thread(target=lambda: engine.process_audio(engine.stop_recording())).start()
                else:
                    # Start
                    threading.Thread(target=engine.start_recording).start()
            return

        # 2. Command Shortcuts (Hotkey + Key)
        if state["hotkey_pressed"] and not state["processing_command"]:
            try:
                # Fetch latest commands from manager
                current_commands = command_manager.get_commands()
                if hasattr(key, 'char') and key.char in current_commands:
                    cmd_key = key.char
                    cmd_value = current_commands[cmd_key]
                    
                    # Stop recording, ignore that audio for dictation
                    audio_data = engine.stop_recording()
                    
                    # Execute Command
                    if isinstance(cmd_value, str) and cmd_value.startswith('http'):
                        webbrowser.open(cmd_value)
                    
                    # Process audio for the command (e.g. prompt for Gemini)
                    # We add a delay to let the browser open
                    if audio_data is not None:
                        threading.Thread(target=engine.process_audio, args=(audio_data, 2.0)).start()
                    
                    state["processing_command"] = True
            except AttributeError:
                pass

    def on_release(key):
        if key == HOTKEY:
            state["hotkey_pressed"] = False

    # Start Keyboard Listener
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        try:
            listener.join()
        except KeyboardInterrupt:
            print("\nExiting...")

if __name__ == "__main__":
    main()
