import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlay", {
  statusPort: 3847,
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send("set-ignore-mouse-events", ignore),
  updateTray: (recording: boolean) =>
    ipcRenderer.send("update-tray", recording),
  setPreferredAI: (ai: string) => ipcRenderer.send("set-preferred-ai", ai),
  quitApp: () => ipcRenderer.send("quit-app"),
  getOverlayVisible: () => ipcRenderer.invoke("get-overlay-visible"),
  toggleOverlay: () => ipcRenderer.invoke("toggle-overlay"),
});
