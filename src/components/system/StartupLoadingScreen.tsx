import {
  useEffect,
  useState,
} from "react";
import "../../styles/startup-loading.css";

const SLOW_START_DELAY_MS = 8000;

function StartupLoadingScreen() {
  const [takingLonger, setTakingLonger] =
    useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setTakingLonger(true);
    }, SLOW_START_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  const reloadApp = () => {
    window.location.reload();
  };

  return (
    <main
      className="app-startup-screen"
      aria-busy="true"
      aria-live="polite"
    >
      <section className="app-startup-screen__card">
        <img
          className="app-startup-screen__logo"
          src={`${import.meta.env.BASE_URL}icons/pwa-192x192.png`}
          alt=""
          aria-hidden="true"
        />

        <p className="app-startup-screen__kicker">
          Steel Edition
        </p>

        <h1>Head2Head Brawlin&apos;</h1>

        <div
          className="app-startup-screen__progress"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <p className="app-startup-screen__message">
          {takingLonger
            ? "Still restoring your league..."
            : "Restoring your league..."}
        </p>

        {takingLonger ? (
          <div className="app-startup-screen__recovery">
            <p>
              This is taking longer than usual.
              Check your connection, then reload the
              app.
            </p>

            <button
              type="button"
              onClick={reloadApp}
            >
              Reload App
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default StartupLoadingScreen;
