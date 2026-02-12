import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { uIOhook, UiohookKey } from "uiohook-napi";
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

ipcMain.on("toggle-overlay", () => {
  const windows = BrowserWindow.getAllWindows();

  // Find overlay windows (not tray window)
  const overlayWindows = windows.filter((w) => w !== trayWindow);
  const anyVisible = overlayWindows.some((w) => w.isVisible());

  if (anyVisible) {
    overlayWindows.forEach((w) => w.hide());
  } else {
    overlayWindows.forEach((w) => w.show());
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

// --- uiohook-napi Integration ---

let isRecording = false;
let ctrlPressed = false;
let processingCommand = false;
let isHandsFree = false;

// Config
const API_URL = "http://127.0.0.1:3847";

// Helper to call backend
const callBackend = async (
  endpoint: string,
  method: "POST" | "GET" = "POST",
) => {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { method });
    // Attempt to parse JSON if possible, but don't crash if empty
    try {
      const json = await res.json();
      // console.log(`[main.ts] Response from ${endpoint}:`, json);
    } catch (e) {}
  } catch (e) {
    console.error(`[main.ts] Failed to call ${endpoint}:`, e);
  }
};

// Define isDev for this scope
const isDev = true; // FORCE TRUE for debugging

console.log("--- uIOhook Integration Loaded ---");

uIOhook.on("keydown", async (e: any) => {
  // Always log for now
  console.log(`Keydown: keycode=${e.keycode}, rawcode=${e.rawcode}`);

  // Left Control Detection (keycode 29)
  const isCtrl = e.keycode === UiohookKey.Ctrl;

  if (isCtrl) {
    if (!ctrlPressed) {
      ctrlPressed = true;
      if (isDev) console.log("Ctrl Pressed");

      // START RECORDING (Hold Mode)
      if (!isRecording && !processingCommand) {
        callBackend("/action/start"); // Explicit Start
        isRecording = true;
      }
    }
    return;
  }

  // If Ctrl is held, check for combinations
  if (ctrlPressed) {
    // Ctrl + Space -> Toggle Hands-Free
    if (e.keycode === UiohookKey.Space) {
      if (isDev) console.log("Toggle Hands-Free");
      isHandsFree = !isHandsFree;
    }
  } else {
    // Fallback: Option + Space
    if (e.altKey && e.keycode === UiohookKey.Space) {
      callBackend("/action/toggle"); // Keep toggle for hotkey
      isRecording = !isRecording; // Optimistic update
    }
  }
});

uIOhook.on("keyup", (e: any) => {
  const isCtrl = e.keycode === 29; // Left Control

  if (isCtrl) {
    if (ctrlPressed) {
      ctrlPressed = false;
      if (isDev) console.log("Ctrl Released");

      // STOP RECORDING (if not Hands-Free)
      if (isRecording && !isHandsFree) {
        callBackend("/action/stop"); // Explicit Stop
        isRecording = false;
      }

      processingCommand = false;
    }
  }
});

uIOhook.start();
