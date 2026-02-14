import React from "react";
import { Switch } from "./ui/switch";

interface SettingsStatusProps {
  hotkey: string;
}

declare global {
  interface Window {
    overlay: {
      statusPort: number;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      updateTray: (recording: boolean) => void;
      getOverlayVisible: () => Promise<boolean>;
      toggleOverlay: () => Promise<boolean>;
      quitApp: () => void;
      setPreferredAI: (ai: string) => void;
    };
  }
}

const AI_OPTIONS = [
  { value: "perplexity", label: "Perplexity" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "grok", label: "Grok" },
] as const;

export const SettingsStatus: React.FC<SettingsStatusProps> = ({ hotkey }) => {
  const [ai, setAI] = React.useState("perplexity");
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  React.useEffect(() => {
    window.overlay?.getOverlayVisible?.().then(setOverlayVisible).catch(() => {});
  }, []);

  const handleOverlayToggle = (checked: boolean) => {
    setOverlayVisible(checked);
    window.overlay?.toggleOverlay?.().then(setOverlayVisible).catch(() => {
      setOverlayVisible(!checked);
    });
  };

  const handleAIChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAI = e.target.value;
    setAI(newAI);
    if (window.overlay?.setPreferredAI) {
      window.overlay.setPreferredAI(newAI);
    }
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Settings sections */}
      <div className="flex flex-col gap-4">
        <section className="rounded-lg bg-zinc-800/40 border border-white/5 p-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
            Hotkey
          </h3>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">Push to talk</span>
            <kbd className="shrink-0 px-2.5 py-1 bg-zinc-900/80 border border-white/10 rounded-md text-[11px] font-mono text-zinc-200 tracking-wide shadow-sm">
              Ctrl + Option
            </kbd>
          </div>
        </section>

        <section className="rounded-lg bg-zinc-800/40 border border-white/5 p-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
            Browser Mode
          </h3>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Preferred AI
          </label>
          <select
            value={ai}
            onChange={handleAIChange}
            className="w-full bg-zinc-900/80 border border-white/10 rounded-md pl-3 pr-8 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30 transition-colors cursor-pointer appearance-none bg-[length:1rem_1rem] bg-[position:right_0.5rem_center] bg-no-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            }}
          >
            {AI_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </section>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-white/5">
        <div className="rounded-lg bg-zinc-800/40 border border-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-200">Overlay visible</span>
            <Switch
              checked={overlayVisible}
              onCheckedChange={handleOverlayToggle}
            />
          </div>
        </div>
        <button
          onClick={() => window.overlay?.quitApp()}
          className="w-full px-3 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-500/20 rounded-md text-sm text-red-300 hover:text-red-200 transition-all active:scale-[0.99]"
        >
          Quit Application
        </button>
      </div>
    </div>
  );
};
