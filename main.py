import sys
import os
import threading
import time
import io
import logging
import pathlib
import webbrowser
from typing import Optional

# Third-party libraries
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import pyperclip
import uvicorn
from pynput import keyboard
from groq import Groq
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# --- Setup & Configuration ---
load_dotenv()

# Constants
HOTKEY = keyboard.Key.ctrl_l
HOTKEY_DISPLAY = "Ctrl left"
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'
STATUS_SERVER_PORT = 3847

# Custom Commands
COMMANDS = {
    'g': 'https://gemini.google.com',
}

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# --- Status Server (for Electron Overlay) ---
def run_status_server(engine_ref, port: int = STATUS_SERVER_PORT):
    """
    Runs a lightweight FastAPI server.
    The Electron overlay polls this for recording state and available commands.
    """
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware, 
        allow_origins=["*"], 
        allow_methods=["*"], 
        allow_headers=["*"]
    )

    @app.get("/status")
    def status():
        # Get command names/urls for display
        cmds_display = {}
        for k, v in COMMANDS.items():
            if isinstance(v, str):
                cmds_display[k] = v
            else:
                cmds_display[k] = getattr(v, "__name__", str(v))

        return {
            "recording": engine_ref.is_recording,
            "hotkey": HOTKEY_DISPLAY,
            "commands": cmds_display,
        }

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


# --- Voice Engine (Core Logic) ---
class VoiceEngine:
    """
    Manages the audio pipeline:
    1. Record Audio (sounddevice)
    2. Transcribe (Groq Whisper)
    3. Refine (Llama 3 / GPT OSS)
    4. Paste (pyperclip + keyboard simulation)
    """
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.api_key = os.getenv("GROQ_API_KEY")
        
        if not self.api_key:
            self.logger.error("GROQ_API_KEY environment variable not found!")
        
        self.client = Groq(api_key=self.api_key) if self.api_key else None
        self.is_recording = False
        self.audio_data = []

    def get_system_prompt(self):
        """Loads the AI persona/instructions from templates/system.md"""
        try:
            system_prompt_path = Path(__file__).resolve().parent / "templates" / "system.md"

            if not system_prompt_path.exists():
                self.logger.warning(f"File not found: {system_prompt_path}")

            with open(system_prompt_path, "r") as f:
                return f.read().strip()
        except Exception as e:
            self.logger.warning(f"Could not read system.md:")
    
    def start_recording(self):
        """Begins capturing audio from the microphone."""
        if self.is_recording:
            return
            
        self.is_recording = True
        self.audio_data = []
        
        try:
            self.stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype=DTYPE,
                callback=self._audio_callback
            )
            self.stream.start()
        except Exception as e:
            self.logger.error(f"Failed to start audio stream: {e}")
            self.is_recording = False

    def _audio_callback(self, indata, frames, time, status):
        """Internal callback for sounddevice."""
        if status:
            self.logger.warning(f"Audio status: {status}")
        if self.is_recording:
            self.audio_data.append(indata.copy())

    def stop_recording(self) -> Optional[np.ndarray]:
        """Stops capturing and returns the full audio buffer."""
        if not self.is_recording:
            return None
            
        self.is_recording = False
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()
        
        if not self.audio_data:
            return None
            
        return np.concatenate(self.audio_data, axis=0)

    def process_audio(self, audio_data: np.ndarray, min_delay: float = 0):
        """
        The main processing pipeline. 
        Runs in a separate thread to not block the UI/Hotkey listener.
        """
        if not self.client:
            self.logger.error("No API Client available.")
            return

        try:
            start_time = time.time()
            
            # 1. Convert raw audio to WAV
            wav_buffer = io.BytesIO()
            wav.write(wav_buffer, SAMPLE_RATE, audio_data)
            wav_buffer.seek(0)
            
            # 2. Transcribe using Groq Whisper
            transcription = self.client.audio.transcriptions.create(
                file=("audio.wav", wav_buffer.read()),
                model="whisper-large-v3-turbo",
                response_format="text",
                language="en"
            )
            raw_text = str(transcription).strip()
            self.logger.info(f"Raw: {raw_text}")
            
            if not raw_text:
                return

            # 3. Refine/Format using LLM
            completion = self.client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": raw_text}
                ],
                temperature=0.0,
                max_tokens=1024
            )
            final_text = completion.choices[0].message.content.strip()
            self.logger.info(f"Final: {final_text}")

            # 4. Wait if needed (e.g., for browser to open)
            elapsed = time.time() - start_time
            if elapsed < min_delay:
                time.sleep(min_delay - elapsed)
                
            # 5. Insert Text
            self._smart_paste(final_text)

        except Exception as e:
            self.logger.error(f"Processing error: {e}")

    def _smart_paste(self, text):
        """Copies text to clipboard and simulates Paste (Cmd+V / Ctrl+V)."""
        try:
            pyperclip.copy(text)
            
            if sys.platform == 'darwin':
                self._paste_macos(text)
            else:
                self._paste_generic()
            
            time.sleep(0.1) 
        except Exception as e:
            self.logger.error(f"Paste error: {e}")

    def _paste_macos(self, text):
        """Tries pynput first, falls back to AppleScript."""
        try:
            controller = keyboard.Controller()
            with controller.pressed(keyboard.Key.cmd):
                controller.press('v')
                controller.release('v')
        except Exception:
            self._apple_script_paste(text)

    def _paste_generic(self):
        """Windows/Linux paste."""
        controller = keyboard.Controller()
        with controller.pressed(keyboard.Key.ctrl):
            controller.press('v')
            controller.release('v')

    def _apple_script_paste(self, text):
        """Robust fallback for macOS if pynput permissions fail."""
        try:
            import subprocess
            safe_text = text.replace('"', '\\"')
            script = f'''
            set the clipboard to "{safe_text}"
            tell application "System Events"
                keystroke "v" using command down
            end tell
            '''
            subprocess.run(['osascript', '-e', script], check=True)
            self.logger.info("Pasted via AppleScript")
        except Exception as e:
            self.logger.error(f"AppleScript failed: {e}")


# --- Main Application Loop ---
def main():
    if not os.getenv("GROQ_API_KEY"):
        return

    engine = VoiceEngine()
    
    # Start the Overlay Status API in the background
    threading.Thread(
        target=run_status_server,
        args=(engine, STATUS_SERVER_PORT),
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
                if hasattr(key, 'char') and key.char in COMMANDS:
                    cmd_key = key.char
                    cmd_value = COMMANDS[cmd_key]
                    
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
