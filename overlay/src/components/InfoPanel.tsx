import React, { useState } from "react";
import { useStatus } from "../hooks/useStatus";
import { useDraggable } from "../hooks/useDraggable";

// Type for the window.overlay object exposed by preload script
interface OverlayAPI {
  statusPort: number;
  setIgnoreMouseEvents?: (ignore: boolean) => void;
  updateTray?: (recording: boolean) => void;
  quitApp?: () => void;
  toggleOverlay?: () => void;
}

declare global {
  interface Window {
    overlay?: OverlayAPI;
  }
}

// --- Components ---

const Badge = ({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) => (
  <div className="flex items-center justify-between mb-2 text-xs">
    <span className="text-zinc-300">{label}</span>
    <span
      className={`font-semibold transition-colors duration-200 ${
        active ? "text-red-500" : "text-zinc-100"
      }`}
    >
      {value}
    </span>
  </div>
);

const CommandRow = ({ cmdKey, desc }: { cmdKey: string; desc: string }) => (
  <div className="flex items-center py-1 text-xs text-zinc-400 justify-between">
    <kbd className="uppercase inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 mr-2 rounded bg-white/10 text-zinc-100 font-mono text-[0.85rem] border border-white/10">
      {cmdKey}
    </kbd>
    <span className="text-zinc-100">{desc}</span>
  </div>
);

const InfoPanel = () => {
  const { recording, hotkey, commands } = useStatus();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { position, handleMouseDown, handleMouseEnter, handleMouseLeave } =
    useDraggable({ top: 80, right: 24 }); // Positioned below the tray by default

  // --- Toggle Logic ---
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`fixed border border-white/10 shadow-lg text-zinc-100 overflow-hidden select-none z-[10000] transition-[width,height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-zinc-900/75 backdrop-blur-md ${
        isCollapsed ? "w-auto rounded-full" : "w-60 rounded-xl"
      }`}
      style={{
        top: position.top,
        right: position.right,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header / Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center cursor-move ${
          isCollapsed
            ? "justify-center p-2 bg-transparent border-b-0"
            : "justify-between px-4 py-3 bg-zinc-800/50 border-b border-white/10"
        }`}
      >
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-wide text-zinc-100">
            Audio to Text
          </span>
        )}

        <button
          className="toggle-btn flex items-center justify-center w-6 h-6 p-0 bg-transparent border-0 text-zinc-400 rounded cursor-pointer transition-colors duration-200 hover:text-white hover:bg-white/10"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </button>
      </div>

      {/* Content Area */}
      {!isCollapsed && (
        <div className="p-4">
          <Badge
            label="Recording"
            value={recording ? "Active" : "Ready"}
            active={recording}
          />
          <Badge label="Hotkey" value={hotkey} />

          {commands ? (
            <div className="mt-4">
              <div className="text-sm text-zinc-300 mb-2 font-medium">
                Commands
              </div>
              <div>
                {Object.entries(commands).map(([key, val]) => (
                  <CommandRow
                    key={key}
                    cmdKey={key}
                    desc={String(val).startsWith("http") ? "Open URL" : val}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-xs italic text-zinc-500 text-center">
              Connecting to backend...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InfoPanel;
