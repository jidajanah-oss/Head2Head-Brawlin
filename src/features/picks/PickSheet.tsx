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
import {
  getEffectivePlayerPick,
  getNFLTeamDisplayName,
  getPickerClickerWeekId,
  getPlayerPickerClickerFallbackCount,
  isPlayerWeeklyPrizeEligible,
  PickLockEngine,
  type EffectivePickSource,
} from "../../engine";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "../games/gameCenterUtils";
import PlayerSelector from "../players/PlayerSelector";

type PickFilter =
  | "all"
  | "open"
  | "picked"
  | "missing"
  | "locked";

type TeamPickOptionProps = {
  team: string;
  side: "away" | "home";
  selected: boolean;
  disabled: boolean;
  pickSource: EffectivePickSource;
  onSelect: () => void;
};

function getTeamDisplayName(team: string) {
  return getNFLTeamDisplayName(team);
}

function getPickBadgeVariant(
  locked: boolean,
  selected?: string
) {
  if (locked && !selected) return "danger";
  if (selected) return "success";
  return "gold";
}

function getPickBadgeLabel(
  locked: boolean,
  selected?: string,
  pickSource?: EffectivePickSource
) {
  if (
    selected &&
    pickSource === "picker-clicker"
  ) {
    return "Picker Clicker";
  }

  if (selected) return "Picked";
  if (locked) return "No Pick";

  return "Open";
}

function formatSelectedPick(
  selected?: string,
  pickSource?: EffectivePickSource
) {
  if (!selected) {
    return "—";
  }

  const pickLabel = `${selected} • ${getTeamDisplayName(
    selected
  )}`;

  if (pickSource === "picker-clicker") {
    return `${pickLabel} • PC`;
  }

  return pickLabel;
}

function TeamPickOption({
  team,
  side,
  selected,
  disabled,
  pickSource,
  onSelect,
}: TeamPickOptionProps) {
  const displayName = getTeamDisplayName(team);

  const statusLabel = selected
    ? pickSource === "picker-clicker"
      ? "Picker Clicker"
      : "Selected"
    : disabled
      ? "No Pick"
      : "Tap to pick";

  return (
    <button
      className={`pick-option-v2 team-wordmark-button ${
        selected ? "is-selected" : ""
      } ${
        selected &&
        pickSource === "picker-clicker"
          ? "is-picker-clicker"
          : ""
      } ${disabled ? "is-disabled" : ""}`.trim()}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="pick-option-side">
        {side}
      </span>

      <span
        className="team-wordmark"
        aria-hidden="true"
      >
        <strong className="team-wordmark-abbr">
          {team}
        </strong>

        <span className="team-wordmark-name">
          {displayName}
        </span>
      </span>

      <small>{statusLabel}</small>
    </button>
  );
}

function PickSheet() {
  const {
    league,
    picks,
    setPick,
    activePlayerId,
    pickerClickerHistory,
  } = useLeague();

  const {
    season,
    week,
    setWeek,
    snapshot,
    loading,
    error,
  } = useNFL();

  const [activeFilter, setActiveFilter] =
    useState<PickFilter>("all");

  useEffect(() => {
    if (week !== league.currentWeek) {
      setWeek(league.currentWeek);
    }
  }, [
    league.currentWeek,
    setWeek,
    week,
  ]);

  const games =
    snapshot?.weekGames ?? [];

  const pickerClickerWeekState =
    pickerClickerHistory[
      getPickerClickerWeekId(
        season,
        league.currentWeek
      )
    ] ?? null;

  const pickerClickerAssignment =
    pickerClickerWeekState?.assignment;

  const pickerClickerSourcePlayer =
    pickerClickerAssignment
      ? league.players.find(
          (player) =>
            player.id ===
            pickerClickerAssignment.sourcePlayerId
        )
      : null;

  const activeFallbackCount =
    activePlayerId
      ? getPlayerPickerClickerFallbackCount(
          activePlayerId,
          pickerClickerWeekState
        )
      : 0;

  const activePlayerWeeklyPrizeEligible =
    activePlayerId
      ? isPlayerWeeklyPrizeEligible(
          activePlayerId,
          pickerClickerWeekState
        )
      : true;

  const pickRows = useMemo(
    () =>
      games.map((game) => {
        const locked =
          PickLockEngine.isPickLocked(game);

        const effectivePick =
          activePlayerId
            ? getEffectivePlayerPick({
                playerId: activePlayerId,
                gameId: game.id,
                picks,
                weekState:
                  pickerClickerWeekState,
              })
            : {
                playerId: "",
                gameId: game.id,
                team: null,
                source:
                  "missing" as const,
                sourcePlayerId: null,
                weeklyPrizeEligible: true,
              };

        return {
          game,
          locked,
          selected:
            effectivePick.team ?? undefined,
          pickSource:
            effectivePick.source,
          statusLabel:
            getStatusLabel(game),
        };
      }),
    [
      activePlayerId,
      games,
      pickerClickerWeekState,
      picks,
    ]
  );

  const totalGames = pickRows.length;

  const pickedCount = pickRows.filter(
    (row) => row.selected
  ).length;

  const lockedCount = pickRows.filter(
    (row) => row.locked
  ).length;

  const openCount = pickRows.filter(
    (row) => !row.locked
  ).length;

  const missingCount = pickRows.filter(
    (row) =>
      !row.locked &&
      !row.selected
  ).length;

  const filteredRows = pickRows.filter(
    (row) => {
      if (activeFilter === "all") {
        return true;
      }

      if (activeFilter === "open") {
        return !row.locked;
      }

      if (activeFilter === "picked") {
        return Boolean(row.selected);
      }

      if (activeFilter === "missing") {
        return (
          !row.locked &&
          !row.selected
        );
      }

      if (activeFilter === "locked") {
        return row.locked;
      }

      return true;
    }
  );

  const filters: Array<{
    id: PickFilter;
    label: string;
    count: number;
  }> = [
    {
      id: "all",
      label: "All",
      count: totalGames,
    },
    {
      id: "open",
      label: "Open",
      count: openCount,
    },
    {
      id: "picked",
      label: "Picked",
      count: pickedCount,
    },
    {
      id: "missing",
      label: "Missing",
      count: missingCount,
    },
    {
      id: "locked",
      label: "Locked",
      count: lockedCount,
    },
  ];

  const handlePick = (
    gameId: string,
    team: string,
    locked: boolean
  ) => {
    if (
      !activePlayerId ||
      locked
    ) {
      return;
    }

    setPick(
      activePlayerId,
      gameId,
      team
    );
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
              {pickedCount}/
              {totalGames || 0}
            </strong>

            <small>
              {missingCount > 0
                ? `${missingCount} still open`
                : "Card complete"}
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

      <SteelCard
        className="picks-picker-clicker-card"
        as="section"
      >
        <SteelSectionHeader
          eyebrow={`Week ${league.currentWeek} Picker Clicker`}
          title={
            pickerClickerAssignment
              ? pickerClickerAssignment.sourcePlayerName
              : "Assigning weekly source..."
          }
          description={
            pickerClickerAssignment
              ? `${pickerClickerAssignment.sourceNFLTeam} • ${getTeamDisplayName(
                  pickerClickerAssignment.sourceNFLTeam
                )} • Nonrepeating random cycle ${pickerClickerAssignment.cycleNumber}`
              : "The weekly source will be selected automatically from active players."
          }
          action={
            <SteelBadge
              variant={
                activePlayerWeeklyPrizeEligible
                  ? "success"
                  : "danger"
              }
            >
              {activePlayerWeeklyPrizeEligible
                ? "Prize Eligible"
                : "Prize Ineligible"}
            </SteelBadge>
          }
        />

        <div className="picks-picker-clicker-body">
          <FranchiseLogo
            nflTeam={
              pickerClickerSourcePlayer?.nflTeam ??
              pickerClickerAssignment?.sourceNFLTeam
            }
            customLogo={
              pickerClickerSourcePlayer?.customLogo
            }
            displayName={
              pickerClickerAssignment?.sourcePlayerName ??
              "Picker Clicker"
            }
            size="lg"
            variant="tile"
          />

          <div className="picks-picker-clicker-copy">
            <span>
              Automatic fallback status
            </span>

            <strong>
              {activeFallbackCount > 0
                ? `${activeFallbackCount} locked game${
                    activeFallbackCount === 1
                      ? ""
                      : "s"
                  } assisted`
                : "No automatic picks used"}
            </strong>

            <small>
              Missing locked picks copy the
              weekly source player. When the
              source also has no pick, the game
              counts as incorrect.
            </small>
          </div>
        </div>
      </SteelCard>

      <section className="picks-stat-grid">
        <SteelStatCard
          label="Games"
          value={
            loading
              ? "..."
              : totalGames
          }
          helper={`Week ${league.currentWeek} schedule`}
          icon="🏈"
        />

        <SteelStatCard
          label="Picked"
          value={
            loading
              ? "..."
              : pickedCount
          }
          helper="Manual and PC selections"
          icon="✅"
        />

        <SteelStatCard
          label="Missing"
          value={
            loading
              ? "..."
              : missingCount
          }
          helper="Still available"
          icon="⚠️"
        />

        <SteelStatCard
          label="Locked"
          value={
            loading
              ? "..."
              : lockedCount
          }
          helper="Pick windows closed"
          icon="🔒"
        />
      </section>

      <section className="picks-toolbar">
        <div className="picks-filter-row">
          {filters.map((filter) => (
            <button
              className={`picks-filter ${
                activeFilter === filter.id
                  ? "is-active"
                  : ""
              }`}
              key={filter.id}
              onClick={() =>
                setActiveFilter(filter.id)
              }
              type="button"
            >
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <SteelCard
          className="picks-state-card"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="Loading"
            title="Loading pick sheet..."
            description="Pulling this week's schedule and lock status."
          />
        </SteelCard>
      ) : null}

      {error ? (
        <SteelCard
          className="picks-state-card is-error"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="NFL Data Error"
            title="Unable to load pick sheet"
            description={error}
          />
        </SteelCard>
      ) : null}

      {!loading &&
      totalGames === 0 ? (
        <SteelCard
          className="picks-state-card"
          as="section"
        >
          <SteelSectionHeader
            eyebrow="No Games"
            title="No games available for this week."
            description="Check the Game Center or reload NFL data."
          />
        </SteelCard>
      ) : null}

      <section className="picks-card-grid">
        {filteredRows.map(
          ({
            game,
            locked,
            selected,
            pickSource,
            statusLabel,
          }) => {
            const disabled =
              locked ||
              !activePlayerId;

            return (
              <SteelCard
                className={`picks-card-v2 ${
                  selected
                    ? "has-selection"
                    : ""
                } ${
                  pickSource ===
                  "picker-clicker"
                    ? "has-picker-clicker"
                    : ""
                } ${
                  locked
                    ? "is-locked"
                    : ""
                }`.trim()}
                key={game.id}
                as="article"
              >
                <div className="picks-card-top">
                  <SteelBadge
                    variant={getPickBadgeVariant(
                      locked,
                      selected
                    )}
                  >
                    {getPickBadgeLabel(
                      locked,
                      selected,
                      pickSource
                    )}
                  </SteelBadge>

                  <SteelBadge
                    variant={
                      locked
                        ? "danger"
                        : "neutral"
                    }
                  >
                    {getStatusEmoji(game)}{" "}
                    {statusLabel}
                  </SteelBadge>
                </div>

                <div className="picks-matchup-v2">
                  <TeamPickOption
                    disabled={disabled}
                    onSelect={() =>
                      handlePick(
                        game.id,
                        game.awayTeam,
                        locked
                      )
                    }
                    selected={
                      selected ===
                      game.awayTeam
                    }
                    pickSource={
                      selected ===
                      game.awayTeam
                        ? pickSource
                        : "missing"
                    }
                    side="away"
                    team={game.awayTeam}
                  />

                  <div className="picks-at">
                    @
                  </div>

                  <TeamPickOption
                    disabled={disabled}
                    onSelect={() =>
                      handlePick(
                        game.id,
                        game.homeTeam,
                        locked
                      )
                    }
                    selected={
                      selected ===
                      game.homeTeam
                    }
                    pickSource={
                      selected ===
                      game.homeTeam
                        ? pickSource
                        : "missing"
                    }
                    side="home"
                    team={game.homeTeam}
                  />
                </div>

                <div className="picks-card-details">
                  <div>
                    <span>Kickoff</span>

                    <strong>
                      {formatKickoff(
                        game.kickoff
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Pick Status</span>

                    <strong>
                      {locked
                        ? "Locked"
                        : "Open"}
                    </strong>
                  </div>

                  <div>
                    <span>Your Pick</span>

                    <strong>
                      {formatSelectedPick(
                        selected,
                        pickSource
                      )}
                    </strong>
                  </div>
                </div>

                <p className="picks-status-v2">
                  {pickSource ===
                    "picker-clicker" ? (
                    <strong>
                      🖱️ Automatic pick:{" "}
                      {formatSelectedPick(
                        selected,
                        pickSource
                      )}
                    </strong>
                  ) : selected ? (
                    <strong>
                      Pick:{" "}
                      {formatSelectedPick(
                        selected,
                        pickSource
                      )}
                    </strong>
                  ) : locked ? (
                    <span>
                      ❌ No pick counted for this
                      game
                    </span>
                  ) : (
                    <span>
                      No pick selected
                    </span>
                  )}
                </p>
              </SteelCard>
            );
          }
        )}
      </section>
    </main>
  );
}

export default PickSheet;