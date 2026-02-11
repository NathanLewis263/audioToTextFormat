import React, { useState } from "react";

interface SettingsListProps {
  type: "commands" | "snippets";
  items: Record<string, string> | null;
  statusPort: number;
}

export const SettingsList: React.FC<SettingsListProps> = ({
  type,
  items,
  statusPort,
}) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const addItem = async () => {
    if (!newKey || !newValue) return;
    try {
      await fetch(`http://127.0.0.1:${statusPort}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue }),
      });
      setNewKey("");
      setNewValue("");
    } catch (e) {
      console.error(`Failed to add ${type}`, e);
    }
  };

  const deleteItem = async (key: string) => {
    try {
      await fetch(`http://127.0.0.1:${statusPort}/${type}/${key}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error(`Failed to delete ${type}`, e);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden pt-2">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="New Key"
          className="w-1/3 bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <input
          type="text"
          placeholder="Value"
          className="flex-1 bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <button
          onClick={addItem}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 rounded text-xs"
        >
          Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
        {items &&
          Object.entries(items).map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between items-center bg-zinc-800/50 p-2 rounded border border-white/5 group"
            >
              <div className="flex flex-col overflow-hidden">
                <span className={`text-xs font-mono text-zinc-300 ${type === "commands" ? "uppercase" : ""}`}>{k}</span>
                <span className="text-[10px] text-zinc-500 truncate">{v}</span>
              </div>
              <button
                onClick={() => deleteItem(k)}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity px-1"
              >
                ×
              </button>
            </div>
          ))}
        {(!items || Object.keys(items).length === 0) && (
          <div className="text-center text-zinc-600 text-xs mt-4">
            No {type} added yet.
          </div>
        )}
      </div>
    </div>
  );
};
