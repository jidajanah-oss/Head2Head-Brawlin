import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  loadPlayerAccountReadiness,
  type PlayerAccountReadiness,
} from "../../services/cloudRosterService";
import { resetLinkedPlayerAccount } from "../../services/cloudAccountResetService";
import { supabaseClient } from "../../services/supabaseClient";
import "../../styles/linkedAccountReset.css";

function getRoleLabel(
  record: PlayerAccountReadiness,
): string {
  if (record.role === "backup_commissioner") {
    return "Backup Commissioner";
  }

  return "Player";
}

export default function LinkedPlayerAccountResetPanel() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const [linkedPlayers, setLinkedPlayers] = useState<
    PlayerAccountReadiness[]
  >([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const client = supabaseClient;

    if (
      !client ||
      !accountLink ||
      !access.canManageAccounts
    ) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const records = await loadPlayerAccountReadiness(
        client,
        accountLink.leagueId,
      );

      const resettablePlayers = records
        .filter(
          (record) =>
            record.accountStatus === "linked" &&
            record.role !== "commissioner",
        )
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        );

      setLinkedPlayers(resettablePlayers);
      setSelectedPlayerId((current) => {
        if (
          current &&
          resettablePlayers.some(
            (record) => record.playerId === current,
          )
        ) {
          return current;
        }

        return resettablePlayers[0]?.playerId ?? "";
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load linked player accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, [access.canManageAccounts, accountLink]);

  useEffect(() => {
    if (
      status === "signed-in-linked" &&
      accountLink &&
      access.canManageAccounts
    ) {
      void refresh();
    }
  }, [
    access.canManageAccounts,
    accountLink,
    refresh,
    status,
  ]);

  const selectedPlayer = useMemo(
    () =>
      linkedPlayers.find(
        (record) => record.playerId === selectedPlayerId,
      ) ?? null,
    [linkedPlayers, selectedPlayerId],
  );

  if (
    status !== "signed-in-linked" ||
    !accountLink ||
    !access.canManageAccounts
  ) {
    return null;
  }

  const handleReset = async () => {
    const client = supabaseClient;

    if (!client || !selectedPlayer) {
      return;
    }

    const approved = window.confirm(
      [
        `Reset the login link for ${selectedPlayer.displayName}?`,
        "",
        `${selectedPlayer.displayName} will remain assigned to ${selectedPlayer.nflTeam}.`,
        "Picks, standings, roster data, and payouts will not be changed.",
        "The currently linked user will immediately lose league access.",
        "",
        "You will then prepare and send the correct invitation from Player Account Readiness.",
      ].join("\n"),
    );

    if (!approved) {
      return;
    }

    const typedName = window.prompt(
      `Type ${selectedPlayer.displayName} to confirm the account reset.`,
    );

    if (typedName?.trim() !== selectedPlayer.displayName) {
      setErrorMessage(
        "Account reset canceled because the player name did not match.",
      );
      setSuccessMessage(null);
      return;
    }

    setResetting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resetLinkedPlayerAccount(
        client,
        accountLink.leagueId,
        selectedPlayer.playerId,
      );

      setSuccessMessage(
        `${selectedPlayer.displayName}'s account link was reset. Use Refresh accounts in Player Account Readiness, enter the correct email, and prepare the new invitation.`,
      );

      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset the selected linked account.",
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <section className="linked-account-reset-panel">
      <div className="linked-account-reset-panel__header">
        <div>
          <p className="linked-account-reset-panel__eyebrow">
            Cloud Account Repair
          </p>
          <h2>Reset Incorrect Player Link</h2>
          <p>
            Disconnect a linked login from the wrong player without changing
            that player&apos;s team, picks, standings, payouts, or roster record.
          </p>
        </div>

        <span className="linked-account-reset-panel__badge">
          Primary commissioner only
        </span>
      </div>

      <div className="linked-account-reset-panel__warning">
        Jimbo&apos;s primary commissioner link is permanently protected. Bruce Lee
        or an ordinary player can be reset only after that exact account is
        selected and confirmed.
      </div>

      <div className="linked-account-reset-panel__controls">
        <label>
          Linked player account
          <select
            disabled={loading || resetting || linkedPlayers.length === 0}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setSelectedPlayerId(event.target.value);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            value={selectedPlayerId}
          >
            {linkedPlayers.length === 0 ? (
              <option value="">No resettable linked accounts</option>
            ) : null}
            {linkedPlayers.map((record) => (
              <option key={record.playerId} value={record.playerId}>
                {record.displayName} — {record.nflTeam}
              </option>
            ))}
          </select>
        </label>

        <button
          className="linked-account-reset-panel__refresh"
          disabled={loading || resetting}
          onClick={() => {
            void refresh();
          }}
          type="button"
        >
          {loading ? "Refreshing..." : "Refresh linked accounts"}
        </button>
      </div>

      {selectedPlayer ? (
        <div className="linked-account-reset-panel__selection">
          <div>
            <span>Selected player</span>
            <strong>{selectedPlayer.displayName}</strong>
            <small>
              {selectedPlayer.nflTeam} · {getRoleLabel(selectedPlayer)}
            </small>
          </div>

          <div>
            <span>Current login email</span>
            <strong>{selectedPlayer.email ?? "Email unavailable"}</strong>
            <small>
              The Supabase Auth user is not deleted by this reset.
            </small>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="linked-account-reset-panel__message linked-account-reset-panel__message--error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="linked-account-reset-panel__message linked-account-reset-panel__message--success">
          {successMessage}
        </p>
      ) : null}

      <button
        className="linked-account-reset-panel__reset"
        disabled={!selectedPlayer || loading || resetting}
        onClick={() => {
          void handleReset();
        }}
        type="button"
      >
        {resetting ? "Resetting account link..." : "Reset Selected Account Link"}
      </button>
    </section>
  );
}
