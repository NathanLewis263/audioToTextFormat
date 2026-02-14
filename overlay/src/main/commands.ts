import { clipboard, shell } from "electron";
import { keyboard, Key } from "@nut-tree-fork/nut-js";
import { callBackend } from "./api";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSelectedTextWithRestore(): Promise<string> {
  const originalClipboardText = clipboard.readText();
  const originalClipboardImage = clipboard.readImage();

  clipboard.clear();

  // Simulate Cmd+C (macOS) or Ctrl+C (Windows/Linux)
  try {
    if (process.platform === "darwin") {
      await keyboard.pressKey(Key.LeftSuper, Key.C);
      await keyboard.releaseKey(Key.LeftSuper, Key.C);
    } else {
      await keyboard.pressKey(Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.LeftControl, Key.C);
    }

    // Wait for clipboard to update - minimal reliable delay
    await delay(100);

    const selectedText = clipboard.readText();

    // Restore original clipboard
    if (!originalClipboardImage.isEmpty()) {
      clipboard.writeImage(originalClipboardImage);
    } else {
      clipboard.writeText(originalClipboardText);
    }

    return selectedText;
  } catch (e) {
    console.error("Clipboard selection failed:", e);

    // Attempt restore even on error
    if (!originalClipboardImage.isEmpty()) {
      clipboard.writeImage(originalClipboardImage);
    } else {
      clipboard.writeText(originalClipboardText);
    }
    return "";
  }
}

let preferredAI = "perplexity";

export const setPreferredAI = (ai: string) => {
  preferredAI = ai;
};

export const getPreferredAI = () => preferredAI;

export async function handleCommandMode(userQuery: string) {
  try {
    // Pure Clipboard Approach (more reliable than node-get-selected-text in some apps)
    const selectedText = await getSelectedTextWithRestore();

    if (selectedText && selectedText.trim().length > 0) {
      console.log("Editor Mode Activated");
      await callBackend("/action/editor_command", "POST", {
        instruction: userQuery,
        selected_text: selectedText,
      });
    } else {
      console.log("Browser Mode Activated");
      // Use clipboard for the query so user can paste it if they want
      clipboard.writeText(userQuery);

      let url = "";

      if (preferredAI === "perplexity") {
        url = `https://www.perplexity.ai/search?q=${encodeURIComponent(userQuery)}`;
      } else if (preferredAI === "chatgpt") {
        url = `https://chatgpt.com/?q=${encodeURIComponent(userQuery)}`;
      } else if (preferredAI === "grok") {
        url = `https://x.com/i/grok?text=${encodeURIComponent(userQuery)}`;
      }

      if (url) {
        shell.openExternal(url);
      }
    }
  } catch (error) {
    console.error("Error in handleCommandMode:", error);
  }
}

export const pasteTextWithRestore = async (text: string) => {
  const originalClipboardText = clipboard.readText();
  const originalClipboardImage = clipboard.readImage();

  clipboard.clear();
  clipboard.writeText(text);
  try {
    if (process.platform === "darwin") {
      await keyboard.pressKey(Key.LeftSuper, Key.V);
      await keyboard.releaseKey(Key.LeftSuper, Key.V);
    } else {
      await keyboard.pressKey(Key.LeftControl, Key.V);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
    }
    console.log("Pasted via nut.js");

    // Small delay to ensure paste operation completes before restoring clipboard
    await delay(100);

    // Restore original clipboard
    if (!originalClipboardImage.isEmpty()) {
      clipboard.writeImage(originalClipboardImage);
    } else {
      clipboard.writeText(originalClipboardText);
    }
  } catch (e) {
    console.error("Failed to simulate paste:", e);
  }
};
