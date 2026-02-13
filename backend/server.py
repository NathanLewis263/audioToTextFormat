from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from commands import command_manager
from pydantic import BaseModel
import threading

STATUS_SERVER_PORT = 3847

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class Item(BaseModel):
    key: str
    value: str

def run_status_server(engine_ref):
    """
    Runs a lightweight FastAPI server.
    The Electron overlay polls this for recording state and available commands.
    """

    @app.get("/status")
    def status():
        # Get command names/urls for display
        cmds_display = {}
        # Fetch fresh commands from manager
        current_cmds = command_manager.get_commands()
        for k, v in current_cmds.items():
            if isinstance(v, str):
                cmds_display[k] = v
            else:
                cmds_display[k] = getattr(v, "__name__", str(v))

        return {
            "recording": engine_ref.is_recording,
            "processing": getattr(engine_ref, "is_processing", False),
            "hotkey": "Ctrl Left",
            "commands": cmds_display,
            "snippets": command_manager.get_snippets()
        }
    

    @app.post("/commands")
    def add_command(item: Item):
        command_manager.add_command(item.key, item.value)
        return {"status": "ok"}

    @app.delete("/commands/{key}")
    def delete_command(key: str):
        command_manager.remove_command(key)
        return {"status": "ok"}

    @app.post("/snippets")
    def add_snippet(item: Item):
        command_manager.add_snippet(item.key, item.value)
        return {"status": "ok"}

    @app.delete("/snippets/{key}")
    def delete_snippet(key: str):
        command_manager.remove_snippet(key)
        return {"status": "ok"}
    
    @app.post("/action/start")
    def action_start():
        with engine_ref.lock:
            if not engine_ref.is_recording:
                engine_ref.start_recording()
                return {"status": "ok", "recording": True}
            return {"status": "ignored", "recording": True}

    @app.post("/action/stop")
    def action_stop():
        with engine_ref.lock:
            if engine_ref.is_recording:
                audio_data = engine_ref.stop_recording()
                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()
                return {"status": "ok", "recording": False, "processing": True}
            return {"status": "ignored", "recording": False, "processing": False}

    @app.post("/action/toggle")
    def action_toggle():
        """Toggle recording state."""
        # Use the engine's lock to prevent race conditions
        with engine_ref.lock:
            if engine_ref.is_recording:
                # Stop - Call synchronously to update state immediately
                audio_data = engine_ref.stop_recording()
                # Spawn processing in background thread
                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()
                
                return {"status": "ok", "recording": False, "processing": True}
            else:
                # Start - Call synchronously
                engine_ref.start_recording()
                return {"status": "ok", "recording": True, "processing": False}

    @app.get("/consume_text")
    def consume_text():
        """Returns the oldest generated text and removes it from queue."""
        with engine_ref.lock:
            if engine_ref.generated_text:
                text = engine_ref.generated_text.pop(0)
                return {"text": text}
            return {"text": None}

    @app.post("/action/trigger/{key}")
    def action_trigger(key: str):
        """Trigger a command by key."""
        # This logic is moved from main.py
        current_cmds = command_manager.get_commands()
        if key in current_cmds:
            cmd_value = current_cmds[key]
            
            # Stop recording if active
            audio_data = None
            if engine_ref.is_recording:
                audio_data = engine_ref.stop_recording()
            
            # Execute Command
            if isinstance(cmd_value, str) and cmd_value.startswith('http'):
                import webbrowser
                webbrowser.open(cmd_value)
            
            # Process audio if captured
            if audio_data is not None:
                threading.Thread(target=engine_ref.process_audio, args=(audio_data, 2.0)).start()
                
            return {"status": "executed", "command": key}
        return {"status": "not_found"}
    
    uvicorn.run(app, host="127.0.0.1", port=STATUS_SERVER_PORT, log_level="warning")


