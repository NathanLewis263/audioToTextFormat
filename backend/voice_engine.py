import logging
import os
import time
import io
import sys
import pathlib
import subprocess
from typing import Optional
from pathlib import Path

# Third-party libraries
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import pyperclip
from pynput import keyboard
from groq import Groq

# Constants (moved from main.py)
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'

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
            # Resolves to absolute path relative to THIS file's location
            # If this file is in backend/, then templates/ is sibling
            system_prompt_path = Path(__file__).resolve().parent / "templates" / "system.md"

            if not system_prompt_path.exists():
                self.logger.warning(f"File not found: {system_prompt_path}")
                return "You are a helpful assistant."

            with open(system_prompt_path, "r") as f:
                return f.read().strip()
        except Exception as e:
            self.logger.warning(f"Could not read system.md: {e}")
            return "You are a helpful assistant."

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
