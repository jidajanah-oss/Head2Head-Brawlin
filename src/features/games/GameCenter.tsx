import { useEffect, useMemo, useState } from "react";

import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { getNFLTeamDisplayName, PickLockEngine } from "../../engine";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "./gameCenterUtils";

type FilterId = "all" | "live" | "upcoming" | "locked" | "final";

type TeamPickButtonProps = {
  team: string;
  side: "away" | "home";
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
};

function normalizeStatus(label: string, locked: boolean): FilterId {
  const normalized = label.toLowerCase();

  if (normalized.includes("live")) return "live";
  if (normalized.includes("final")) return "final";
  if (locked) return "locked";

  return "upcoming";
}

function getBadgeVariant(status: FilterId) {
  if (status === "live") return "success";
  if (status === "final") return "neutral";
  if (status === "locked") return "danger";

  return "gold";
}

function getTeamDisplayName(team: string) {
  return getNFLTeamDisplayName(team);
}

function getKickoffWindow(kickoff: unknown) {
  const kickoffDate = new Date(String(kickoff));

  if (Number.isNaN(kickoffDate.getTime())) {
    return "Schedule";
  }

  const day = kickoffDate.toLocaleDateString(undefined, {
    weekday: "long",
  });

  const hour = kickoffDate.getHours();

  if (day === "Thursday") return "Thursday Night Football";
  if (day === "Monday") return "Monday Night Football";
  if (day === "Sunday" && hour < 16) return "Sunday Early Games";
  if (day === "Sunday" && hour < 20) return "Sunday Late Games";
  if (day === "Sunday") return "Sunday Night Football";

  return `${day} Games`;
}

function formatSelectedPick(selected?: string) {
  if (!selected) {
    return "—";
  }

  return `${selected} • ${getTeamDisplayName(selected)}`;
}

function TeamPickButton({
  team,
  side,
  selected,
  disabled,
  onPick,
}: TeamPickButtonProps) {
  const displayName = getTeamDisplayName(team);

  return (
    <button
      className={`game-center-team-pick team-wordmark-button ${
        selected ? "is-selected" : ""
      } ${disabled ? "is-disabled" : ""}`.trim()}
      disabled={disabled}
      onClick={onPick}
      type="button"
    >
      <span className="game-center-team-side">{side}</span>

      <span className="team-wordmark" aria-hidden="true">
        <strong className="team-wordmark-abbr">{team}</strong>
        <span className="team-wordmark-name">{displayName}</span>
      </span>

      <small>{selected ? "Selected" : disabled ? "Locked" : "Pick"}</small>
    </button>
  );
}

function GameCenter() {
  const {
    league,
    picks,
    setPick,
    activePlayerId,
    setGameResults,
  } = useLeague();

  const {
    week,
    setWeek,
    snapshot,
    loading,
    error,
    refresh,
  } = useNFL();

  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  useEffect(() => {
    if (week !== league.currentWeek) {
      setWeek(league.currentWeek);
    }
  }, [league.currentWeek, setWeek, week]);

  const games = snapshot?.weekGames ?? [];
  const playerPicks = picks[activePlayerId] || {};

  const enhancedGames = useMemo(
    () =>
      games.map((game) => {
        const locked = PickLockEngine.isPickLocked(game);
        const label = getStatusLabel(game);
        const status = normalizeStatus(label, locked);
        const selected = playerPicks[game.id];

        return {
          game,
          label,
          locked,
          selected,
          status,
          window: getKickoffWindow(game.kickoff),
        };
      }),
    [games, playerPicks]
  );

  const filteredGames = enhancedGames.filter((item) => {
    if (activeFilter === "all") {
      return true;
    }

    return item.status === activeFilter;
  });

  const groupedGames = filteredGames.reduce<
    Record<string, typeof filteredGames>
  >((groups, item) => {
    const currentGroup = groups[item.window] ?? [];

    return {
      ...groups,
      [item.window]: [...currentGroup, item],
    };
  }, {});

  const liveCount = enhancedGames.filter(
    (item) => item.status === "live"
  ).length;

  const upcomingCount = enhancedGames.filter(
    (item) => item.status === "upcoming"
  ).length;

  const lockedCount = enhancedGames.filter(
    (item) => item.status === "locked"
  ).length;

  const finalCount = enhancedGames.filter(
    (item) => item.status === "final"
  ).length;

  const filterItems: Array<{
    id: FilterId;
    label: string;
    count: number;
  }> = [
    {
      id: "all",
      label: "All",
      count: enhancedGames.length,
    },
    {
      id: "live",
      label: "Live",
      count: liveCount,
    },
    {
      id: "upcoming",
      label: "Upcoming",
      count: upcomingCount,
    },
    {
      id: "locked",
      label: "Locked",
      count: lockedCount,
    },
    {
      id: "final",
      label: "Final",
      count: finalCount,
    },
  ];

  const loadTestResults = () => {
    setGameResults({
      "2026-W1-G1": "PHI",
    });
  };

  const handlePick = (
    gameId: string,
    team: string,
    locked: boolean
  ) => {
    if (!activePlayerId || locked) {
      return;
    }

    setPick(activePlayerId, gameId, team);
  };

  return (
    <main className="games games-v2">
      <SteelHero
        eyebrow="Live NFL Schedule"
        title="Game Center"
        subtitle={`Week ${league.currentWeek} command board for picks, kickoff status, and matchup tracking.`}
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Standings"
        secondaryHref="/standings"
        rightContent={
          <div className="game-center-hero-panel">
            <span>Week {league.currentWeek}</span>

            <strong>
              {loading ? "Loading..." : `${games.length} Games`}
            </strong>

            <small>
              {liveCount > 0
                ? `${liveCount} live now`
                : "Board active"}
            </small>
          </div>
        }
      />

      <section className="game-center-toolbar">
        <div className="game-center-filter-row">
          {filterItems.map((filter) => (
            <button
              className={`game-center-filter ${
                activeFilter === filter.id ? "is-active" : ""
              }`}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
            >
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>

        {import.meta.env.DEV ? (
          <div className="game-center-dev-tools">
            <SteelButton
              onClick={() => void refresh()}
              size="sm"
              variant="secondary"
            >
              Refresh NFL Data
            </SteelButton>

            <SteelButton
              onClick={loadTestResults}
              size="sm"
              variant="ghost"
            >
              Load Test Results
            </SteelButton>
          </div>
        ) : null}
      </section>

      {loading ? (
        <SteelCard
          className="game-center-state-card"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="Loading"
            title="Loading NFL games..."
            description="Pulling the latest schedule and game status for the current week."
          />
        </SteelCard>
      ) : null}

      {error ? (
        <SteelCard
          className="game-center-state-card is-error"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="NFL Data Error"
            title="Unable to load game data"
            description={error}
          />
        </SteelCard>
      ) : null}

      {!loading && games.length === 0 ? (
        <SteelCard
          className="game-center-state-card"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="No Games"
            title="No games loaded for this week."
            description="Try refreshing NFL data or check the selected league week."
          />
        </SteelCard>
      ) : null}

      <div className="games-list game-center-list">
        {Object.entries(groupedGames).map(
          ([groupName, groupGames]) => (
            <section
              className="game-center-group"
              key={groupName}
            >
              <SteelSectionHeader
                eyebrow="NFL Board"
                title={groupName}
                description={`${groupGames.length} matchup${
                  groupGames.length === 1 ? "" : "s"
                }`}
              />

              <div className="game-center-card-grid">
                {groupGames.map(
                  ({
                    game,
                    label,
                    locked,
                    selected,
                    status,
                  }) => (
                    <SteelCard
                      className={`game-card game-center-card game-center-card--${status}`}
                      key={game.id}
                      as="article"
                    >
                      <div className="game-center-card-top">
                        <SteelBadge
                          variant={getBadgeVariant(status)}
                        >
                          {getStatusEmoji(game)} {label}
                        </SteelBadge>

                        {status === "live" ? (
                          <span className="game-center-live-ribbon">
                            Live Now
                          </span>
                        ) : null}
                      </div>

                      <div className="game-center-matchup">
                        <TeamPickButton
                          disabled={
                            locked || !activePlayerId
                          }
                          onPick={() =>
                            handlePick(
                              game.id,
                              game.awayTeam,
                              locked
                            )
                          }
                          selected={
                            selected === game.awayTeam
                          }
                          side="away"
                          team={game.awayTeam}
                        />

                        <div className="game-center-at">@</div>

                        <TeamPickButton
                          disabled={
                            locked || !activePlayerId
                          }
                          onPick={() =>
                            handlePick(
                              game.id,
                              game.homeTeam,
                              locked
                            )
                          }
                          selected={
                            selected === game.homeTeam
                          }
                          side="home"
                          team={game.homeTeam}
                        />
                      </div>

                      <div className="game-center-details">
                        <div>
                          <span>Kickoff</span>
                          <strong>
                            {formatKickoff(game.kickoff)}
                          </strong>
                        </div>

                        <div>
                          <span>Pick Status</span>
                          <strong>
                            {locked ? "Locked" : "Open"}
                          </strong>
                        </div>

                        <div>
                          <span>Your Pick</span>
                          <strong>
                            {formatSelectedPick(selected)}
                          </strong>
                        </div>
                      </div>

                      {activePlayerId && selected ? (
                        <p className="game-center-selection-note">
                          Selected pick:{" "}
                          <strong>
                            {formatSelectedPick(selected)}
                          </strong>
                        </p>
                      ) : null}
                    </SteelCard>
                  )
                )}
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}

export default GameCenter;