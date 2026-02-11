import React, { useMemo } from "react";
import SettingsTray from "./components/SettingsTray";
import { useStatus } from "./hooks/useStatus";

const App: React.FC = () => {
  const isTrayWindow = useMemo(() => {
    return new URLSearchParams(window.location.search).get("window") === "tray";
  }, []);

  // Ensure polling runs for the main overlay to update borders and tray status
  // We don't need the return values (recording, etc) for the UI here, just the side effects.
  useStatus();

  if (isTrayWindow) {
    return <SettingsTray />;
  }

  return (
    <div>
      <div id="border-right" className="border-edge"></div>
      <div id="border-left" className="border-edge"></div>
      {/* InfoPanel removed as requested */}
    </div>
  );
};

export default App;
