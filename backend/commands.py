import json
import os
import logging
from pathlib import Path

# File to store commands/snippets
DATA_FILE = Path("user_data.json")

DEFAULT_DATA = {
    "snippets": {
    }
}

class CommandManager:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.data = self._load_data()

    def _load_data(self):
        if not DATA_FILE.exists():
            self._save_data(DEFAULT_DATA)
            return DEFAULT_DATA
        
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load data: {e}")
            return DEFAULT_DATA

    def _save_data(self, data):
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save data: {e}")

    def get_snippets(self):
        return self.data.get("snippets", {})

    def add_snippet(self, key, value):
        self.data.setdefault("snippets", {})[key] = value
        self._save_data(self.data)

    def remove_snippet(self, key):
        del self.data["snippets"][key]
        self._save_data(self.data)

command_manager = CommandManager()
