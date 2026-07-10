import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";
import { NFLProvider } from "./context/NFLContext";
import { ObscureStatProvider } from "./context/ObscureStatContext";
import ObscureStatPayoutSync from "./features/payouts/ObscureStatPayoutSync";
import PickerClickerSync from "./features/scoring/PickerClickerSync";
import WeeklyScoringSync from "./features/scoring/WeeklyScoringSync";
import AppLayout from "./layouts/AppLayout";
import Commissioner from "./pages/Commissioner";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Picks from "./pages/Picks";
import Players from "./pages/Players";
import Standings from "./pages/Standings";

function App() {
  return (
    <NFLProvider>
      <ObscureStatProvider>
        <PickerClickerSync />
        <WeeklyScoringSync />
        <ObscureStatPayoutSync />

        <BrowserRouter>
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
            </Route>
          </Routes>
        </BrowserRouter>
      </ObscureStatProvider>
    </NFLProvider>
  );
}

export default App;
