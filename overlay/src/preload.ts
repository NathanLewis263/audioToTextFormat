import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlay", {
  statusPort: 3847,
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send("set-ignore-mouse-events", ignore),
  updateTray: (recording: boolean) =>
    ipcRenderer.send("update-tray", recording),
  quitApp: () => ipcRenderer.send("quit-app"),
  toggleOverlay: () => ipcRenderer.send("toggle-overlay"),
});
