import { app, BrowserWindow, screen, ipcMain } from "electron";
import * as path from "path";

function createOverlayWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const { width, height, x, y } = primary.bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    type: "panel",
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: false,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.setMenuBarVisibility(true);
  win.setAlwaysOnTop(true, "screen-saver", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setWindowButtonVisibility(false);

  // Load the overlay page
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    win.loadURL("http://localhost:3000");
  } else {
    // In production, we load the index.html from dist-react (configured in vite.config.ts)
    // Note: We need to ensure dist-react is correct relative path
    win.loadFile(path.join(__dirname, "..", "dist-react", "index.html"));
  }

  win.once("ready-to-show", () => {
    win.show();
    // Click-through so the overlay doesn't block the desktop; info panel is display-only
    win.setIgnoreMouseEvents(true, { forward: true });
  });

  return win;
}

app.whenReady().then(() => {
  createOverlayWindow();
});

// IPC listener to toggle mouse transparency (click-through)
ipcMain.on(
  "set-ignore-mouse-events",
  (event: any, ignore: boolean, options: any) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setIgnoreMouseEvents(ignore, { forward: true });
  },
);

app.on("window-all-closed", () => {
  app.quit();
});
