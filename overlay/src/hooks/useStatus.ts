import { useState, useEffect } from "react";

export interface StatusData {
  recording: boolean;
  processing: boolean;
  hotkey: string;
  commands: Record<string, string> | null;
  snippets: Record<string, string> | null;
}

export const useStatus = () => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [hotkey, setHotkey] = useState("—");
  const [snippets, setSnippets] = useState<Record<string, string> | null>(null);

  const statusPort = window.overlay?.statusPort || 3847;
  const POLL_MS = 200;

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${statusPort}/status`);
        const data = await res.json();
        setRecording(Boolean(data.recording));
        setProcessing(Boolean(data.processing));
        setHotkey(data.hotkey || "—");
        setSnippets(data.snippets);

        // Update border styles based on recording/processing state
        const edges = document.querySelectorAll(".border-edge");
        edges.forEach((edge) => {
          if (data.recording) {
            edge.classList.add("recording");
            edge.classList.remove("processing");
          } else if (data.processing) {
            edge.classList.add("processing");
            edge.classList.remove("recording");
          } else {
            edge.classList.remove("recording", "processing");
          }
        });

        // Sync tray status
        window.overlay?.updateTray?.(Boolean(data.recording));
      } catch (err) {
        setRecording(false);
        setHotkey("—");
        setSnippets(null);
      }
    };

    const interval = setInterval(poll, POLL_MS);
    poll(); // Initial call

    return () => clearInterval(interval);
  }, [statusPort]);

  return { recording, hotkey, snippets, statusPort };
};
