import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/games", label: "Games" },
  { to: "/picks", label: "Picks" },
  { to: "/standings", label: "Standings" },
  { to: "/players", label: "Me" },
  { to: "/commissioner", label: "Commish" },
];

function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>🏈 Head2Head Brawlin'</h1>
          <p>2026 Pick&apos;em League</p>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AppLayout;