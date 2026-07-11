import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import AppErrorBoundary from "./components/system/AppErrorBoundary";
import { LeagueProvider } from "./context/LeagueContext";
import { SeasonCloseoutProvider } from "./context/SeasonCloseoutContext";

import "./index.css";
import "./styles/ui.css";
import "./components/steel/steel.css";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Unable to start Head2Head Brawlin': root element not found.",
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <SeasonCloseoutProvider>
        <LeagueProvider>
          <App />
        </LeagueProvider>
      </SeasonCloseoutProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
