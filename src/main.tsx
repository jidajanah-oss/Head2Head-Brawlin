import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import AppErrorBoundary from "./components/system/AppErrorBoundary";
import "./components/steel/steel.css";
import { AuthProvider } from "./context/AuthContext";
import { LeagueProvider } from "./context/LeagueContext";
import { SeasonCloseoutProvider } from "./context/SeasonCloseoutContext";
import { migrateLegacyPlaceholderRoster } from "./engine/placeholderRosterMigration";
import CloudPlayerSessionSync from "./features/auth/CloudPlayerSessionSync";
import CloudRosterSync from "./features/auth/CloudRosterSync";
import "./index.css";
import "./styles/ui.css";

migrateLegacyPlaceholderRoster();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Unable to start Head2Head Brawlin': root element not found.",
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <SeasonCloseoutProvider>
          <LeagueProvider>
            <CloudPlayerSessionSync />
            <CloudRosterSync />
            <App />
          </LeagueProvider>
        </SeasonCloseoutProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
