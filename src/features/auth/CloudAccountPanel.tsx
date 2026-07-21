import {
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import { useAuth } from "../../context/AuthContext";

type PendingAction =
  | "send"
  | "verify"
  | "resend"
  | "sign-out"
  | "refresh"
  | null;

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

function normalizeCodeInput(
  value: string,
): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 10);
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
    emailCodeSentTo,
    sendEmailCode,
    verifyEmailCode,
    clearEmailCodeRequest,
    signOut,
    refreshAccountLink,
  } = useAuth();

  const [email, setEmail] =
    useState("");

  const [
    verificationCode,
    setVerificationCode,
  ] = useState("");

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(
    null,
  );

  const isSubmitting =
    pendingAction !== null;

  const handleEmailCodeRequest = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPendingAction("send");

    try {
      await sendEmailCode(email);
      setVerificationCode("");
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setPendingAction(null);
    }
  };

  const handleEmailCodeVerification = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!emailCodeSentTo) {
      return;
    }

    setPendingAction("verify");

    try {
      await verifyEmailCode(
        emailCodeSentTo,
        verificationCode,
      );
      setVerificationCode("");
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setPendingAction(null);
    }
  };

  const handleResendCode = async () => {
    if (!emailCodeSentTo) {
      return;
    }

    setPendingAction("resend");

    try {
      await sendEmailCode(
        emailCodeSentTo,
      );
      setVerificationCode("");
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setPendingAction(null);
    }
  };

  const handleDifferentEmail = () => {
    setVerificationCode("");
    clearEmailCodeRequest();
  };

  const handleSignOut = async () => {
    setPendingAction("sign-out");

    try {
      await signOut();
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefresh = async () => {
    setPendingAction("refresh");

    try {
      await refreshAccountLink();
    } finally {
      setPendingAction(null);
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
        !user &&
        !emailCodeSentTo && (
          <form
            className="cloud-account-panel__form"
            onSubmit={
              handleEmailCodeRequest
            }
          >
            <p>
              Sign in with the email assigned
              to your league account.
            </p>

            <p>
              On iPhone, request the code here,
              open your email, then return to
              this same Home Screen app to enter
              it.
            </p>

            <label htmlFor="cloud-account-email">
              Email address
            </label>

            <input
              id="cloud-account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(
                event:
                  ChangeEvent<HTMLInputElement>,
              ) =>
                setEmail(
                  event.target.value,
                )
              }
              placeholder="name@example.com"
              required
            />

            <button
              type="submit"
              disabled={isSubmitting}
            >
              {pendingAction === "send"
                ? "Sending code..."
                : "Email me a sign-in code"}
            </button>
          </form>
        )}

      {configured &&
        connectionStatus === "connected" &&
        !user &&
        emailCodeSentTo && (
          <form
            className="cloud-account-panel__form"
            onSubmit={
              handleEmailCodeVerification
            }
          >
            <div className="cloud-account-panel__message cloud-account-panel__message--success">
              A sign-in code was sent to{" "}
              <strong>
                {emailCodeSentTo}
              </strong>
              .
            </div>

            <p>
              Enter the newest sign-in code
              below. Stay in this app while
              signing in.
            </p>

            <label htmlFor="cloud-account-code">
              Sign-in code
            </label>

            <input
              id="cloud-account-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              value={verificationCode}
              onChange={(
                event:
                  ChangeEvent<HTMLInputElement>,
              ) =>
                setVerificationCode(
                  normalizeCodeInput(
                    event.target.value,
                  ),
                )
              }
              placeholder="12345678"
              autoFocus
              required
            />

            <button
              type="submit"
              disabled={
                isSubmitting ||
                verificationCode.length < 6 || verificationCode.length > 10
              }
            >
              {pendingAction === "verify"
                ? "Verifying..."
                : "Verify code and sign in"}
            </button>

            <div className="cloud-account-panel__actions">
              <button
                type="button"
                className="cloud-account-panel__button--secondary"
                disabled={isSubmitting}
                onClick={() => {
                  void handleResendCode();
                }}
              >
                {pendingAction === "resend"
                  ? "Resending..."
                  : "Send a new code"}
              </button>

              <button
                type="button"
                className="cloud-account-panel__button--secondary"
                disabled={isSubmitting}
                onClick={
                  handleDifferentEmail
                }
              >
                Use a different email
              </button>
            </div>
          </form>
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
              Signed in as{" "}
              <strong>{user.email}</strong>
            </p>

            <div className="cloud-account-panel__message cloud-account-panel__message--warning">
              This Supabase user does not yet
              have an active league-player
              link. Refresh the account after
              the commissioner prepares the
              player invitation.
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
                    .join(" Â· ") || "Linked"}
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

