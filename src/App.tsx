import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import { NFLProvider } from "./context/NFLContext";
import { ObscureStatProvider } from "./context/ObscureStatContext";
import { SeasonAwardProvider } from "./context/SeasonAwardContext";
import ObscureStatPayoutSync from "./features/payouts/ObscureStatPayoutSync";
import PlayoffPayoutSync from "./features/payouts/PlayoffPayoutSync";
import SeasonAwardPayoutSync from "./features/payouts/SeasonAwardPayoutSync";
import PickerClickerSync from "./features/scoring/PickerClickerSync";
import WeeklyScoringSync from "./features/scoring/WeeklyScoringSync";
import AppLayout from "./layouts/AppLayout";
import Commissioner from "./pages/Commissioner";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";
import Picks from "./pages/Picks";
import Players from "./pages/Players";
import Standings from "./pages/Standings";

function getRouterBaseName(): string {
  const baseUrl =
    import.meta.env.BASE_URL.trim();

  if (!baseUrl || baseUrl === "/") {
    return "/";
  }

  return `/${baseUrl.replace(
    /^\/+|\/+$/g,
    "",
  )}`;
}

const ROUTER_BASE_NAME =
  getRouterBaseName();

function App() {
  return (
    <NFLProvider>
      <ObscureStatProvider>
        <SeasonAwardProvider>
          <PickerClickerSync />
          <WeeklyScoringSync />
          <ObscureStatPayoutSync />
          <PlayoffPayoutSync />
          <SeasonAwardPayoutSync />

          <BrowserRouter
            basename={ROUTER_BASE_NAME}
          >
            <Routes>
              <Route
                path="/"
                element={<AppLayout />}
              >
                <Route
                  index
                  element={<Dashboard />}
                />

                <Route
                  path="games"
                  element={<Games />}
                />

                <Route
                  path="picks"
                  element={<Picks />}
                />

                <Route
                  path="standings"
                  element={<Standings />}
                />

                <Route
                  path="players"
                  element={<Players />}
                />

                <Route
                  path="commissioner"
                  element={<Commissioner />}
                />

                <Route
                  path="*"
                  element={<NotFound />}
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </SeasonAwardProvider>
      </ObscureStatProvider>
    </NFLProvider>
  );
}

export default App;
