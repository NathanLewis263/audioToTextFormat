import React from "react";
import { useStatus } from "../hooks/useStatus";

const SettingsTray = () => {
  const { recording, hotkey } = useStatus();

  const handleQuit = () => {
    window.overlay?.quitApp?.();
  };

  const handleToggleOverlay = () => {
    window.overlay?.toggleOverlay?.();
  };

  return (
    <div className="w-full h-full bg-zinc-900/90 backdrop-blur-md text-zinc-100 p-4 border border-white/10 flex flex-col gap-4 select-none">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-semibold text-sm">Stream Dictation</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${recording ? "bg-red-500/20 text-red-500" : "bg-zinc-700/50 text-zinc-400"}`}
        >
          {recording ? "Live" : "Idle"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400">Hotkey</span>
          <kbd className="bg-zinc-800 px-2 py-1 rounded font-mono text-zinc-300">
            {hotkey}
          </kbd>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400">Status Port</span>
          <span className="text-zinc-300">
            {window.overlay?.statusPort || 3847}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={handleToggleOverlay}
          className="w-full py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded transition-colors text-zinc-200"
        >
          Toggle Overlay
        </button>
        <button
          onClick={handleQuit}
          className="w-full py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 rounded transition-colors"
        >
          Quit App
        </button>cd
      </div>
    </div>
  );
};

export default SettingsTray;
