import React, { useState, useEffect } from "react";
import InfoPanel from "./components/InfoPanel";

const App: React.FC = () => {
  return (
    <div>
      <div id="border-right" className="border-edge"></div>
      <div id="border-left" className="border-edge"></div>
      <InfoPanel />
    </div>
  );
};

export default App;
