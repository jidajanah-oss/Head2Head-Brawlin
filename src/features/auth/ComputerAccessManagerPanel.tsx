import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent } from "react";

import { useAuth } from "../../context/AuthContext";
import {
  configureComputerAccess,
  disableComputerAccess,
  loadComputerAccessStatus,
  type ComputerAccessStatus,
} from "../../services/computerAccessService";
import {
  loadPlayerAccountReadiness,
  type PlayerAccountReadiness,
} from "../../services/cloudRosterService";
import { supabaseClient } from "../../services/supabaseClient";
import "../../styles/computerAccess.css";

const EMPTY_STATUS: ComputerAccessStatus = {
  configured: false,
  enabled: false,
  username: null,
  lockedUntil: null,
  lastSuccessAt: null,
};

function normalizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

function isComputerAccessEmail(email: string | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith("@head2head.invalid"));
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default function ComputerAccessManagerPanel() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const [players, setPlayers] = useState<PlayerAccountReadiness[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [accessStatus, setAccessStatus] = useState<ComputerAccessStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPlayer = useMemo(
    () =>
      players.find(
        (record) => record.playerId === selectedPlayerId,
      ) ?? null,
    [players, selectedPlayerId],
  );

  const refreshPlayers = useCallback(async () => {
    const client = supabaseClient;

    if (!client || !accountLink || !access.canManageAccounts) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const records = await loadPlayerAccountReadiness(
        client,
        accountLink.leagueId,
      );

      const eligible = records
        .filter(
          (record) =>
            record.playerStatus === "active" &&
            record.role !== "commissioner",
        )
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        );

      setPlayers(eligible);
      setSelectedPlayerId((current) => {
        if (
          current &&
          eligible.some((record) => record.playerId === current)
        ) {
          return current;
        }

        const kenny = eligible.find(
          (record) => record.displayName.toLowerCase() === "kenny",
        );

        return kenny?.playerId ?? eligible[0]?.playerId ?? "";
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load players for Computer Access.",
      );
    } finally {
      setLoading(false);
    }
  }, [access.canManageAccounts, accountLink]);

  const refreshStatus = useCallback(async () => {
    const client = supabaseClient;

    if (!client || !accountLink || !selectedPlayerId) {
      setAccessStatus(EMPTY_STATUS);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const nextStatus = await loadComputerAccessStatus(
        client,
        accountLink.leagueId,
        selectedPlayerId,
      );

      setAccessStatus(nextStatus);
      setUsername(
        nextStatus.username ?? selectedPlayer?.displayName ?? "",
      );
    } catch (error) {
      setAccessStatus(EMPTY_STATUS);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Computer Access status.",
      );
    } finally {
      setLoading(false);
    }
  }, [accountLink, selectedPlayer?.displayName, selectedPlayerId]);

  useEffect(() => {
    if (
      status === "signed-in-linked" &&
      accountLink &&
      access.canManageAccounts
    ) {
      void refreshPlayers();
    }
  }, [
    access.canManageAccounts,
    accountLink,
    refreshPlayers,
    status,
  ]);

  useEffect(() => {
    if (selectedPlayerId) {
      setPin("");
      setConfirmPin("");
      setSuccessMessage(null);
      void refreshStatus();
    }
  }, [refreshStatus, selectedPlayerId]);

  if (
    status !== "signed-in-linked" ||
    !accountLink ||
    !access.canManageAccounts
  ) {
    return null;
  }

  const handleConfigure = async () => {
    const client = supabaseClient;

    if (!client || !selectedPlayer) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    if (username.trim().length < 2) {
      setErrorMessage("Enter a Computer Access player name.");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setErrorMessage("Enter exactly a 6-digit PIN.");
      return;
    }

    if (pin !== confirmPin) {
      setErrorMessage("The two PIN entries do not match.");
      return;
    }

    const replacingEmail =
      selectedPlayer.accountStatus === "linked" &&
      !isComputerAccessEmail(selectedPlayer.email);

    const approved = window.confirm(
      [
        `${accessStatus.enabled ? "Reset" : "Enable"} Computer Access for ${selectedPlayer.displayName}?`,
        "",
        `Player: ${selectedPlayer.displayName} — ${selectedPlayer.nflTeam}`,
        `Computer login name: ${username.trim()}`,
        replacingEmail
          ? "The currently linked email login will be disconnected."
          : "The player record and league data will stay unchanged.",
        "",
        "Team assignment, picks, standings, payouts, and roster history will be preserved.",
      ].join("\n"),
    );

    if (!approved) {
      return;
    }

    setSaving(true);

    try {
      const result = await configureComputerAccess(
        client,
        accountLink.leagueId,
        selectedPlayer.playerId,
        username,
        pin,
      );

      setAccessStatus({
        configured: result.configured,
        enabled: result.enabled,
        username: result.username,
        lockedUntil: result.lockedUntil,
        lastSuccessAt: result.lastSuccessAt,
      });

      setPin("");
      setConfirmPin("");
      setSuccessMessage(
        result.replacedPreviousLogin
          ? `${selectedPlayer.displayName}'s old email login was retired. Computer Access is ready with login name ${result.username ?? username.trim()}.`
          : `${selectedPlayer.displayName}'s Computer Access PIN is ready.`,
      );

      await refreshPlayers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to configure Computer Access.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    const client = supabaseClient;

    if (!client || !selectedPlayer || !accessStatus.enabled) {
      return;
    }

    const approved = window.confirm(
      [
        `Disable Computer Access for ${selectedPlayer.displayName}?`,
        "",
        "This removes the active PIN login. The player's roster record and league history stay intact.",
        "A new email invitation or a new Computer Access PIN will be needed before the player can sign in again.",
      ].join("\n"),
    );

    if (!approved) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await disableComputerAccess(
        client,
        accountLink.leagueId,
        selectedPlayer.playerId,
      );

      setAccessStatus(result);
      setSuccessMessage(
        `Computer Access was disabled for ${selectedPlayer.displayName}.`,
      );
      await refreshPlayers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable Computer Access.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="computer-access-manager">
      <div className="computer-access-manager__header">
        <div>
          <p className="computer-access-manager__eyebrow">
            Primary Commissioner · Special Access
          </p>
          <h2>Computer Access PIN</h2>
          <p>
            Give a player a computer-only login when email or phone access is not practical. The same league player record is preserved.
          </p>
        </div>

        <span className="computer-access-manager__badge">
          6-digit PIN
        </span>
      </div>

      <div className="computer-access-manager__safety">
        PINs are never stored in the Head2Head database. Five incorrect attempts lock the player&apos;s Computer Access for 15 minutes.
      </div>

      <div className="computer-access-manager__grid">
        <label>
          Player
          <select
            value={selectedPlayerId}
            disabled={loading || saving || players.length === 0}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setSelectedPlayerId(event.target.value);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            {players.length === 0 ? (
              <option value="">No eligible players</option>
            ) : null}
            {players.map((record) => (
              <option key={record.playerId} value={record.playerId}>
                {record.displayName} — {record.nflTeam}
              </option>
            ))}
          </select>
        </label>

        <label>
          Computer login name
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={username}
            disabled={!selectedPlayer || saving}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setUsername(event.target.value);
              setErrorMessage(null);
            }}
            placeholder="Kenny"
          />
        </label>

        <label>
          New 6-digit PIN
          <input
            className="computer-access-manager__pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            disabled={!selectedPlayer || saving}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setPin(normalizePin(event.target.value));
              setErrorMessage(null);
            }}
            placeholder="••••••"
          />
        </label>

        <label>
          Confirm PIN
          <input
            className="computer-access-manager__pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            maxLength={6}
            value={confirmPin}
            disabled={!selectedPlayer || saving}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setConfirmPin(normalizePin(event.target.value));
              setErrorMessage(null);
            }}
            placeholder="••••••"
          />
        </label>
      </div>

      {selectedPlayer ? (
        <div className="computer-access-manager__status-grid">
          <div>
            <span>Selected player</span>
            <strong>{selectedPlayer.displayName} — {selectedPlayer.nflTeam}</strong>
            <small>
              {selectedPlayer.playerId}
            </small>
          </div>

          <div>
            <span>Current access</span>
            <strong>
              {accessStatus.enabled
                ? `Computer PIN · ${accessStatus.username ?? username}`
                : selectedPlayer.accountStatus === "linked"
                  ? isComputerAccessEmail(selectedPlayer.email)
                    ? "Computer PIN disabled"
                    : "Email login"
                  : selectedPlayer.accountStatus === "invitation_pending"
                    ? "Email invitation pending"
                    : "Not linked"}
            </strong>
            <small>
              Last Computer Access sign-in: {formatTimestamp(accessStatus.lastSuccessAt)}
            </small>
          </div>
        </div>
      ) : null}

      {accessStatus.lockedUntil ? (
        <p className="computer-access-manager__message computer-access-manager__message--warning">
          Computer Access is locked until {formatTimestamp(accessStatus.lockedUntil)}. Assigning a new PIN clears the lock.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="computer-access-manager__message computer-access-manager__message--error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="computer-access-manager__message computer-access-manager__message--success">
          {successMessage}
        </p>
      ) : null}

      <div className="computer-access-manager__actions">
        <button
          type="button"
          className="computer-access-manager__save"
          disabled={
            !selectedPlayer ||
            saving ||
            username.trim().length < 2 ||
            pin.length !== 6 ||
            confirmPin.length !== 6
          }
          onClick={() => {
            void handleConfigure();
          }}
        >
          {saving
            ? "Saving..."
            : accessStatus.enabled
              ? "Reset PIN / Update Computer Access"
              : "Enable Computer Access"}
        </button>

        {accessStatus.enabled ? (
          <button
            type="button"
            className="computer-access-manager__disable"
            disabled={saving}
            onClick={() => {
              void handleDisable();
            }}
          >
            Disable Computer Access
          </button>
        ) : null}

        <button
          type="button"
          className="computer-access-manager__refresh"
          disabled={loading || saving || !selectedPlayer}
          onClick={() => {
            void refreshStatus();
          }}
        >
          {loading ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>
    </section>
  );
}
