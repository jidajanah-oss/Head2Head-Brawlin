import { useEffect, useMemo, useState } from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { getNFLTeamDisplayName, PickLockEngine } from "../../engine";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "../games/gameCenterUtils";
import PlayerSelector from "../players/PlayerSelector";

type PickFilter = "all" | "open" | "picked" | "missing" | "locked";

type TeamPickOptionProps = {
  team: string;
  side: "away" | "home";
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function getTeamDisplayName(team: string) {
  return getNFLTeamDisplayName(team);
}

function getPickBadgeVariant(locked: boolean, selected?: string) {
  if (locked) return "danger";
  if (selected) return "success";
  return "gold";
}

function getPickBadgeLabel(locked: boolean, selected?: string) {
  if (locked) return "Locked";
  if (selected) return "Picked";
  return "Open";
}

function formatSelectedPick(selected?: string) {
  if (!selected) {
    return "—";
  }

  return `${selected} • ${getTeamDisplayName(selected)}`;
}

function TeamPickOption({
  team,
  side,
  selected,
  disabled,
  onSelect,
}: TeamPickOptionProps) {
  const displayName = getTeamDisplayName(team);

  return (
    <button
      className={`pick-option-v2 ${selected ? "is-selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="pick-option-side">{side}</span>

      <FranchiseLogo
        className="pick-option-logo"
        displayName={displayName}
        nflTeam={team}
        size="md"
      />

      <strong>{displayName}</strong>

      <small>{selected ? "Selected" : disabled ? "Locked" : "Tap to pick"}</small>
    </button>
  );
}

function PickSheet() {
  const { league, picks, setPick, activePlayerId } = useLeague();
  const { week, setWeek, snapshot, loading, error } = useNFL();

  const [activeFilter, setActiveFilter] = useState<PickFilter>("all");

  useEffect(() => {
    if (week !== league.currentWeek) {
      setWeek(league.currentWeek);
    }
  }, [league.currentWeek, setWeek, week]);

  const games = snapshot?.weekGames ?? [];
  const activePicks = picks[activePlayerId] || {};

  const pickRows = useMemo(
    () =>
      games.map((game) => {
        const locked = PickLockEngine.isPickLocked(game);
        const selected = activePicks[game.id];

        return {
          game,
          locked,
          selected,
          statusLabel: getStatusLabel(game),
        };
      }),
    [activePicks, games]
  );

  const totalGames = pickRows.length;
  const pickedCount = pickRows.filter((row) => row.selected).length;
  const lockedCount = pickRows.filter((row) => row.locked).length;
  const openCount = pickRows.filter((row) => !row.locked).length;
  const missingCount = pickRows.filter(
    (row) => !row.locked && !row.selected
  ).length;

  const filteredRows = pickRows.filter((row) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "open") return !row.locked;
    if (activeFilter === "picked") return Boolean(row.selected);
    if (activeFilter === "missing") return !row.locked && !row.selected;
    if (activeFilter === "locked") return row.locked;

    return true;
  });

  const filters: Array<{ id: PickFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: totalGames },
    { id: "open", label: "Open", count: openCount },
    { id: "picked", label: "Picked", count: pickedCount },
    { id: "missing", label: "Missing", count: missingCount },
    { id: "locked", label: "Locked", count: lockedCount },
  ];

  const handlePick = (gameId: string, team: string, locked: boolean) => {
    if (!activePlayerId || locked) {
      return;
    }

    setPick(activePlayerId, gameId, team);
  };

  return (
    <main className="pick-sheet picks-v2">
      <SteelHero
        eyebrow="Weekly Pick Card"
        title="Make Picks"
        subtitle={`Week ${league.currentWeek} selections for Head2Head Brawlin' – Steel Edition.`}
        primaryLabel="Game Center"
        primaryHref="/games"
        secondaryLabel="Standings"
        secondaryHref="/standings"
        rightContent={
          <div className="picks-hero-panel">
            <span>Pick Progress</span>

            <strong>
              {pickedCount}/{totalGames || 0}
            </strong>

            <small>
              {missingCount > 0 ? `${missingCount} still open` : "Card complete"}
            </small>
          </div>
        }
      />

      <section className="picks-player-panel">
        <SteelSectionHeader
          eyebrow="Active Player"
          title="Select your pick card"
          description="Choose the player before making weekly selections."
        />

        <PlayerSelector />
      </section>

      <section className="picks-stat-grid">
        <SteelStatCard
          label="Games"
          value={loading ? "..." : totalGames}
          helper={`Week ${league.currentWeek} schedule`}
          icon="🏈"
        />

        <SteelStatCard
          label="Picked"
          value={loading ? "..." : pickedCount}
          helper="Selections made"
          icon="✅"
        />

        <SteelStatCard
          label="Missing"
          value={loading ? "..." : missingCount}
          helper="Still available"
          icon="⚠️"
        />

        <SteelStatCard
          label="Locked"
          value={loading ? "..." : lockedCount}
          helper="Kickoff closed"
          icon="🔒"
        />
      </section>

      <section className="picks-toolbar">
        <div className="picks-filter-row">
          {filters.map((filter) => (
            <button
              className={`picks-filter ${
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
      </section>

      {loading ? (
        <SteelCard className="picks-state-card" as="section">
          <SteelSectionHeader
            eyebrow="Loading"
            title="Loading pick sheet..."
            description="Pulling this week's schedule and lock status."
          />
        </SteelCard>
      ) : null}

      {error ? (
        <SteelCard className="picks-state-card is-error" as="section">
          <SteelSectionHeader
            eyebrow="NFL Data Error"
            title="Unable to load pick sheet"
            description={error}
          />
        </SteelCard>
      ) : null}

      {!loading && totalGames === 0 ? (
        <SteelCard className="picks-state-card" as="section">
          <SteelSectionHeader
            eyebrow="No Games"
            title="No games available for this week."
            description="Check the Game Center or reload NFL data."
          />
        </SteelCard>
      ) : null}

      <section className="picks-card-grid">
        {filteredRows.map(({ game, locked, selected, statusLabel }) => {
          const disabled = locked || !activePlayerId;

          return (
            <SteelCard
              className={`picks-card-v2 ${selected ? "has-selection" : ""} ${
                locked ? "is-locked" : ""
              }`.trim()}
              key={game.id}
              as="article"
            >
              <div className="picks-card-top">
                <SteelBadge variant={getPickBadgeVariant(locked, selected)}>
                  {getPickBadgeLabel(locked, selected)}
                </SteelBadge>

                <SteelBadge variant={locked ? "danger" : "neutral"}>
                  {getStatusEmoji(game)} {statusLabel}
                </SteelBadge>
              </div>

              <div className="picks-matchup-v2">
                <TeamPickOption
                  disabled={disabled}
                  onSelect={() => handlePick(game.id, game.awayTeam, locked)}
                  selected={selected === game.awayTeam}
                  side="away"
                  team={game.awayTeam}
                />

                <div className="picks-at">@</div>

                <TeamPickOption
                  disabled={disabled}
                  onSelect={() => handlePick(game.id, game.homeTeam, locked)}
                  selected={selected === game.homeTeam}
                  side="home"
                  team={game.homeTeam}
                />
              </div>

              <div className="picks-card-details">
                <div>
                  <span>Kickoff</span>
                  <strong>{formatKickoff(game.kickoff)}</strong>
                </div>

                <div>
                  <span>Pick Status</span>
                  <strong>{locked ? "Locked" : "Open"}</strong>
                </div>

                <div>
                  <span>Your Pick</span>
                  <strong>{formatSelectedPick(selected)}</strong>
                </div>
              </div>

              <p className="picks-status-v2">
                {locked ? "🔒 Locked" : "🟡 Open"}{" "}
                {selected ? (
                  <strong>Pick: {formatSelectedPick(selected)}</strong>
                ) : (
                  <span>No pick selected</span>
                )}
              </p>
            </SteelCard>
          );
        })}
      </section>
    </main>
  );
}

export default PickSheet;