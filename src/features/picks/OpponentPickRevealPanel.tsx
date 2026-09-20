import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { useCloudPickHydration } from "../../services/cloudPickHydrationService";
import { usePickerClickerCloudAuthority } from "../../services/pickerClickerCloudAuthorityService";
import { getEffectivePlayerPick, getPickerClickerWeekId } from "../../engine";
import { getNFLTeamDisplayName } from "../../engine";
import {
  loadCloudOpponentPickReveal,
  type CloudOpponentPickReveal,
  type CloudOpponentRevealedPick,
  type CloudOpponentSubmissionStatus,
} from "../../services/cloudOpponentPickRevealService";
import { createLiveReadRefresh, refreshOnReturn } from "../../services/liveReadRefresh";
import { supabaseClient } from "../../services/supabaseClient";
import { visibleOpponentReveal, revealedOpponentPick } from "./visibleOpponentReveal";

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

function getPickSelectionLabel(pick: CloudOpponentRevealedPick, abbreviationsOnly = false): string {
  if (pick.effectiveTeam) {
    const teamLabel = abbreviationsOnly ? pick.effectiveTeam : `${pick.effectiveTeam} • ${getNFLTeamDisplayName(
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

export default function OpponentPickRevealPanel({ comparison = false }: { comparison?: boolean }) {
  const { status, accountLink } = useAuth();
  const { league, activePlayerId, picks, pickerClickerHistory } = useLeague();
  const { season, snapshot, loading: scheduleLoading } = useNFL();
  const hydration = useCloudPickHydration(accountLink, season, league.currentWeek);
  const authority = usePickerClickerCloudAuthority();
  const localWeekState = pickerClickerHistory[getPickerClickerWeekId(season, league.currentWeek)] ?? null;
  const weekState = authority.status === "ready" && authority.season === season &&
    authority.week === league.currentWeek && authority.assignment &&
    authority.assignment.sourcePlayerId === localWeekState?.assignment.sourcePlayerId
      ? localWeekState : null;
  const [loadedReveal, setReveal] = useState<CloudOpponentPickReveal | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readerRef = useRef<ReturnType<typeof createLiveReadRefresh<CloudOpponentPickReveal>> | null>(null);

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

  // Never render a response retained from another account, entry, season, or week.
  const reveal = visibleOpponentReveal(loadedReveal, {
    allowed: canRequestReveal, leagueId: accountLink?.leagueId,
    playerId: selectedPlayerId, season, week: league.currentWeek,
  });

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

  const loadReveal = useCallback(async (_showLoading: boolean) => {
    await readerRef.current?.refresh();
  }, []);

  useEffect(() => {
    const client = supabaseClient;
    setReveal(null);
    setMessage(null);
    setLoading(false);
    if (!client || !target || !canRequestReveal) return;
    const reader = createLiveReadRefresh({
      load: () => loadCloudOpponentPickReveal(client, target),
      apply: value => { setReveal(value); setMessage(null); },
      error: error => { setReveal(null); setMessage(getErrorMessage(error)); },
      loading: setLoading,
      intervalMs: REFRESH_INTERVAL_MS,
    });
    readerRef.current = reader;
    const stop = refreshOnReturn(reader.refresh);
    void reader.refresh();
    return () => { reader.dispose(); stop(); readerRef.current = null; };
  }, [canRequestReveal, target, season, accountLink?.userId]);

  const revealedPickCount =
    reveal?.revealedPicks.length ?? 0;

  const statusBadge = !isLinked ? (
    <SteelBadge variant="neutral">Local only</SteelBadge>
  ) : !canRequestReveal ? (
    <SteelBadge variant="neutral">Account protected</SteelBadge>
  ) : reveal?.canReveal && revealedPickCount > 0 ? (
    <SteelBadge variant="success">Locked picks shown</SteelBadge>
  ) : reveal?.canReveal ? (
    <SteelBadge variant="gold">Waiting for lock</SteelBadge>
  ) : (
    <SteelBadge variant="gold">Waiting for entries</SteelBadge>
  );

  let description =
    "Opponent selections stay hidden game-by-game until each game's five-minute lock.";
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
          title={comparison ? "My Picks vs Oppponent Picks" : "Head-to-Head Opponent Picks"}
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

        {comparison ? (
          <div className="pick-comparison">
            <div className="pick-comparison-heading">
              <span>Game</span><strong>My Picks</strong><strong>Opponent Picks</strong>
            </div>
            {(snapshot?.weekGames ?? []).filter(game => game.week === league.currentWeek).map(game => {
              const mine = getEffectivePlayerPick({ playerId: selectedPlayerId, gameId: game.id, picks, weekState });
              // Only the protected RPC may supply opponent selections, including PC fallbacks.
              const opponent = revealedOpponentPick(reveal, game.id);
              const ownPickReady = (!accountLink || hydration === "ready") &&
                (!isLinked || isViewingOwnPlayer || isCommissioner);
              const picksDiffer = ownPickReady && Boolean(mine.team && opponent?.effectiveTeam &&
                mine.team.trim().toUpperCase() !== opponent.effectiveTeam.trim().toUpperCase());
              const ownLabel = accountLink && hydration !== "ready"
                ? hydration === "error" ? "Saved picks unavailable" : "Loading saved picks…"
                : isLinked && !isViewingOwnPlayer && !isCommissioner ? "Account protected"
                : mine.team ? `${mine.source === "manual" ? "" : "Picker Clicker → "}${mine.team}`
                : mine.source === "missing" ? "No pick recorded" : "Picker Clicker pending";
              const hiddenLabel = reveal?.matchupType === "bye" ? "Bye — no opponent"
                : reveal?.matchupType === "open-opponent" ? "Open team — no entry"
                : !isLinked ? "Sign in to reveal"
                : !canRequestReveal ? "Account protected"
                : message ? "Opponent picks unavailable"
                : reveal && !reveal.canReveal ? "Waiting for both entries"
                : "Hidden until lock";
              return (
                <article className="pick-comparison-row" key={game.id}>
                  <div className="pick-comparison-game"><strong>{game.awayTeam} @ {game.homeTeam}</strong><small>{formatKickoff(game.kickoff)}</small></div>
                  <div><span className="pick-comparison-mobile-label">My Picks</span><strong className={picksDiffer ? "pick-comparison-different" : undefined}>{ownLabel}</strong></div>
                  <div><span className="pick-comparison-mobile-label">Opponent Picks</span><strong className={picksDiffer ? "pick-comparison-different" : undefined}>{opponent ? getPickSelectionLabel(opponent, true) : hiddenLabel}</strong></div>
                </article>
              );
            })}
            {!snapshot?.weekGames.some(game => game.week === league.currentWeek) ? <p className="opponent-reveal-waiting">{scheduleLoading ? "Loading this week's games…" : "No games available for this week yet."}</p> : null}
          </div>
        ) : reveal?.matchupType === "bye" ? (
          <p className="opponent-reveal-waiting">
            This franchise has a bye, so there are no opponent picks to reveal.
          </p>
        ) : reveal?.matchupType === "open-opponent" ? (
          <p className="opponent-reveal-waiting">
            The NFL opponent is not owned by an active league player.
          </p>
        ) : reveal && !reveal.canReveal ? (
          <p className="opponent-reveal-waiting">
            Waiting for both head-to-head entries to be submitted at least
            once. No opponent selections have been returned to this browser.
          </p>
        ) : reveal?.canReveal && revealedPickCount === 0 ? (
          <p className="opponent-reveal-waiting">
            Both entries are on file. Opponent selections will appear one game
            at a time when that game's five-minute lock arrives.
          </p>
        ) : reveal?.canReveal ? (
          <>
            <p className="opponent-reveal-waiting">
              Only games whose five-minute lock has arrived are shown. Later
              games remain hidden and may still be changed.
            </p>
            <div className="opponent-reveal-games">
              {reveal.revealedPicks.map((pick) => (
                <OpponentPickRow key={pick.gameId} pick={pick} />
              ))}
            </div>
          </>
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
