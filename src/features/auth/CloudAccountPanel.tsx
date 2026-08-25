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
  | "computer"
  | "sign-out"
  | "refresh"
  | null;

type SignInMode = "email" | "computer";

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

function normalizePinInput(
  value: string,
): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 6);
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
    signInWithComputerAccess,
    signOut,
    refreshAccountLink,
  } = useAuth();

  const [signInMode, setSignInMode] =
    useState<SignInMode>("email");

  const [email, setEmail] =
    useState("");

  const [
    verificationCode,
    setVerificationCode,
  ] = useState("");

  const [
    computerUsername,
    setComputerUsername,
  ] = useState("");

  const [
    computerPin,
    setComputerPin,
  ] = useState("");

  const [
    pendingAction,
    setPendingAction,
  ] = useState<PendingAction>(
    null,
  );

  const isSubmitting =
    pendingAction !== null;

  const isComputerAccessUser =
    user?.app_metadata?.auth_method ===
    "computer_pin";

  const computerAccessLabel =
    typeof user?.app_metadata?.computer_username ===
    "string"
      ? user.app_metadata.computer_username
      : accountLink?.playerName ?? "Computer Access";

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

  const handleComputerAccess = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPendingAction("computer");

    try {
      await signInWithComputerAccess(
        computerUsername,
        computerPin,
      );
      setComputerPin("");
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
            Secure Player Access
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
          <>
            <div
              className="cloud-account-panel__signin-modes"
              role="group"
              aria-label="Sign-in method"
            >
              <button
                type="button"
                className={
                  signInMode === "email"
                    ? "cloud-account-panel__mode-button cloud-account-panel__mode-button--active"
                    : "cloud-account-panel__mode-button"
                }
                disabled={isSubmitting}
                onClick={() => {
                  setSignInMode("email");
                }}
              >
                Email Code
              </button>

              <button
                type="button"
                className={
                  signInMode === "computer"
                    ? "cloud-account-panel__mode-button cloud-account-panel__mode-button--active"
                    : "cloud-account-panel__mode-button"
                }
                disabled={isSubmitting}
                onClick={() => {
                  setSignInMode("computer");
                  clearEmailCodeRequest();
                }}
              >
                Computer Access
              </button>
            </div>

            {signInMode === "email" ? (
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
            ) : (
              <form
                className="cloud-account-panel__form cloud-account-panel__computer-form"
                onSubmit={handleComputerAccess}
              >
                <div className="cloud-account-panel__message cloud-account-panel__message--computer">
                  <strong>Computer Access</strong>
                  <span>
                    Use the player name and 6-digit PIN assigned by the commissioner. No email or phone is required.
                  </span>
                </div>

                <label htmlFor="cloud-computer-username">
                  Player name
                </label>

                <input
                  id="cloud-computer-username"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={computerUsername}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>,
                  ) => setComputerUsername(event.target.value)}
                  placeholder="Kenny"
                  required
                />

                <label htmlFor="cloud-computer-pin">
                  6-digit PIN
                </label>

                <input
                  id="cloud-computer-pin"
                  className="cloud-account-panel__pin-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={computerPin}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>,
                  ) => setComputerPin(normalizePinInput(event.target.value))}
                  placeholder="••••••"
                  required
                />

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    computerUsername.trim().length < 2 ||
                    computerPin.length !== 6
                  }
                >
                  {pendingAction === "computer"
                    ? "Signing in..."
                    : "Sign in with PIN"}
                </button>

                <small className="cloud-account-panel__security-note">
                  Five incorrect PIN attempts temporarily lock Computer Access for 15 minutes.
                </small>
              </form>
            )}
          </>
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
              {isComputerAccessUser ? (
                <>
                  Computer Access signed in as{" "}
                  <strong>{computerAccessLabel}</strong>
                </>
              ) : (
                <>
                  Signed in as{" "}
                  <strong>{user.email}</strong>
                </>
              )}
            </p>

            <div className="cloud-account-panel__message cloud-account-panel__message--warning">
              This Supabase user does not yet
              have an active league-player
              link. Refresh the account after
              the commissioner prepares the
              player access.
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
              {isComputerAccessUser
                ? `Computer Access · ${computerAccessLabel}`
                : `Signed in as ${user.email ?? "email account"}`}
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
