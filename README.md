# Stream 🎙️

**Stream** is a high-performance, headless voice dictation tool designed for speed and accuracy. It acts as a "Ghost" typist, recording your voice, transcribing it with **Groq's Whisper**, refining it with **Llama 3** (for perfect grammar and formatting), and typing the text directly into your active application.

## ✨ Features

- **🚀 Instant Transcription**: Powered by Groq's LPUs for near-real-time inference.
- **🧠 Smart Formatting**: Uses Llama 3 to fix grammar, punctuation, and format code blocks automatically.
- **👻 Ghost Typist**: Works in _any_ application (VS Code, Notes, Slack, Browser, etc.).
- **⚡ Smart Commands**: Trigger web searches or AI assistants (like Gemini) while dictating.
- **🤫 Headless**: Runs silently in the terminal with no intrusive UI.

## 🛠️ Prerequisites

- **Python 3.10+**
- **Groq API Key**: Get one [here](https://console.groq.com/keys).
- **System Dependencies**:
  - **macOS**: `portaudio` (required for microphone access).
    ```bash
    brew install portaudio
    ```

## 📦 Installation

1.  **Clone the repository**:

    ```bash
    git clone <your-repo-url>
    cd audioToTextFormat
    ```

2.  **Install Python dependencies**:

    ```bash
    pip install -r requirements.txt
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory to store your API key:
    ```bash
    echo "GROQ_API_KEY=gsk_..." > .env
    ```

## 🚀 Usage

Run the tool from your terminal:

```bash
python3 main.py
```

### 🎙️ Dictation Mode

1.  **Hold** the `Up Arrow` key.
2.  **Speak** your text or code.
3.  **Release** the key.
4.  _Stream_ will transcribe and paste the text automatically.

### 🤖 Smart Commands

Trigger special actions by holding `Up Arrow` and pressing a command key.

**Example: Ask Gemini (`G`)**

1.  Hold the `Up Arrow` key.
2.  Speak a prompt: _"Write a Python function to sort a list."_
3.  While still holding `Up`, press `G`.
4.  _Stream_ will open Google Gemini and paste your prompt.

## ⚙️ Configuration

You can customize hotkeys and commands in `main.py`:

```python
# main.py
COMMANDS = {
    'g': 'https://gemini.google.com',
    # Add your own: 'c': 'https://chatgpt.com',
}
```

## ⚠️ Troubleshooting

### "This process is not trusted!" (macOS)

If the tool records but fails to paste, or if you see a permission warning:

1.  Open **System Settings** > **Privacy & Security** > **Accessibility**.
2.  Find your terminal application (Terminal, iTerm, VS Code).
3.  Toggle the switch **ON**.
4.  Restart your terminal.
