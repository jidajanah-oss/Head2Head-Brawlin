import {
  Link,
  useLocation,
} from "react-router-dom";

import "../styles/runtime-safety.css";

function NotFound() {
  const location = useLocation();

  return (
    <section className="not-found-card">
      <div className="runtime-error-kicker">
        Route Recovery
      </div>

      <h2>Page not found</h2>

      <p>
        The address{" "}
        <code>{location.pathname}</code>{" "}
        does not match a Head2Head Brawlin&apos;
        screen.
      </p>

      <Link
        className="runtime-action runtime-action--primary"
        to="/"
      >
        Return to Dashboard
      </Link>
    </section>
  );
}

export default NotFound;
