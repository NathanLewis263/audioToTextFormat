from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from commands import command_manager
from pydantic import BaseModel

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

def run_status_server(engine_ref, port: int = STATUS_SERVER_PORT, hotkey_display: str = "Ctrl left"):
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
            "hotkey": hotkey_display,
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
    
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


