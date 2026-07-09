import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css";
import "./styles/ui.css";
import "./components/steel/steel.css";

import { LeagueProvider } from "./context/LeagueContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LeagueProvider>
      <App />
    </LeagueProvider>
  </React.StrictMode>
);