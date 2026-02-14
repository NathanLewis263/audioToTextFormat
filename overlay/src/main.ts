import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import * as path from "path";
import {
  setupHotkeys,
  setRecordingState,
  setHandsFreeState,
} from "./main/hotkeys";
import {
  handleCommandMode,
  pasteTextWithRestore,
  setPreferredAI,
} from "./main/commands";
import { callBackend, API_URL } from "./main/api";

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
    // In production, we load the index.html from dist-react
    win.loadFile(path.join(__dirname, "..", "dist-react", "index.html"));
  }

  win.once("ready-to-show", () => {
    win.show();
    // Click-through so the overlay doesn't block the desktop; info panel is display-only
    win.setIgnoreMouseEvents(true, { forward: true });
  });

  return win;
}

let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 280,
    height: 400,
    type: "panel",
    frame: false,
    resizable: true,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trayWindow.on("blur", () => {
    if (!trayWindow?.webContents.isDevToolsOpened()) {
      trayWindow?.hide();
    }
  });

  const isDev = process.env.NODE_ENV === "development";
  const trayUrl = isDev
    ? "http://localhost:3000?window=tray"
    : `file://${path.join(__dirname, "..", "dist-react", "index.html")}?window=tray`;

  trayWindow.loadURL(trayUrl);
}

const toggleTrayWindow = () => {
  if (!trayWindow || !tray) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    const trayBounds = tray.getBounds();
    const windowBounds = trayWindow.getBounds();
    const x = Math.round(
      trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
    );
    const y = Math.round(trayBounds.y + trayBounds.height + 4);
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const finalX = Math.max(0, Math.min(x, width - windowBounds.width));
    trayWindow.setPosition(finalX, y, false);
    trayWindow.show();
    trayWindow.focus();
  }
};

function createTray() {
  const iconPath = path.join(__dirname, "..", "tray-icon.png");
  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.on("click", () => toggleTrayWindow());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Overlay",
      click: () => BrowserWindow.getAllWindows().forEach((w) => w.show()),
    },
    {
      label: "Hide Overlay",
      click: () => BrowserWindow.getAllWindows().forEach((w) => w.hide()),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("Stream Dictation: Ready");
  tray.on("right-click", () => {
    tray?.popUpContextMenu(contextMenu);
  });
}

app.whenReady().then(() => {
  createOverlayWindow();
  createTrayWindow();
  createTray();
});

ipcMain.on("update-tray", (_event, recording: boolean) => {
  if (tray) {
    tray.setToolTip(
      recording ? "Stream Dictation: Recording" : "Stream Dictation: Ready",
    );
  }
});

// IPC listener to toggle mouse transparency (click-through)
ipcMain.on("set-ignore-mouse-events", (event: any, ignore: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on("quit-app", () => {
  app.quit();
});

function getOverlayVisible(): boolean {
  const overlayWindows = BrowserWindow.getAllWindows().filter(
    (w) => w !== trayWindow,
  );
  return overlayWindows.some((w) => w.isVisible());
}

ipcMain.handle("get-overlay-visible", () => getOverlayVisible());

ipcMain.handle("toggle-overlay", () => {
  const overlayWindows = BrowserWindow.getAllWindows().filter(
    (w) => w !== trayWindow,
  );
  const anyVisible = overlayWindows.some((w) => w.isVisible());

  if (anyVisible) {
    overlayWindows.forEach((w) => w.hide());
    return false;
  } else {
    overlayWindows.forEach((w) => w.show());
    return true;
  }
});

ipcMain.on("set-preferred-ai", (_event, ai: string) => {
  setPreferredAI(ai);
});

app.on("window-all-closed", () => {
  app.quit();
});

// --- State and Config ---
let isCommandMode = false;
let isQuickCommand = false;
let isHandsFree = false;
let isRecording = false;

// --- Hotkey Integration ---
setupHotkeys({
  onStartRecording: () => {
    isRecording = true;
    setRecordingState(isRecording);
    callBackend("/action/start");
  },
  onStopRecording: () => {
    isRecording = false;
    callBackend("/action/stop");
  },
  onToggleRecording: () => {
    isRecording = !isRecording;
    setRecordingState(isRecording);
    callBackend("/action/toggle");
  },
  onToggleHandsFree: () => {
    isHandsFree = !isHandsFree;
    setHandsFreeState(isHandsFree);
  },
  onCommandMode: (isActive: boolean) => {
    // Toggling persistent mode
    if (isActive) {
      isCommandMode = !isCommandMode;
    }
  },
  onQuickCommand: (isActive: boolean) => {
    isQuickCommand = isActive;
  },
});

// Poll for text to paste
setInterval(async () => {
  if (isRecording) return;

  try {
    const res = await fetch(`${API_URL}/consume_text`);
    const json = await res.json();
    if (json.text) {
      console.log("[main.ts] Received:", json);

      if (json.type === "paste") {
        pasteTextWithRestore(json.text);
      } else {
        const shouldHandleAsCommand = isCommandMode || isQuickCommand;

        if (shouldHandleAsCommand) {
          // Reset transient state, but keep persistent isCommandMode
          isQuickCommand = false;
          handleCommandMode(json.text);
        } else {
          pasteTextWithRestore(json.text);
        }
      }
    }
  } catch (e) {}
}, 500);
