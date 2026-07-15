import {
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import { useAuth } from "../../context/AuthContext";

function getRoleLabel(
  role: string,
): string {
  if (role === "commissioner") {
    return "Commissioner";
  }

  if (role === "backup_commissioner") {
    return "Backup Commissioner";
  }

  return "Player";
}

function getConnectionLabel(
  status: string,
): string {
  if (status === "connected") {
    return "Cloud connected";
  }

  if (status === "checking") {
    return "Checking cloud";
  }

  if (status === "disabled") {
    return "Cloud not configured";
  }

  return "Cloud unavailable";
}

export default function CloudAccountPanel() {
  const {
    configured,
    missingConfiguration,
    connectionStatus,
    connectionErrorMessage,
    status,
    user,
    accountLink,
    errorMessage,
    magicLinkSentTo,
    sendMagicLink,
    signOut,
    refreshAccountLink,
  } = useAuth();
  const [email, setEmail] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const handleMagicLinkSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await sendMagicLink(email);
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSubmitting(true);

    try {
      await signOut();
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsSubmitting(true);

    try {
      await refreshAccountLink();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="cloud-account-panel">
      <div className="cloud-account-panel__heading">
        <div>
          <p className="cloud-account-panel__kicker">
            Milestone 12
          </p>
          <h2>Cloud Account</h2>
        </div>

        <span
          className={`cloud-account-panel__status cloud-account-panel__status--${connectionStatus}`}
        >
          {getConnectionLabel(
            connectionStatus,
          )}
        </span>
      </div>

      {!configured && (
        <div className="cloud-account-panel__message cloud-account-panel__message--warning">
          <strong>
            Supabase is not configured.
          </strong>
          <span>
            Missing: {missingConfiguration.join(", ")}
          </span>
        </div>
      )}

      {connectionErrorMessage && (
        <div className="cloud-account-panel__message cloud-account-panel__message--error">
          {connectionErrorMessage}
        </div>
      )}

      {configured &&
        connectionStatus === "connected" &&
        !user && (
          <form
            className="cloud-account-panel__form"
            onSubmit={handleMagicLinkSubmit}
          >
            <p>
              Sign in with the email assigned to your league account.
            </p>

            <label htmlFor="cloud-account-email">
              Email address
            </label>
            <input
              id="cloud-account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEmail(event.target.value)
              }
              placeholder="name@example.com"
              required
            />

            <button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Sending..."
                : "Email me a sign-in link"}
            </button>
          </form>
        )}

      {magicLinkSentTo && (
        <div className="cloud-account-panel__message cloud-account-panel__message--success">
          Sign-in link sent to {magicLinkSentTo}.
        </div>
      )}

      {user && status === "loading" && (
        <div className="cloud-account-panel__message">
          Loading your league account...
        </div>
      )}

      {user &&
        status === "signed-in-unlinked" && (
          <div className="cloud-account-panel__account">
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
            <div className="cloud-account-panel__message cloud-account-panel__message--warning">
              This Supabase user does not yet have an active league-player link. Do not invite players yet.
            </div>
            <div className="cloud-account-panel__actions">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isSubmitting}
              >
                Refresh account link
              </button>
              <button
                type="button"
                className="cloud-account-panel__button--secondary"
                onClick={handleSignOut}
                disabled={isSubmitting}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

      {user &&
        status === "signed-in-linked" &&
        accountLink && (
          <div className="cloud-account-panel__account">
            <div className="cloud-account-panel__details">
              <div>
                <span>Player</span>
                <strong>
                  {accountLink.playerName ??
                    accountLink.playerId}
                </strong>
              </div>
              <div>
                <span>Role</span>
                <strong>
                  {getRoleLabel(
                    accountLink.role,
                  )}
                </strong>
              </div>
              <div>
                <span>League</span>
                <strong>
                  {accountLink.leagueName ??
                    "Head2Head Brawlin"}
                </strong>
              </div>
              <div>
                <span>Season / Team</span>
                <strong>
                  {[
                    accountLink.season,
                    accountLink.nflTeam,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Linked"}
                </strong>
              </div>
            </div>

            <p className="cloud-account-panel__email">
              Signed in as {user.email}
            </p>

            <div className="cloud-account-panel__actions">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isSubmitting}
              >
                Refresh account
              </button>
              <button
                type="button"
                className="cloud-account-panel__button--secondary"
                onClick={handleSignOut}
                disabled={isSubmitting}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

      {errorMessage && (
        <div className="cloud-account-panel__message cloud-account-panel__message--error">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
