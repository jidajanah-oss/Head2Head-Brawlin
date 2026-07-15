import {
  useEffect,
  useRef,
  useState,
} from "react";
import "../../styles/runtime-safety.css";

type RuntimeStatus = {
  isOnline: boolean;
  storageAvailable: boolean;
};

const STORAGE_TEST_KEY =
  "head2head-brawlin-steel.storage-test";
const ONLINE_RECOVERY_DURATION_MS = 5000;

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
  const [
    showOnlineRecovery,
    setShowOnlineRecovery,
  ] = useState(false);

  const wasOfflineRef = useRef(
    !navigator.onLine,
  );
  const recoveryTimerRef =
    useRef<number | null>(null);

  useEffect(() => {
    const clearRecoveryTimer = () => {
      if (
        recoveryTimerRef.current === null
      ) {
        return;
      }

      window.clearTimeout(
        recoveryTimerRef.current,
      );
      recoveryTimerRef.current = null;
    };

    const updateNetworkStatus = () => {
      const isOnline = navigator.onLine;

      setStatus((currentStatus) => ({
        ...currentStatus,
        isOnline,
      }));

      if (
        isOnline &&
        wasOfflineRef.current
      ) {
        clearRecoveryTimer();
        setShowOnlineRecovery(true);

        recoveryTimerRef.current =
          window.setTimeout(() => {
            setShowOnlineRecovery(false);
            recoveryTimerRef.current = null;
          }, ONLINE_RECOVERY_DURATION_MS);
      }

      if (!isOnline) {
        clearRecoveryTimer();
        setShowOnlineRecovery(false);
      }

      wasOfflineRef.current = !isOnline;
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
      clearRecoveryTimer();

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

  const recheckStorage = () => {
    setStatus((currentStatus) => ({
      ...currentStatus,
      storageAvailable:
        checkBrowserStorage(),
    }));
  };

  const shouldShowBanner =
    !status.isOnline ||
    !status.storageAvailable ||
    showOnlineRecovery;

  if (!shouldShowBanner) {
    return null;
  }

  const isRecoveryOnly =
    status.isOnline &&
    status.storageAvailable &&
    showOnlineRecovery;

  return (
    <aside
      className={[
        "runtime-status-banner",
        !status.storageAvailable
          ? "runtime-status-banner--critical"
          : "",
        isRecoveryOnly
          ? "runtime-status-banner--recovered"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      {!status.storageAvailable ? (
        <div className="runtime-status-banner__item">
          <div className="runtime-status-banner__copy">
            <strong>
              Browser storage is unavailable
            </strong>

            <span>
              League changes may not survive a
              refresh. Stop commissioner work until
              browser storage is enabled or
              available.
            </span>
          </div>

          <button
            className="runtime-status-banner__action"
            type="button"
            onClick={recheckStorage}
          >
            Check again
          </button>
        </div>
      ) : null}

      {!status.isOnline ? (
        <div className="runtime-status-banner__item">
          <div className="runtime-status-banner__copy">
            <strong>You are offline</strong>

            <span>
              Saved league data remains available,
              but NFL schedules, statistics, and live
              updates may be delayed.
            </span>
          </div>
        </div>
      ) : null}

      {showOnlineRecovery &&
      status.isOnline ? (
        <div className="runtime-status-banner__item">
          <div className="runtime-status-banner__copy">
            <strong>
              Back online
            </strong>

            <span>
              Live schedules, statistics, and cloud
              updates are available again.
            </span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default RuntimeStatusBanner;
