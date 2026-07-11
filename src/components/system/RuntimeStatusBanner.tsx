import {
  useEffect,
  useState,
} from "react";

import "../../styles/runtime-safety.css";

type RuntimeStatus = {
  isOnline: boolean;
  storageAvailable: boolean;
};

const STORAGE_TEST_KEY =
  "head2head-brawlin-steel.storage-test";

function checkBrowserStorage(): boolean {
  try {
    window.localStorage.setItem(
      STORAGE_TEST_KEY,
      "ok",
    );

    window.localStorage.removeItem(
      STORAGE_TEST_KEY,
    );

    return true;
  } catch {
    return false;
  }
}

function getRuntimeStatus(): RuntimeStatus {
  return {
    isOnline: navigator.onLine,
    storageAvailable:
      checkBrowserStorage(),
  };
}

function RuntimeStatusBanner() {
  const [status, setStatus] =
    useState<RuntimeStatus>(
      getRuntimeStatus,
    );

  useEffect(() => {
    const updateNetworkStatus = () => {
      setStatus((currentStatus) => ({
        ...currentStatus,
        isOnline: navigator.onLine,
      }));
    };

    window.addEventListener(
      "online",
      updateNetworkStatus,
    );

    window.addEventListener(
      "offline",
      updateNetworkStatus,
    );

    return () => {
      window.removeEventListener(
        "online",
        updateNetworkStatus,
      );

      window.removeEventListener(
        "offline",
        updateNetworkStatus,
      );
    };
  }, []);

  if (
    status.isOnline &&
    status.storageAvailable
  ) {
    return null;
  }

  return (
    <aside
      className={[
        "runtime-status-banner",
        !status.storageAvailable
          ? "runtime-status-banner--critical"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      {!status.storageAvailable ? (
        <div>
          <strong>
            Browser storage is unavailable
          </strong>

          <span>
            League changes may not survive a
            refresh. Stop commissioner work until
            browser storage is enabled or available.
          </span>
        </div>
      ) : null}

      {!status.isOnline ? (
        <div>
          <strong>You are offline</strong>

          <span>
            Saved league data remains available,
            but NFL schedules, statistics, and live
            updates may be delayed.
          </span>
        </div>
      ) : null}
    </aside>
  );
}

export default RuntimeStatusBanner;
