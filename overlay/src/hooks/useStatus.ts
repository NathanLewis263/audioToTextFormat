import { useState, useEffect } from "react";

export interface StatusData {
  recording: boolean;
  hotkey: string;
  commands: Record<string, string> | null;
  snippets: Record<string, string> | null;
}

export const useStatus = () => {
  const [recording, setRecording] = useState(false);
  const [hotkey, setHotkey] = useState("—");
  const [commands, setCommands] = useState<Record<string, string> | null>(null);
  const [snippets, setSnippets] = useState<Record<string, string> | null>(null);

  const statusPort = window.overlay?.statusPort || 3847;
  const POLL_MS = 200;

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${statusPort}/status`);
        const data = await res.json();
        setRecording(Boolean(data.recording));
        setHotkey(data.hotkey || "—");
        setCommands(data.commands);
        setSnippets(data.snippets);

        // Update border styles based on recording state - Global side effect
        const edges = document.querySelectorAll(".border-edge");
        edges.forEach((edge) => {
          if (data.recording) edge.classList.add("recording");
          else edge.classList.remove("recording");
        });

        // Sync tray status
        window.overlay?.updateTray?.(Boolean(data.recording));
      } catch (err) {
        setRecording(false);
        setHotkey("—");
        setCommands(null);
        setSnippets(null);
      }
    };

    const interval = setInterval(poll, POLL_MS);
    poll(); // Initial call

    return () => clearInterval(interval);
  }, [statusPort]);

  return { recording, hotkey, commands, snippets, statusPort };
};
