import { uIOhook, UiohookKey } from "uiohook-napi";

export type HotkeyCallbacks = {
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleRecording: () => void;
  onToggleHandsFree: () => void;
  onCommandMode: (isActive: boolean) => void;
  onQuickCommand: (isActive: boolean) => void;
};

// State for key tracking
let ctrlPressed = false;
let altPressed = false;
let cmdPressed = false;
let quickCommandResetTimeout: NodeJS.Timeout | null = null;
let isHandsFree = false;

// Flags to control if we can start
let isRecording = false;

export function setRecordingState(recording: boolean) {
  isRecording = recording;
}

export function setHandsFreeState(handsFree: boolean) {
  isHandsFree = handsFree;
}

const isDev = process.env.NODE_ENV === "development" || true;

export function setupHotkeys(callbacks: HotkeyCallbacks) {
  console.log("--- uIOhook Integration Loaded ---");

  // key down
  uIOhook.on("keydown", async (e: any) => {
    // console.log(`Keydown: keycode=${e.keycode}, rawcode=${e.rawcode}`);

    const isCtrl = e.keycode === UiohookKey.Ctrl;
    const isAlt = e.keycode === UiohookKey.Alt;
    const isCmd = e.keycode === UiohookKey.Meta; // Cmd on Mac, Windows key on Win

    // Track key states
    if (isCtrl) ctrlPressed = true;
    if (isAlt) altPressed = true;

    // LOGIC: push to talk Trigger = Ctrl + Option
    const isBaseHotkeyDown = ctrlPressed && altPressed;

    if (isBaseHotkeyDown) {
      // START RECORDING (Hold Mode)
      if (!isRecording && e.keycode !== UiohookKey.Space) {
        if (isDev) {
          console.log("Push to talk Triggered (Ctrl + Option)");
        }

        // Reset quick command state on new press
        if (quickCommandResetTimeout) {
          clearTimeout(quickCommandResetTimeout);
          quickCommandResetTimeout = null;
        }
        callbacks.onQuickCommand(false);

        callbacks.onStartRecording();
        isRecording = true;
      }
    }

    // Command Mode Trigger = Base + Cmd
    if (isCmd) {
      cmdPressed = true;
      if (isBaseHotkeyDown) {
        // If we press Cmd while Base is held, clear any pending reset
        if (quickCommandResetTimeout) {
          clearTimeout(quickCommandResetTimeout);
          quickCommandResetTimeout = null;
        }

        if (isHandsFree) {
          callbacks.onCommandMode(true); // Toggle signal
        } else {
          callbacks.onQuickCommand(true);
          if (isDev) console.log("Quick Command Mode: ON (Holding Cmd)");
        }
      }
    }

    // Hands-free toggle = Ctrl + Option + Space
    if (isBaseHotkeyDown && e.keycode === UiohookKey.Space) {
      if (isDev) console.log("Toggle Hands-Free");
      callbacks.onToggleHandsFree();
    }
  });

  // key up
  uIOhook.on("keyup", (e: any) => {
    const isCtrl = e.keycode === UiohookKey.Ctrl;
    const isAlt = e.keycode === UiohookKey.Alt;
    const isCmd = e.keycode === UiohookKey.Meta;

    if (isCtrl) ctrlPressed = false;
    if (isAlt) altPressed = false;
    if (isCmd) cmdPressed = false;

    // Command Mode Release Logic (Cmd released)
    if (isCmd) {
      // If we release Cmd while Base is still held (and not HandsFree)
      if (ctrlPressed && altPressed && !isHandsFree) {
        // Grace period: If we release Cmd, wait a bit before turning off Quick Command (100ms)
        if (quickCommandResetTimeout) {
          clearTimeout(quickCommandResetTimeout);
        }

        quickCommandResetTimeout = setTimeout(() => {
          callbacks.onQuickCommand(false);
          if (isDev)
            console.log("Quick Command Mode: OFF (Released Cmd with delay)");
          quickCommandResetTimeout = null;
        }, 100);
      }
    }

    // Main Push-to-Talk Release Logic (Ctrl OR Option released)
    if (isCtrl || isAlt) {
      const isBaseHotkeyDown = ctrlPressed && altPressed; // Check if STILL valid

      // If Base condition is broken (i.e. we released one of them)
      if (!isBaseHotkeyDown) {
        if (isDev) console.log("PTT Release (Ctrl or Option released)");

        // Handle Command Mode Grace Period for release
        if (quickCommandResetTimeout) {
          clearTimeout(quickCommandResetTimeout);
          quickCommandResetTimeout = null;
          // Confirm Quick Command
          callbacks.onQuickCommand(true);
        }

        // STOP RECORDING (if not Hands-Free)
        if (isRecording && !isHandsFree) {
          callbacks.onStopRecording();
          isRecording = false;
        }
      }
    }
  });

  uIOhook.start();
}
