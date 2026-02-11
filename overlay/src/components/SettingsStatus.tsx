import React from "react";

interface SettingsStatusProps {
  recording: boolean;
  hotkey: string;
  statusPort: number;
}

export const SettingsStatus: React.FC<SettingsStatusProps> = ({
  recording,
  hotkey,
  statusPort,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4 text-zinc-300 h-full">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Global Hotkey</span>
        <kbd className="px-2 py-1 bg-zinc-800 border border-white/10 rounded text-xs font-mono text-zinc-100 uppercase">
          {hotkey || "None"}
        </kbd>
      </div>
    </div>
  );
};
