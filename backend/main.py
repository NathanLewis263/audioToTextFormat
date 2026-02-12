
import os
import threading
import logging
import time
from dotenv import load_dotenv

from voice_engine import VoiceEngine
from server import run_status_server, STATUS_SERVER_PORT

# --- Setup & Configuration ---
load_dotenv()

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
        args=(engine,),
        daemon=True
    ).start()

    print(f"Stream Dictation Ready (Backend Mode)")
    print(f"   • Application is controlled via Electron Overlay")
    print(f"   • Ctrl+C to Exit\n")
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting...")

if __name__ == "__main__":
    main()
