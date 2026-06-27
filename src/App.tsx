import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Picks from "./pages/Picks";
import Standings from "./pages/Standings";
import Players from "./pages/Players";
import Commissioner from "./pages/Commissioner";
import "./styles/app.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/games" element={<Games />} />
          <Route path="/picks" element={<Picks />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/players" element={<Players />} />
          <Route path="/commissioner" element={<Commissioner />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;