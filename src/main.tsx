import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { LeagueProvider } from "./context/LeagueContext";
import { SeasonCloseoutProvider } from "./context/SeasonCloseoutContext";

import "./index.css";
import "./styles/ui.css";
import "./components/steel/steel.css";

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <SeasonCloseoutProvider>
      <LeagueProvider>
        <App />
      </LeagueProvider>
    </SeasonCloseoutProvider>
  </React.StrictMode>,
);
