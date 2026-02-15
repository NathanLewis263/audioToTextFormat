from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from commands import command_manager
from pydantic import BaseModel
import threading
import json
import asyncio
from typing import List

STATUS_SERVER_PORT = 3847

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

class Item(BaseModel):
    key: str
    value: str

class EditorCommand(BaseModel):
    instruction: str
    selected_text: str

def run_status_server(engine_ref):
    """
    Runs a lightweight FastAPI server.
    The Electron overlay polls this for recording state and available commands.
    """
    
    # --- WebSocket Endpoint ---
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            # Send initial state on connection
            await websocket.send_json({
                "type": "status_update",
                "data": {
                    "recording": engine_ref.is_recording,
                    "processing": getattr(engine_ref, "is_processing", False),
                    "hotkey": "Ctrl Left",
                    "snippets": command_manager.get_snippets()
                }
            })
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    action = message.get("action")

                    if action == "start":
                        with engine_ref.lock:
                            if not engine_ref.is_recording:
                                engine_ref.start_recording()
                    
                    elif action == "stop":
                        with engine_ref.lock:
                            if engine_ref.is_recording:
                                audio_data = engine_ref.stop_recording()
                                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()

                    elif action == "toggle":
                        with engine_ref.lock:
                            if engine_ref.is_recording:
                                audio_data = engine_ref.stop_recording()
                                threading.Thread(target=lambda: engine_ref.process_audio(audio_data)).start()
                            else:
                                engine_ref.start_recording()
                                
                    elif action == "editor_command":
                        instruction = message.get("instruction")
                        selected_text = message.get("selected_text")
                        if instruction and selected_text:
                            threading.Thread(target=lambda: engine_ref.process_editor_command(selected_text, instruction)).start()
                            
                except json.JSONDecodeError:
                    print(f"Invalid JSON received: {data}")
                    
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    # --- Async Loop Capture & Callbacks ---
    @app.on_event("startup")
    async def startup_event():
        running_loop = asyncio.get_running_loop()
        def bridge_to_async(topic, data):
            asyncio.run_coroutine_threadsafe(manager.broadcast({"type": topic, "data": data}), running_loop)
                
        engine_ref.on_status_change = lambda data: bridge_to_async("status_update", data)
        engine_ref.on_text_generated = lambda data: bridge_to_async("text_generated", data)

    @app.post("/snippets")
    def add_snippet(item: Item):
        command_manager.add_snippet(item.key, item.value)
        return {"status": "ok"}

    @app.delete("/snippets/{key}")
    def delete_snippet(key: str):
        command_manager.remove_snippet(key)
        return {"status": "ok"}
    
    uvicorn.run(app, host="127.0.0.1", port=STATUS_SERVER_PORT, log_level="warning")


