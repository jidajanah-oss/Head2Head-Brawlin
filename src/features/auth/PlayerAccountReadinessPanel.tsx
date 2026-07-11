import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import {
  loadPlayerAccountReadiness,
  preparePlayerAccountInvitation,
  revokePlayerAccountInvitation,
  sendPlayerAccountInvitation,
  syncCloudRoster,
  type PlayerAccountReadiness,
  type PlayerAccountStatus,
} from "../../services/cloudRosterService";
import { supabaseClient } from "../../services/supabaseClient";

function getStatusLabel(status: PlayerAccountStatus): string {
  if (status === "linked") return "Linked";
  if (status === "invitation_pending") return "Invitation pending";
  return "Not linked";
}

function getStatusVariant(
  status: PlayerAccountStatus,
): "success" | "info" | "neutral" {
  if (status === "linked") return "success";
  if (status === "invitation_pending") return "info";
  return "neutral";
}

function formatDate(value: string | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString();
}

export default function PlayerAccountReadinessPanel() {
  const { status, accountLink, access } = useAuth();
  const { league } = useLeague();
  const [records, setRecords] = useState<PlayerAccountReadiness[]>([]);
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null,
  );

  const rosterKey = useMemo(
    () =>
      JSON.stringify(
        league.players.map((player) => ({
          id: player.id,
          name: player.name,
          nflTeam: player.nflTeam,
          role: player.role,
          status: player.status,
          customLogo: player.customLogo ?? null,
        })),
      ),
    [league.players],
  );

  const refresh = useCallback(async () => {
    const client = supabaseClient;
    if (!client || !accountLink || !access.canManageAccounts) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await syncCloudRoster(
        client,
        accountLink.leagueId,
        league.players,
      );

      const nextRecords = await loadPlayerAccountReadiness(
        client,
        accountLink.leagueId,
      );

      setRecords(nextRecords);
      setEmailDrafts((current) => {
        const next = { ...current };
        for (const record of nextRecords) {
          if (!(record.playerId in next)) {
            next[record.playerId] = record.email ?? "";
          }
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh player account status.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    access.canManageAccounts,
    accountLink,
    league.players,
  ]);

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
    rosterKey,
    status,
  ]);

  if (
    status !== "signed-in-linked" ||
    !accountLink ||
    !access.canManageAccounts
  ) {
    return null;
  }

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handlePrepare = async (record: PlayerAccountReadiness) => {
    const client = supabaseClient;
    if (!client) return;

    clearMessages();
    setBusyPlayerId(record.playerId);

    try {
      await preparePlayerAccountInvitation(
        client,
        accountLink.leagueId,
        record.playerId,
        emailDrafts[record.playerId] ?? "",
      );
      setSuccessMessage(
        `Invitation prepared for ${record.displayName}. Nothing has been emailed yet.`,
      );
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare the invitation.",
      );
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleSend = async (record: PlayerAccountReadiness) => {
    const client = supabaseClient;
    if (!client || !record.invitationId) return;

    clearMessages();
    setBusyPlayerId(record.playerId);

    try {
      const result = await sendPlayerAccountInvitation(
        client,
        record.invitationId,
      );
      setSuccessMessage(result.message);
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the invitation.",
      );
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleRevoke = async (record: PlayerAccountReadiness) => {
    const client = supabaseClient;
    if (!client || !record.invitationId) return;

    clearMessages();
    setBusyPlayerId(record.playerId);

    try {
      await revokePlayerAccountInvitation(
        client,
        record.invitationId,
      );
      setSuccessMessage(
        `Pending invitation revoked for ${record.displayName}.`,
      );
      setEmailDrafts((current) => ({
        ...current,
        [record.playerId]: "",
      }));
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to revoke the invitation.",
      );
    } finally {
      setBusyPlayerId(null);
    }
  };

  return (
    <SteelCard className="cloud-roster-panel" variant="elevated">
      <SteelSectionHeader
        eyebrow="Commissioner Only"
        title="Player Account Readiness"
        description="Add names and NFL teams below even when you do not have email addresses. Email is needed only when you are ready to invite that player."
        action={
          <SteelButton
            type="button"
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </SteelButton>
        }
      />

      {errorMessage ? (
        <p className="cloud-roster-message cloud-roster-message--error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="cloud-roster-message cloud-roster-message--success">
          {successMessage}
        </p>
      ) : null}

      <div className="cloud-roster-list">
        {records.map((record) => {
          const isBusy = busyPlayerId === record.playerId;
          const sentAt = formatDate(record.lastSentAt);
          const expiresAt = formatDate(record.invitationExpiresAt);
          const isLinked = record.accountStatus === "linked";
          const isPending =
            record.accountStatus === "invitation_pending";
          const hasDraftEmail = Boolean(
            emailDrafts[record.playerId]?.trim(),
          );

          return (
            <article className="cloud-roster-player" key={record.playerId}>
              <div className="cloud-roster-player__heading">
                <div>
                  <h3>{record.displayName}</h3>
                  <p>
                    {record.nflTeam} · {record.role.replaceAll("_", " ")}
                  </p>
                </div>
                <SteelBadge
                  variant={getStatusVariant(record.accountStatus)}
                >
                  {sentAt && isPending
                    ? "Invitation sent"
                    : getStatusLabel(record.accountStatus)}
                </SteelBadge>
              </div>

              <label className="cloud-roster-email-field">
                Login email
                <input
                  type="email"
                  autoComplete="off"
                  value={emailDrafts[record.playerId] ?? record.email ?? ""}
                  placeholder="Add later when available"
                  disabled={isLinked || isBusy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setEmailDrafts((current) => ({
                      ...current,
                      [record.playerId]: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="cloud-roster-player__details">
                {isLinked ? (
                  <span>
                    Account linked
                    {formatDate(record.linkedAt)
                      ? ` · ${formatDate(record.linkedAt)}`
                      : ""}
                  </span>
                ) : null}
                {sentAt ? <span>Sent: {sentAt}</span> : null}
                {expiresAt && isPending ? (
                  <span>Expires: {expiresAt}</span>
                ) : null}
              </div>

              {!isLinked ? (
                <div className="cloud-roster-player__actions">
                  <SteelButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isBusy || !hasDraftEmail}
                    onClick={() => void handlePrepare(record)}
                  >
                    {isPending ? "Update invitation" : "Prepare invitation"}
                  </SteelButton>

                  {isPending && !record.lastSentAt ? (
                    <SteelButton
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void handleSend(record)}
                    >
                      Send invitation
                    </SteelButton>
                  ) : null}

                  {isPending ? (
                    <SteelButton
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={isBusy}
                      onClick={() => void handleRevoke(record)}
                    >
                      Revoke
                    </SteelButton>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!loading && records.length === 0 ? (
        <p className="cloud-roster-empty">
          No cloud roster records are available yet.
        </p>
      ) : null}
    </SteelCard>
  );
}
