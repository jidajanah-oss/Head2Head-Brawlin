import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { getNFLTeamDisplayName } from "../../engine";
import {
  loadCloudOpponentPickReveal,
  type CloudOpponentPickReveal,
  type CloudOpponentRevealedPick,
  type CloudOpponentSubmissionStatus,
} from "../../services/cloudOpponentPickRevealService";
import { supabaseClient } from "../../services/supabaseClient";

const REFRESH_INTERVAL_MS = 15_000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load the opponent pick reveal.";
}

function formatKickoff(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatSubmissionStatus(status: CloudOpponentSubmissionStatus): string {
  if (status === "submitted") return "Submitted";
  if (status === "reopened") return "Reopened";
  if (status === "not-applicable") return "N/A";
  return "Not submitted";
}

function submissionBadgeVariant(
  status: CloudOpponentSubmissionStatus,
): "success" | "gold" | "neutral" {
  if (status === "submitted") return "success";
  if (status === "reopened") return "gold";
  return "neutral";
}

function getPickBadge(
  pick: CloudOpponentRevealedPick,
): { label: string; variant: "success" | "gold" | "info" | "danger" } {
  if (pick.intentType === "manual") {
    return {
      label: pick.pickSource === "commissioner" ? "Commissioner" : "Manual",
      variant: "success",
    };
  }
  if (pick.intentType === "picker-clicker-selected") {
    return { label: "Picker Clicker", variant: "gold" };
  }
  if (pick.intentType === "picker-clicker-auto") {
    return { label: "Auto PC", variant: "info" };
  }
  return { label: "No Pick", variant: "danger" };
}

function getPickSelectionLabel(pick: CloudOpponentRevealedPick): string {
  if (pick.effectiveTeam) {
    const teamLabel = `${pick.effectiveTeam} • ${getNFLTeamDisplayName(
      pick.effectiveTeam,
    )}`;
    if (pick.intentType === "picker-clicker-selected") {
      return `Picker Clicker → ${teamLabel}`;
    }
    if (pick.intentType === "picker-clicker-auto") {
      return `Automatic Picker Clicker → ${teamLabel}`;
    }
    return teamLabel;
  }

  if (pick.intentType === "picker-clicker-selected") {
    return pick.locked
      ? "Picker Clicker source had no pick"
      : "Picker Clicker source pick pending";
  }
  if (pick.intentType === "picker-clicker-auto") {
    return "Automatic Picker Clicker source had no pick";
  }
  return "No pick recorded";
}

function OpponentPickRow({ pick }: { pick: CloudOpponentRevealedPick }) {
  const badge = getPickBadge(pick);
  const sourceLabel = pick.sourcePlayerName
    ? `Source: ${pick.sourcePlayerName}`
    : null;

  return (
    <article className="opponent-reveal-game">
      <div className="opponent-reveal-game-heading">
        <div>
          <strong>
            {pick.awayTeam} @ {pick.homeTeam}
          </strong>
          <span>{formatKickoff(pick.kickoffAt)}</span>
        </div>
        <SteelBadge variant={badge.variant}>{badge.label}</SteelBadge>
      </div>
      <p>{getPickSelectionLabel(pick)}</p>
      {sourceLabel ? <small>{sourceLabel}</small> : null}
    </article>
  );
}

export default function OpponentPickRevealPanel() {
  const { status, accountLink } = useAuth();
  const { league, activePlayerId } = useLeague();
  const [reveal, setReveal] = useState<CloudOpponentPickReveal | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const selectedPlayerId = activePlayerId || accountLink?.playerId || "";
  const selectedPlayer = league.players.find(
    (player) => player.id === selectedPlayerId,
  );
  const isLinked = status === "signed-in-linked" && Boolean(accountLink);
  const isCommissioner = Boolean(
    accountLink &&
      (accountLink.role === "commissioner" ||
        accountLink.role === "backup_commissioner"),
  );
  const isViewingOwnPlayer = Boolean(
    accountLink && selectedPlayerId === accountLink.playerId,
  );
  const canRequestReveal = Boolean(
    isLinked && selectedPlayerId && (isViewingOwnPlayer || isCommissioner),
  );

  const target = useMemo(() => {
    if (!accountLink || !selectedPlayerId) {
      return null;
    }
    return {
      leagueId: accountLink.leagueId,
      playerId: selectedPlayerId,
      week: league.currentWeek,
    };
  }, [accountLink, league.currentWeek, selectedPlayerId]);

  const loadReveal = useCallback(
    async (showLoading: boolean) => {
      const client = supabaseClient;
      if (!client || !target || !canRequestReveal) {
        requestIdRef.current += 1;
        setReveal(null);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (showLoading) {
        setLoading(true);
      }

      try {
        const nextReveal = await loadCloudOpponentPickReveal(client, target);
        if (requestId === requestIdRef.current) {
          setReveal(nextReveal);
          setMessage(null);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setReveal(null);
          setMessage(getErrorMessage(error));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [canRequestReveal, target],
  );

  useEffect(() => {
    void loadReveal(true);
    if (!canRequestReveal) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      void loadReveal(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
      requestIdRef.current += 1;
    };
  }, [canRequestReveal, loadReveal]);

  const statusBadge = !isLinked ? (
    <SteelBadge variant="neutral">Local only</SteelBadge>
  ) : !canRequestReveal ? (
    <SteelBadge variant="neutral">Account protected</SteelBadge>
  ) : reveal?.canReveal ? (
    <SteelBadge variant="success">Revealed</SteelBadge>
  ) : (
    <SteelBadge variant="gold">Waiting</SteelBadge>
  );

  let description =
    "Opponent selections appear only after both head-to-head entries are submitted.";
  if (!isLinked) {
    description = "Sign in with a linked account to use protected opponent reveal.";
  } else if (!canRequestReveal) {
    description =
      "Switch back to your linked player to view your protected matchup.";
  }

  return (
    <section className="opponent-reveal-shell">
      <SteelCard className="opponent-reveal-card" variant="gold">
        <SteelSectionHeader
          eyebrow={`Season ${league.settings.season} • Week ${league.currentWeek}`}
          title="Head-to-Head Opponent Picks"
          description={description}
          action={statusBadge}
        />

        <div className="opponent-reveal-matchup">
          <div>
            <span>Selected entry</span>
            <strong>{selectedPlayer?.name ?? "No player selected"}</strong>
            <small>
              {selectedPlayer
                ? `${selectedPlayer.nflTeam} franchise`
                : "Choose a league player"}
            </small>
          </div>
          <div aria-hidden="true" className="opponent-reveal-versus">
            VS
          </div>
          <div>
            <span>Week opponent</span>
            <strong>
              {reveal?.opponentPlayerName ??
                (reveal?.matchupType === "bye"
                  ? "Bye Week"
                  : reveal?.matchupType === "open-opponent"
                    ? "Open NFL Team"
                    : "Waiting")}
            </strong>
            <small>
              {reveal?.opponentNflTeam
                ? `${reveal.opponentNflTeam} franchise`
                : "No linked opponent entry"}
            </small>
          </div>
        </div>

        {reveal?.matchupType === "owned-opponent" ? (
          <div className="opponent-reveal-submissions">
            <div>
              <span>{reveal.viewerPlayerName}</span>
              <SteelBadge
                variant={submissionBadgeVariant(
                  reveal.viewerSubmissionStatus,
                )}
              >
                {formatSubmissionStatus(reveal.viewerSubmissionStatus)}
              </SteelBadge>
            </div>
            <div>
              <span>{reveal.opponentPlayerName ?? "Opponent"}</span>
              <SteelBadge
                variant={submissionBadgeVariant(
                  reveal.opponentSubmissionStatus,
                )}
              >
                {formatSubmissionStatus(reveal.opponentSubmissionStatus)}
              </SteelBadge>
            </div>
          </div>
        ) : null}

        {message ? <p className="opponent-reveal-message">{message}</p> : null}

        {reveal?.matchupType === "bye" ? (
          <p className="opponent-reveal-waiting">
            This franchise has a bye, so there are no opponent picks to reveal.
          </p>
        ) : reveal?.matchupType === "open-opponent" ? (
          <p className="opponent-reveal-waiting">
            The NFL opponent is not owned by an active league player.
          </p>
        ) : reveal && !reveal.canReveal ? (
          <p className="opponent-reveal-waiting">
            Waiting for both head-to-head entries to be submitted. No opponent
            selections have been returned to this browser.
          </p>
        ) : reveal?.canReveal ? (
          <div className="opponent-reveal-games">
            {reveal.revealedPicks.map((pick) => (
              <OpponentPickRow key={pick.gameId} pick={pick} />
            ))}
          </div>
        ) : null}

        {canRequestReveal ? (
          <div className="opponent-reveal-actions">
            <SteelButton
              disabled={loading}
              onClick={() => void loadReveal(true)}
              size="sm"
              variant="ghost"
            >
              {loading ? "Checking…" : "Refresh Opponent Status"}
            </SteelButton>
          </div>
        ) : null}
      </SteelCard>
    </section>
  );
}
