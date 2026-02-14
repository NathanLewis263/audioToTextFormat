import React from "react";
import { useStatus } from "../hooks/useStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { SettingsStatus } from "./SettingsStatus";
import { SettingsList } from "./SettingsList";

const SettingsTray = () => {
  const { recording, hotkey, snippets, statusPort } = useStatus();

  return (
    <div className="w-full h-full bg-zinc-900/90 backdrop-blur-md text-zinc-100 flex flex-col select-none border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
        <span className="font-semibold text-sm">Stream Dictation</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            recording
              ? "bg-red-500/20 text-red-500"
              : "bg-zinc-700/50 text-zinc-400"
          }`}
        >
          {recording ? "Live" : "Idle"}
        </span>
      </div>

      <Tabs
        defaultValue="status"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
          <TabsTrigger
            value="status"
            className="text-xs text-zinc-200/80 hover:text-zinc-200 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
          >
            Status
          </TabsTrigger>
          <TabsTrigger
            value="snippets"
            className="text-xs text-zinc-200/80 hover:text-zinc-200 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100"
          >
            Snippets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="flex-1 mt-4">
          <SettingsStatus
            hotkey={hotkey}
          />
        </TabsContent>
        <TabsContent value="snippets" className="flex-1 overflow-hidden mt-0">
          <SettingsList
            items={snippets}
            statusPort={statusPort}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsTray;
