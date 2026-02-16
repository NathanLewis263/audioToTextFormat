Stream is a headless voice dictation tool that records your speech, transcribes it with **OpenAI's Whisper large v3 turbo-**, refines it with **GPT OSS 120B** for perfect grammar and formatting, and types the result directly into whatever app you're using — VS Code, Slack, Notes, your browser, anything.

It runs as a transparent Electron overlay with a Python backend. No windows to switch to. No copy-paste. Just hold a hotkey, speak, and release.

## How It Works

```
Voice → Microphone → Groq Whisper (transcription) → GPT OSS 120B (refinement) → Clipboard → Paste
```

1. **Record** — Hold `Ctrl + Option` to start recording via `sounddevice`.
2. **Detect** — `ten-vad` filters out background noise and silence.
3. **Transcribe** — Audio is sent to Groq's Whisper endpoint for fast transcription.
4. **Refine** — Raw text is cleaned by GPT OSS 120B (grammar, punctuation, formatting).
5. **Paste** — The Electron overlay writes the text into your active app via `nut.js`.

## Features

| Feature              | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Ghost Typing**     | Text appears in your active app — no window switching                                         |
| **Push-to-Talk**     | Hold `Ctrl + Option` to record, release to transcribe                                         |
| **Hands-Free Mode**  | Toggle with `Ctrl + Option + Space` for continuous dictation                                  |
| **Smart Formatting** | Auto-fixes grammar, punctuation, markdown, and code blocks                                    |
| **Command Mode**     | Hold `Ctrl + Option + Cmd` to send your voice query to Perplexity, ChatGPT, or Grok           |
| **Editor Mode**      | Select text + command mode → the LLM rewrites your selection based on your spoken instruction |
| **Smart Dictionary** | Personal snippets that auto-expand (e.g., say "my email" → `you@example.com`)                 |
| **Speech Detection** | `ten-vad` filters silence and background noise to prevent hallucinations                      |
| **System Tray**      | Manage settings, snippets, and preferred AI from the tray menu                                |
| **WebSocket Sync**   | Real-time communication between the Python backend and Electron frontend                      |

## Architecture

```
┌───────────────────────────────┐     WebSocket (ws://127.0.0.1:3847)
│     Electron Overlay          │◄──────────────────────────────────────┐
│  • Transparent fullscreen     │                                      │
│  • Hotkey listener (uIOhook)  │     ┌────────────────────────────┐   │
│  • Ghost paste (nut.js)       │     │    Python Backend           │   │
│  • System tray (React)        │────►│  • FastAPI + WebSocket      │   │
│  • Command routing            │     │  • Groq Whisper             │   │
└───────────────────────────────┘     │  • GPT OSS 120B             │   │
                                      │  • sounddevice + ten-vad    │───┘
                                      │  • Smart dictionary         │
                                      └────────────────────────────┘
```

## Prerequisites

- **macOS** (required — uses Accessibility APIs and `portaudio`)
- **Python 3.10+**
- **Node.js 18+**
- **Groq API Key** — [Get one here](https://console.groq.com/keys)
- **portaudio** — required for microphone access:
  ```bash
  brew install portaudio
  ```

## Installation

```bash
# Clone
git clone https://github.com/nathanlewis1/audioToTextFormat.git
cd audioToTextFormat

# Backend
pip install -r backend/requirements.txt

# Frontend
cd overlay
npm install
cd ..
```

Create a `.env` file in the project root:

```
GROQ_API_KEY=gsk_your_key_here
```

## Usage

Start both processes:

```bash
# Terminal 1 — Backend
cd backend
python3 main.py

# Terminal 2 — Overlay
cd overlay
npm run dev
```

### Hotkeys

| Shortcut                   | Action                                               |
| -------------------------- | ---------------------------------------------------- |
| Hold `Ctrl + Option`       | Push-to-talk — record while held                     |
| Release `Ctrl` or `Option` | Stop recording and transcribe                        |
| `Ctrl + Option + Space`    | Toggle hands-free mode                               |
| `Ctrl + Option + Cmd`      | Command mode — send voice to AI / edit selected text |

### Command Mode

When you activate command mode (`Ctrl + Option + Cmd`), Stream checks if you have text selected:

- **Text selected** → Editor mode. Your spoken instruction is applied to the selected text (e.g., _"make this a bullet list"_, _"fix the grammar"_).
- **No text selected** → Browser mode. Your spoken query opens in your preferred AI (Perplexity, ChatGPT, or Grok).

## Project Structure

```
audioToTextFormat/
├── backend/
│   ├── main.py              # Entry point — starts engine + API server
│   ├── voice_engine.py      # Audio pipeline: record → transcribe → refine → output
│   ├── server.py            # FastAPI + WebSocket server
│   ├── commands.py           # Smart dictionary manager
│   ├── templates/
│   │   └── system.md        # LLM system prompt for text refinement
│   └── requirements.txt
├── overlay/
│   ├── src/
│   │   ├── main.ts          # Electron main process — windows, tray, WebSocket
│   │   ├── preload.ts       # Context bridge for renderer
│   │   ├── main/
│   │   │   ├── hotkeys.ts   # Global hotkey listener (uIOhook)
│   │   │   └── commands.ts  # Command routing, clipboard, ghost-paste
│   │   ├── App.tsx          # React overlay UI
│   │   └── components/      # Tray window UI (settings, dictionary, status)
│   └── package.json
├── .env                     # API keys (not committed)
└── README.md
```

## Permissions (macOS)

Stream needs **Accessibility** access to simulate keyboard shortcuts and paste text:

1. Open **System Settings** → **Privacy & Security** → **Accessibility**.
2. Enable your terminal app (Terminal, iTerm, VS Code, etc.).
3. Restart the terminal after granting access.
