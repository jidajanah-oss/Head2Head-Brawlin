import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import type { PlayerRole } from "../../types/player";

type ReadinessStatusFilter =
  | "all"
  | PlayerAccountStatus;

type ReadinessRoleFilter =
  | "all"
  | "league_leadership"
  | "players";

type ReadinessSummary = {
  linked: number;
  invitationPending: number;
  notLinked: number;
};

function getStatusLabel(
  record: PlayerAccountReadiness,
): string {
  if (record.accountStatus === "linked") {
    return "Linked";
  }

  if (record.accountStatus === "invitation_pending") {
    return record.lastSentAt
      ? "Invitation sent"
      : "Prepared — not sent";
  }

  return "Not linked";
}

function getStatusVariant(
  status: PlayerAccountStatus,
): "success" | "info" | "neutral" {
  if (status === "linked") {
    return "success";
  }

  if (status === "invitation_pending") {
    return "info";
  }

  return "neutral";
}

function getRoleLabel(role: PlayerRole): string {
  if (role === "commissioner") {
    return "Primary Commissioner";
  }

  if (role === "backup_commissioner") {
    return "Backup Commissioner";
  }

  return "Player";
}

function getRoleRank(role: PlayerRole): number {
  if (role === "commissioner") {
    return 0;
  }

  if (role === "backup_commissioner") {
    return 1;
  }

  return 2;
}

function getPlayerInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "H2H";
}

function formatDate(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function getSummary(
  records: PlayerAccountReadiness[],
): ReadinessSummary {
  return records.reduce<ReadinessSummary>(
    (summary, record) => {
      if (record.accountStatus === "linked") {
        summary.linked += 1;
      } else if (
        record.accountStatus === "invitation_pending"
      ) {
        summary.invitationPending += 1;
      } else {
        summary.notLinked += 1;
      }

      return summary;
    },
    {
      linked: 0,
      invitationPending: 0,
      notLinked: 0,
    },
  );
}

export default function PlayerAccountReadinessPanel() {
  const { status, accountLink, access } = useAuth();
  const { league } = useLeague();

  const [records, setRecords] = useState<
    PlayerAccountReadiness[]
  >([]);

  const [emailDrafts, setEmailDrafts] = useState<
    Record<string, string>
  >({});

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReadinessStatusFilter>("all");
  const [roleFilter, setRoleFilter] =
    useState<ReadinessRoleFilter>("all");

  const [loading, setLoading] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);

  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

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
      await syncCloudRoster(
        client,
        accountLink.leagueId,
        league.players,
      );

      const nextRecords =
        await loadPlayerAccountReadiness(
          client,
          accountLink.leagueId,
        );

      setRecords(nextRecords);

      setEmailDrafts((current) => {
        const next = { ...current };

        for (const record of nextRecords) {
          if (!(record.playerId in next)) {
            next[record.playerId] =
              record.email ?? "";
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

  const summary = useMemo(
    () => getSummary(records),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return [...records]
      .filter((record) => {
        if (
          statusFilter !== "all" &&
          record.accountStatus !== statusFilter
        ) {
          return false;
        }

        if (
          roleFilter === "league_leadership" &&
          record.role === "player"
        ) {
          return false;
        }

        if (
          roleFilter === "players" &&
          record.role !== "player"
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const draftEmail =
          emailDrafts[record.playerId] ??
          record.email ??
          "";

        const searchableText = [
          record.displayName,
          record.nflTeam,
          getRoleLabel(record.role),
          draftEmail,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch,
        );
      })
      .sort((left, right) => {
        const roleDifference =
          getRoleRank(left.role) -
          getRoleRank(right.role);

        if (roleDifference !== 0) {
          return roleDifference;
        }

        return left.displayName.localeCompare(
          right.displayName,
        );
      });
  }, [
    emailDrafts,
    records,
    roleFilter,
    searchTerm,
    statusFilter,
  ]);

  const leadershipRecords = filteredRecords.filter(
    (record) => record.role !== "player",
  );

  const playerRecords = filteredRecords.filter(
    (record) => record.role === "player",
  );

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

  const handleEmailChange = (
    playerId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextEmail = event.target.value;

    setEmailDrafts((current) => ({
      ...current,
      [playerId]: nextEmail,
    }));
  };

  const handlePrepare = async (
    record: PlayerAccountReadiness,
  ) => {
    const client = supabaseClient;

    if (!client) {
      return;
    }

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

  const handleSend = async (
    record: PlayerAccountReadiness,
  ) => {
    const client = supabaseClient;

    if (!client || !record.invitationId) {
      return;
    }

    const targetEmail =
      emailDrafts[record.playerId]?.trim() ||
      record.email ||
      "";

    const approved = window.confirm(
      `Send the Head2Head Brawlin' login invitation to ${record.displayName} at ${targetEmail}?\n\nThis action will send an email now.`,
    );

    if (!approved) {
      return;
    }

    clearMessages();
    setBusyPlayerId(record.playerId);

    try {
      const result =
        await sendPlayerAccountInvitation(
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

  const handleRevoke = async (
    record: PlayerAccountReadiness,
  ) => {
    const client = supabaseClient;

    if (!client || !record.invitationId) {
      return;
    }

    const approved = window.confirm(
      `Revoke the pending invitation for ${record.displayName}?`,
    );

    if (!approved) {
      return;
    }

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

  const renderRecord = (
    record: PlayerAccountReadiness,
  ) => {
    const isBusy =
      busyPlayerId === record.playerId;

    const isLinked =
      record.accountStatus === "linked";

    const isPending =
      record.accountStatus ===
      "invitation_pending";

    const hasDraftEmail = Boolean(
      emailDrafts[record.playerId]?.trim(),
    );

    const linkedAt = formatDate(record.linkedAt);
    const preparedAt = formatDate(
      record.invitationCreatedAt,
    );
    const sentAt = formatDate(record.lastSentAt);
    const expiresAt = formatDate(
      record.invitationExpiresAt,
    );

    return (
      <article
        className={[
          "cloud-roster-player",
          record.role !== "player"
            ? "cloud-roster-player--leadership"
            : "",
          isLinked
            ? "cloud-roster-player--linked"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        key={record.playerId}
      >
        <div className="cloud-roster-player__heading">
          <div className="cloud-roster-player__identity">
            <span
              aria-hidden="true"
              className="cloud-roster-player__initials"
            >
              {getPlayerInitials(
                record.displayName,
              )}
            </span>

            <div>
              <h3>{record.displayName}</h3>

              <p>
                {record.nflTeam} ·{" "}
                {getRoleLabel(record.role)}
              </p>
            </div>
          </div>

          <SteelBadge
            variant={getStatusVariant(
              record.accountStatus,
            )}
          >
            {getStatusLabel(record)}
          </SteelBadge>
        </div>

        <div className="cloud-roster-player__tags">
          <span>
            {record.playerStatus === "active"
              ? "Active roster"
              : "Inactive roster"}
          </span>

          {record.role !== "player" ? (
            <span className="cloud-roster-player__role-tag">
              League leadership
            </span>
          ) : null}
        </div>

        <label className="cloud-roster-email-field">
          <span>Login email</span>

          <input
            autoComplete="off"
            disabled={isBusy || isLinked}
            onChange={(event) =>
              handleEmailChange(
                record.playerId,
                event,
              )
            }
            placeholder="player@example.com"
            type="email"
            value={
              emailDrafts[record.playerId] ?? ""
            }
          />
        </label>

        <div className="cloud-roster-player__details">
          {isLinked ? (
            <span>
              Account linked
              {linkedAt ? ` · ${linkedAt}` : ""}
            </span>
          ) : null}

          {isPending && !sentAt ? (
            <span>
              Prepared only — no email sent
              {preparedAt
                ? ` · ${preparedAt}`
                : ""}
            </span>
          ) : null}

          {sentAt ? (
            <span>Invitation sent: {sentAt}</span>
          ) : null}

          {expiresAt && isPending ? (
            <span>Expires: {expiresAt}</span>
          ) : null}
        </div>

        {!isLinked ? (
          <div className="cloud-roster-player__actions">
            <SteelButton
              disabled={
                isBusy || !hasDraftEmail
              }
              onClick={() => {
                void handlePrepare(record);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isPending
                ? "Update invitation"
                : "Prepare invitation"}
            </SteelButton>

            {isPending && !record.lastSentAt ? (
              <SteelButton
                disabled={isBusy}
                onClick={() => {
                  void handleSend(record);
                }}
                size="sm"
                type="button"
                variant="primary"
              >
                Send invitation email
              </SteelButton>
            ) : null}

            {isPending ? (
              <SteelButton
                disabled={isBusy}
                onClick={() => {
                  void handleRevoke(record);
                }}
                size="sm"
                type="button"
                variant="danger"
              >
                Revoke
              </SteelButton>
            ) : null}
          </div>
        ) : (
          <p className="cloud-roster-player__linked-note">
            This player’s login is connected and ready.
          </p>
        )}
      </article>
    );
  };

  return (
    <SteelCard
      as="section"
      className="cloud-roster-panel"
    >
      <SteelSectionHeader
        action={
          <SteelButton
            disabled={loading}
            onClick={() => {
              void refresh();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {loading
              ? "Refreshing..."
              : "Refresh accounts"}
          </SteelButton>
        }
        description="Prepare and manage player login invitations without changing the league roster."
        eyebrow="Cloud Account Administration"
        title="Player Account Readiness"
      />

      <div className="cloud-roster-safety">
        <strong>Two-step invitation safety</strong>

        <span>
          Prepare invitation saves the email but
          sends nothing. Send invitation email is a
          separate action with a final confirmation.
        </span>
      </div>

      <div className="cloud-roster-summary">
        <div className="cloud-roster-summary__item cloud-roster-summary__item--linked">
          <span>Linked</span>
          <strong>{summary.linked}</strong>
          <small>Ready to sign in</small>
        </div>

        <div className="cloud-roster-summary__item cloud-roster-summary__item--pending">
          <span>Pending</span>
          <strong>
            {summary.invitationPending}
          </strong>
          <small>Prepared or emailed</small>
        </div>

        <div className="cloud-roster-summary__item">
          <span>Not Linked</span>
          <strong>{summary.notLinked}</strong>
          <small>No invitation prepared</small>
        </div>

        <div className="cloud-roster-summary__item">
          <span>Total Roster</span>
          <strong>{records.length}</strong>
          <small>Cloud player records</small>
        </div>
      </div>

      <div className="cloud-roster-toolbar">
        <label className="cloud-roster-toolbar__search">
          <span>Search accounts</span>

          <input
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Player, NFL team, or email"
            type="search"
            value={searchTerm}
          />
        </label>

        <label>
          <span>Account status</span>

          <select
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as ReadinessStatusFilter,
              )
            }
            value={statusFilter}
          >
            <option value="all">
              All statuses
            </option>
            <option value="linked">Linked</option>
            <option value="invitation_pending">
              Pending
            </option>
            <option value="not_linked">
              Not linked
            </option>
          </select>
        </label>

        <label>
          <span>Roster role</span>

          <select
            onChange={(event) =>
              setRoleFilter(
                event.target
                  .value as ReadinessRoleFilter,
              )
            }
            value={roleFilter}
          >
            <option value="all">
              All roles
            </option>
            <option value="league_leadership">
              Commissioners
            </option>
            <option value="players">
              Players
            </option>
          </select>
        </label>
      </div>

      {errorMessage ? (
        <p
          className="cloud-roster-message cloud-roster-message--error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          aria-live="polite"
          className="cloud-roster-message cloud-roster-message--success"
        >
          {successMessage}
        </p>
      ) : null}

      {leadershipRecords.length > 0 ? (
        <section className="cloud-roster-group">
          <div className="cloud-roster-group__heading">
            <div>
              <span>Priority Accounts</span>
              <h3>League Leadership</h3>
            </div>

            <SteelBadge variant="gold">
              {leadershipRecords.length}
            </SteelBadge>
          </div>

          <div className="cloud-roster-list cloud-roster-list--leadership">
            {leadershipRecords.map(renderRecord)}
          </div>
        </section>
      ) : null}

      {playerRecords.length > 0 ? (
        <section className="cloud-roster-group">
          <div className="cloud-roster-group__heading">
            <div>
              <span>League Roster</span>
              <h3>Player Accounts</h3>
            </div>

            <SteelBadge variant="neutral">
              {playerRecords.length}
            </SteelBadge>
          </div>

          <div className="cloud-roster-list">
            {playerRecords.map(renderRecord)}
          </div>
        </section>
      ) : null}

      {!loading &&
      records.length > 0 &&
      filteredRecords.length === 0 ? (
        <p className="cloud-roster-empty">
          No player accounts match the current search
          and filters.
        </p>
      ) : null}

      {!loading && records.length === 0 ? (
        <p className="cloud-roster-empty">
          No cloud roster records are available yet.
        </p>
      ) : null}
    </SteelCard>
  );
}