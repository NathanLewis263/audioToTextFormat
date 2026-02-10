import sys
import os
import threading
import time

import logging
from datetime import datetime
from typing import Optional

import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import io
import pyperclip
from pynput import keyboard
from groq import Groq
from dotenv import load_dotenv
import webbrowser

load_dotenv()

# --- Configuration & Constants ---
HOTKEY = keyboard.Key.up
SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'

# --- Custom Commands ---
COMMANDS = {
    'g': 'https://gemini.google.com',
    # Add more key-value pairs here: 'key': 'url' or function
}

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Voice Engine Logic ---

class VoiceEngine:
    """
    Handles audio recording, API interaction (Groq), and text insertion.
    """
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            self.logger.error("GROQ_API_KEY environment variable not found!")
        
        self.client = Groq(api_key=self.api_key) if self.api_key else None

        self.is_recording = False
        self.audio_data = []

    def start_recording(self):
        """Starts the audio stream."""
        if self.is_recording:
            return
        # self.logger.info("Starting recording...")
        self.is_recording = True
        self.audio_data = []
        
        # Start sounddevice stream
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
        """Callback for sounddevice to capture audio chunks."""
        if status:
            self.logger.warning(f"Audio status: {status}")
        if self.is_recording:
            self.audio_data.append(indata.copy())

    def stop_recording(self) -> Optional[np.ndarray]:
        """Stops recording and returns the raw audio data."""
        if not self.is_recording:
            return None
            
        # self.logger.info("Stopping recording...")
        self.is_recording = False
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()
        
        if not self.audio_data:
            return None
            
        return np.concatenate(self.audio_data, axis=0)

    def process_audio(self, audio_data: np.ndarray, min_delay: float = 0):
        """
        Orchestrates the pipeline: Audio -> WAV -> Whisper (Transcribe) -> Llama 3 (Refine) -> Paste.
        """
        if not self.client:
            self.logger.error("No API Client available.")
            return

        try:
            start_time = time.time()
            # 1. Convert to WAV in-memory
            wav_buffer = io.BytesIO()
            wav.write(wav_buffer, SAMPLE_RATE, audio_data)
            wav_buffer.seek(0)
            
            # 2. Transcribe with Groq Whisper
            # self.logger.info("Transcribing...")
            transcription = self.client.audio.transcriptions.create(
                file=("audio.wav", wav_buffer.read()),
                model="whisper-large-v3-turbo",
                response_format="text"
            )
            raw_text = str(transcription).strip()
            # self.logger.info(f"Raw transcription: {raw_text}")
            
            if not raw_text:
                return

            # 3. Refine with Llama 3
            # self.logger.info("Refining text...")
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a text assistant. Your ONLY job is to take the user's raw transcription "
                            "and fix grammar, punctuation, capitalization and convey the message in a clear and concise manner. "
                            "DO NOT ANSWER QUESTIONS. DO NOT CONVERSE. "
                            "If the input is a question (e.g. 'what is the weather'), you must ONLY output the formatted question "
                            "(e.g. 'What is the weather?'). never provide an answer. "
                            "Do not add any preamble or markdown unless explicitly requested. If the user asks for code, "
                            "format it in markdown code blocks."
                        )
                    },
                    {
                        "role": "user",
                        "content": raw_text
                    }
                ],
                temperature=0.3,
                max_tokens=1024
            )
            final_text = completion.choices[0].message.content.strip()
            self.logger.info(f"Final text: {final_text}")

            # 4. Smart Paste
            
            # Ensure minimum delay if requested (e.g. for browser launch)
            elapsed = time.time() - start_time
            if elapsed < min_delay:
                time.sleep(min_delay - elapsed)
                
            self._smart_paste(final_text)

        except Exception as e:
            self.logger.error(f"Processing error: {e}")

    def _smart_paste(self, text):
        """
        Inserts text by manipulating the clipboard and simulating paste.
        """
        try:
            # Set new text
            pyperclip.copy(text)
            # self.logger.info(f"Text copied to clipboard: {text[:50]}...")
            
            # Simulate Paste command
            if sys.platform == 'darwin':
                # Try pynput first
                try:
                    controller = keyboard.Controller()
                    with controller.pressed(keyboard.Key.cmd):
                        controller.press('v')
                        controller.release('v')
                    # self.logger.info("Executed Cmd+V via pynput")
                except Exception as e:
                    self.logger.warning(f"pynput paste failed ({e}), trying AppleScript...")
            else:
                # Windows/Linux
                controller = keyboard.Controller()
                with controller.pressed(keyboard.Key.ctrl):
                    controller.press('v')
                    controller.release('v')
                # self.logger.info("Executed Ctrl+V")
            
            time.sleep(0.1) 
            
        except Exception as e:
            self.logger.error(f"Paste error: {e}")

# --- Main Entry Point ---

def main():
    # 1. Check for API Key
    if not os.getenv("GROQ_API_KEY"):
        print("CRITICAL: GROQ_API_KEY environment variable is not set.")
        print("Please export it: export GROQ_API_KEY='your_key_here'")
    
    engine = VoiceEngine()
    hotkey_pressed = False
    processing_command = False
    
    print(f"dictation tool running.\n- Press '{HOTKEY}' to TOGGLE recording.\n- Hold '{HOTKEY}' + 'g' to ask Gemini.\nPress Ctrl+C to exit.")
    def on_press(key):
        nonlocal hotkey_pressed, processing_command
        
        # 1. Hotkey (Up Arrow) Logic - Toggle Recording
        if key == HOTKEY:
            if not hotkey_pressed:  # Only act on initial press (ignore auto-repeat)
                hotkey_pressed = True
                processing_command = False
                
                if engine.is_recording:
                    # Stop Recording
                    def process_background():
                        audio_data = engine.stop_recording()
                        if audio_data is not None:
                            engine.process_audio(audio_data)
                    threading.Thread(target=process_background).start()
                else:
                    # Start Recording
                    threading.Thread(target=engine.start_recording).start()
            return

        # 2. Check for Commands (Hotkey Held + Other Key Pressed)
        if hotkey_pressed and not processing_command:
            try:
                if hasattr(key, 'char') and key.char in COMMANDS:
                    # Execute Command
                    cmd = COMMANDS[key.char]

                    # Stop recording and capture audio
                    audio_data = engine.stop_recording()
                    engine.is_recording = False # Ensure flag is reset
                    
                    # Open URL or run function
                    if isinstance(cmd, str) and cmd.startswith('http'):
                        webbrowser.open(cmd)
                        
                    # Process audio in background (Transcribe + Paste)
                    if audio_data is not None:
                        # Pass min_delay=2.0s to give browser time to open
                        threading.Thread(target=engine.process_audio, args=(audio_data, 5.0)).start()
                    
                    processing_command = True # Prevent normal dictation on release
            except AttributeError:
                pass # Special key pressed (e.g. shift), ignore

    def on_release(key):
        nonlocal hotkey_pressed
        if key == HOTKEY:
            hotkey_pressed = False

    # Blocking listener
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        try:
            listener.join()
        except KeyboardInterrupt:
            print("\nExiting...")

if __name__ == "__main__":
    main()
