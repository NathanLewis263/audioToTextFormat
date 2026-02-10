import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlay", {
  statusPort: 3847,
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send("set-ignore-mouse-events", ignore),
});
