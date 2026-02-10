from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from commands import COMMANDS

STATUS_SERVER_PORT = 3847

app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

def run_status_server(engine_ref, port: int = STATUS_SERVER_PORT, hotkey_display: str = "Ctrl left"):
    """
    Runs a lightweight FastAPI server.
    The Electron overlay polls this for recording state and available commands.
    """

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
            "hotkey": hotkey_display,
            "commands": cmds_display,
        }
    
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


