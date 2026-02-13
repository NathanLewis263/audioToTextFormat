import { clipboard, shell } from "electron";
import { keyboard, Key } from "@nut-tree-fork/nut-js";

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

// TODO: implement modifySelectedText to send to LLM and paste back
async function modifySelectedText(text: string, userQuery: string) {
  console.log("Modify Selected Text: Stub called");
  console.log("Selected Text:", text);
  console.log("User Query:", userQuery);
}

export async function handleCommandMode(userQuery: string) {
  try {
    // Pure Clipboard Approach (more reliable than node-get-selected-text in some apps)
    const selectedText = await getSelectedTextWithRestore();

    if (selectedText && selectedText.trim().length > 0) {
      console.log("Editor Mode Activated");
      await modifySelectedText(selectedText, userQuery);
    } else {
      console.log("Browser Mode Activated");
      // Use clipboard for the query so user can paste it if they want
      clipboard.writeText(userQuery);

      // TODO: Add setting for preferred AI
      const preferredAI = "perplexity";
      let url = "";

      if (preferredAI === "perplexity") {
        url = `https://www.perplexity.ai/search?q=${encodeURIComponent(userQuery)}`;
      } else if (preferredAI === "chatgpt") {
        url = `https://chatgpt.com/?q=${encodeURIComponent(userQuery)}`;
      }

      if (url) {
        shell.openExternal(url);
      }
    }
  } catch (error) {
    console.error("Error in handleCommandMode:", error);
  }
}

export const pasteText = async (text: string) => {
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
  } catch (e) {
    console.error("Failed to simulate paste:", e);
  }
};
