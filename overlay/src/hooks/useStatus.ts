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

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      ws = new WebSocket(`ws://127.0.0.1:${statusPort}/ws`);

      ws.onopen = () => {
        console.log("[useStatus] Connected");
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "status_update") {
            const data = message.data;
            setRecording(Boolean(data.recording));
            setProcessing(Boolean(data.processing));
            setHotkey(data.hotkey || "—");
            setSnippets(data.snippets);

            // Update border styles
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
          }
        } catch (e) {
          console.error("[useStatus] Error parsing message:", e);
        }
      };

      ws.onclose = () => {
        console.log("[useStatus] Disconnected. Reconnecting...");
        reconnectTimeout = setTimeout(connect, 1000);
      };

      ws.onerror = (err) => {
        console.error("[useStatus] Error:", err);
        ws?.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [statusPort]);

  return { recording, hotkey, snippets, statusPort };
};
