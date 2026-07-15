import {
  useEffect,
  useMemo,
  useState,
} from "react";
import "../../styles/pwaInstallPrompt.css";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent
  extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const DISMISSAL_STORAGE_KEY =
  "head2head-brawlin.pwa-install-dismissed-at.v1";

const DISMISSAL_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

function isStandaloneMode(): boolean {
  return (
    window.matchMedia(
      "(display-mode: standalone)",
    ).matches ||
    (navigator as NavigatorWithStandalone)
      .standalone === true
  );
}

function isIosDevice(): boolean {
  const userAgent = navigator.userAgent;
  const isClassicIos =
    /iPhone|iPad|iPod/i.test(userAgent);
  const isModernIpad =
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1;

  return isClassicIos || isModernIpad;
}

function wasRecentlyDismissed(): boolean {
  try {
    const rawValue = localStorage.getItem(
      DISMISSAL_STORAGE_KEY,
    );

    if (!rawValue) {
      return false;
    }

    const dismissedAt = Number(rawValue);

    return (
      Number.isFinite(dismissedAt) &&
      Date.now() - dismissedAt <
        DISMISSAL_DURATION_MS
    );
  } catch {
    return false;
  }
}

function saveDismissal(): void {
  try {
    localStorage.setItem(
      DISMISSAL_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // The banner can still be dismissed for this session.
  }
}

function clearDismissal(): void {
  try {
    localStorage.removeItem(
      DISMISSAL_STORAGE_KEY,
    );
  } catch {
    // Storage access is optional for installation support.
  }
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(
      null,
    );
  const [installed, setInstalled] =
    useState(() => isStandaloneMode());
  const [dismissed, setDismissed] =
    useState(() => wasRecentlyDismissed());
  const [installing, setInstalling] =
    useState(false);

  const iosDevice = useMemo(
    () => isIosDevice(),
    [],
  );

  useEffect(() => {
    const displayModeQuery =
      window.matchMedia(
        "(display-mode: standalone)",
      );

    const refreshDismissal = () => {
      setDismissed(wasRecentlyDismissed());
    };

    const handleDisplayModeChange = () => {
      setInstalled(isStandaloneMode());
    };

    const handleBeforeInstallPrompt = (
      event: Event,
    ) => {
      const promptEvent =
        event as BeforeInstallPromptEvent;

      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
      refreshDismissal();
    };

    const handleInstalled = () => {
      clearDismissal();
      setDismissed(false);
      setInstalled(true);
      setInstallPrompt(null);
    };

    const handleStorageChange = (
      event: StorageEvent,
    ) => {
      if (
        event.key === DISMISSAL_STORAGE_KEY
      ) {
        refreshDismissal();
      }
    };

    displayModeQuery.addEventListener(
      "change",
      handleDisplayModeChange,
    );
    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener(
      "appinstalled",
      handleInstalled,
    );
    window.addEventListener(
      "storage",
      handleStorageChange,
    );

    return () => {
      displayModeQuery.removeEventListener(
        "change",
        handleDisplayModeChange,
      );
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener(
        "appinstalled",
        handleInstalled,
      );
      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
    };
  }, []);

  const dismiss = () => {
    saveDismissal();
    setDismissed(true);
    setInstallPrompt(null);
  };

  const install = async () => {
    if (!installPrompt || installing) {
      return;
    }

    setInstalling(true);

    try {
      await installPrompt.prompt();
      const choice =
        await installPrompt.userChoice;

      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        clearDismissal();
      } else {
        dismiss();
      }
    } finally {
      setInstalling(false);
    }
  };

  if (installed || dismissed) {
    return null;
  }

  if (!installPrompt && !iosDevice) {
    return null;
  }

  return (
    <aside
      className="pwa-install-prompt"
      aria-label="Install Head2Head Brawlin app"
    >
      <img
        className="pwa-install-prompt__icon"
        src={`${import.meta.env.BASE_URL}icons/pwa-192x192.png`}
        alt=""
        aria-hidden="true"
      />

      <div className="pwa-install-prompt__content">
        <p className="pwa-install-prompt__eyebrow">
          Quick Phone Access
        </p>
        <strong>
          Install Head2Head Brawlin&apos;
        </strong>

        {installPrompt ? (
          <p>
            Add the league to your Home Screen and
            open it like a regular app.
          </p>
        ) : (
          <p>
            On iPhone or iPad, open this page in
            Safari, tap <b>Share</b>, then choose
            <b> Add to Home Screen</b>.
          </p>
        )}
      </div>

      <div className="pwa-install-prompt__actions">
        {installPrompt ? (
          <button
            className="pwa-install-prompt__install"
            type="button"
            onClick={() => {
              void install();
            }}
            disabled={installing}
          >
            {installing
              ? "Opening..."
              : "Install App"}
          </button>
        ) : null}

        <button
          className="pwa-install-prompt__dismiss"
          type="button"
          onClick={dismiss}
        >
          {installPrompt ? "Not now" : "Got it"}
        </button>
      </div>
    </aside>
  );
}
