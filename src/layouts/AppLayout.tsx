import {
  NavLink,
  Outlet,
} from "react-router-dom";
import RuntimeStatusBanner from "../components/system/RuntimeStatusBanner";
import { useAuth } from "../context/AuthContext";

const standardNavItems = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/picks", label: "Picks" },
  {
    to: "/standings",
    label: "Standings",
  },
  { to: "/players", label: "Me" },
];

const commissionerNavItem = {
  to: "/commissioner",
  label: "Commish",
};

function AppLayout() {
  const { access } = useAuth();

  const navItems = access.canAccessCommissioner
    ? [...standardNavItems, commissionerNavItem]
    : standardNavItems;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            H2H
          </div>

          <div>
            <p className="brand-kicker">
              Steel Edition
            </p>

            <h1>
              Head2Head Brawlin&apos;
            </h1>

            <p className="brand-subtitle">
              2026 Pick&apos;em League
            </p>
          </div>
        </div>
      </header>

      <RuntimeStatusBanner />

      <main className="app-main">
        <Outlet />
      </main>

      <nav
        className="bottom-nav"
        aria-label="Primary navigation"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;