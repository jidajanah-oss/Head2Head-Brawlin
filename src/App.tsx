import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import { NFLProvider } from "./context/NFLContext";
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
      <WeeklyScoringSync />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="games" element={<Games />} />
            <Route path="picks" element={<Picks />} />
            <Route path="standings" element={<Standings />} />
            <Route path="players" element={<Players />} />
            <Route
              path="commissioner"
              element={<Commissioner />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </NFLProvider>
  );
}

export default App;