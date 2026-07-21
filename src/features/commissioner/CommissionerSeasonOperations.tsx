import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  FIRST_REGULAR_SEASON_WEEK,
  getPickerClickerWeekId,
  getWeekControlState,
  LAST_REGULAR_SEASON_WEEK,
} from "../../engine";
import ObscureStatAwardCard from "../awards/ObscureStatAwardCard";
import ProtectedSeasonResetCard from "./ProtectedSeasonResetCard";

import "../../styles/setup.css";
import "../../styles/franchise.css";
import "../../styles/week-control.css";

const regularSeasonWeeks = Array.from(
  {
    length:
      LAST_REGULAR_SEASON_WEEK -
      FIRST_REGULAR_SEASON_WEEK +
      1,
  },
  (_, index) => FIRST_REGULAR_SEASON_WEEK + index,
);

function CommissionerSeasonOperations() {
  const {
    league,
    pickerClickerHistory,
    setCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
  } = useLeague();

  const { season } = useNFL();

  const weekControlState = getWeekControlState(
    league.currentWeek,
  );

  const pickerClickerWeekState =
    pickerClickerHistory[
      getPickerClickerWeekId(
        season,
        league.currentWeek,
      )
    ] ?? null;

  const pickerClickerAssignment =
    pickerClickerWeekState?.assignment;

  const pickerClickerSourcePlayer =
    pickerClickerAssignment
      ? league.players.find(
          (player) =>
            player.id ===
            pickerClickerAssignment.sourcePlayerId,
        )
      : null;

  const assistedPlayerCount =
    pickerClickerWeekState?.ineligiblePlayerIds.length ??
    0;

  const lockedGameCount =
    pickerClickerWeekState?.lockedGameIds.length ?? 0;

  const fallbackPickCount = pickerClickerWeekState
    ? Object.values(
        pickerClickerWeekState.fallbackPicks,
      ).reduce(
        (totalFallbacks, playerFallbacks) =>
          totalFallbacks +
          Object.keys(playerFallbacks).length,
        0,
      )
    : 0;

  return (
    <main className="setup-wizard commissioner-hq-v2">
      <SteelHero
        eyebrow="Commissioner Control Room"
        title="Commissioner HQ"
        subtitle={`${league.settings.leagueName} • ${league.settings.season}`}
        primaryLabel="Game Center"
        primaryHref="/games"
        secondaryLabel="Standings"
        secondaryHref="/standings"
        rightContent={
          <div className="commissioner-hero-panel">
            <span>Active Season</span>
            <strong>{league.settings.season}</strong>
            <small>
              Week {weekControlState.currentWeek} of{" "}
              {LAST_REGULAR_SEASON_WEEK}
            </small>
          </div>
        }
      />

      <section className="commissioner-stat-grid">
        <SteelStatCard
          label="Players"
          value={`${league.players.length}/${league.settings.maxPlayers}`}
          helper="League capacity"
          icon="👥"
        />

        <SteelStatCard
          label="Current Week"
          value={`Week ${league.currentWeek}`}
          helper="Active league week"
          icon="📅"
        />

        <SteelStatCard
          label="Pick Lock"
          value={`${league.settings.pickLockMinutesBeforeKickoff}m`}
          helper="Before kickoff"
          icon="⏱️"
        />

        <SteelStatCard
          label="PC Assists"
          value={fallbackPickCount}
          helper={`${assistedPlayerCount} assisted players`}
          icon="PC"
        />
      </section>

      <SteelCard
        className="commissioner-week-control-card"
        as="section"
      >
        <SteelSectionHeader
          eyebrow="Season Navigation"
          title="Commissioner Week Control"
          description="Select the active regular-season week used by Games, Picks, scoring, standings, Picker Clicker, and the obscure-stat award."
          action={
            <SteelBadge variant="gold">
              Week {weekControlState.currentWeek} of{" "}
              {LAST_REGULAR_SEASON_WEEK}
            </SteelBadge>
          }
        />

        <div className="commissioner-week-control-body">
          <SteelButton
            disabled={!weekControlState.canGoPrevious}
            onClick={goToPreviousWeek}
            size="md"
            variant="secondary"
          >
            ◀ Week {weekControlState.previousWeek}
          </SteelButton>

          <label className="commissioner-week-selector">
            <span>Active League Week</span>

            <select
              aria-label="Select active league week"
              value={weekControlState.currentWeek}
              onChange={(event) => {
                setCurrentWeek(
                  Number(event.target.value),
                );
              }}
            >
              {regularSeasonWeeks.map((week) => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>

            <small>
              {league.settings.season} NFL regular season
            </small>
          </label>

          <SteelButton
            disabled={!weekControlState.canGoNext}
            onClick={goToNextWeek}
            size="md"
            variant="primary"
          >
            Week {weekControlState.nextWeek} ▶
          </SteelButton>
        </div>

        <div className="commissioner-week-progress">
          <div
            className="commissioner-week-progress-track"
            role="progressbar"
            aria-label="Regular-season week progress"
            aria-valuemin={FIRST_REGULAR_SEASON_WEEK}
            aria-valuemax={LAST_REGULAR_SEASON_WEEK}
            aria-valuenow={
              weekControlState.currentWeek
            }
          >
            <span
              style={{
                width: `${weekControlState.progressPercent}%`,
              }}
            />
          </div>

          <div className="commissioner-week-progress-labels">
            <span>
              Week {FIRST_REGULAR_SEASON_WEEK}
            </span>

            <strong>
              {weekControlState.progressPercent}%
            </strong>

            <span>
              Week {LAST_REGULAR_SEASON_WEEK}
            </span>
          </div>
        </div>

        <p className="commissioner-week-control-note">
          Changing the active week loads that week&apos;s
          NFL schedule. Picks, finalized scoring records,
          Picker Clicker history, and obscure-stat results
          from other weeks remain stored and are not
          deleted.
        </p>
      </SteelCard>

      <ObscureStatAwardCard
        className="commissioner-obscure-stat-award"
        showLeaderboard
        showCoinFlipControls
      />

      <SteelCard
        className="commissioner-picker-clicker-card"
        as="section"
      >
        <SteelSectionHeader
          eyebrow={`Week ${league.currentWeek} Automation`}
          title="Picker Clicker Control"
          description="The weekly source is selected automatically from active players without repeating until the cycle is complete."
          action={
            <SteelBadge
              variant={
                pickerClickerAssignment
                  ? "success"
                  : "neutral"
              }
            >
              {pickerClickerAssignment
                ? "Source Assigned"
                : "Waiting"}
            </SteelBadge>
          }
        />

        <div className="commissioner-picker-clicker-body">
          <FranchiseLogo
            nflTeam={
              pickerClickerSourcePlayer?.nflTeam ??
              pickerClickerAssignment?.sourceNFLTeam
            }
            customLogo={
              pickerClickerSourcePlayer?.customLogo
            }
            displayName={
              pickerClickerAssignment
                ?.sourcePlayerName ?? "Picker Clicker"
            }
            size="lg"
            variant="tile"
          />

          <div className="commissioner-picker-clicker-source">
            <span>Weekly Source Player</span>

            <strong>
              {pickerClickerAssignment
                ? pickerClickerAssignment.sourcePlayerName
                : "No source assigned yet"}
            </strong>

            <small>
              {pickerClickerAssignment
                ? `${pickerClickerAssignment.sourceNFLTeam} • Cycle ${pickerClickerAssignment.cycleNumber}`
                : "A source will be created automatically when active players and the weekly schedule are available."}
            </small>
          </div>

          <div className="commissioner-picker-clicker-stats">
            <div>
              <span>Locked Games</span>
              <strong>{lockedGameCount}</strong>
            </div>

            <div>
              <span>Fallback Picks</span>
              <strong>{fallbackPickCount}</strong>
            </div>

            <div>
              <span>Prize Ineligible</span>
              <strong>{assistedPlayerCount}</strong>
            </div>
          </div>
        </div>

        <p className="commissioner-picker-clicker-note">
          Missing locked picks copy the source
          player&apos;s selection. When the source also
          has no selection, no pick is awarded and that
          NFL game is scored incorrect.
        </p>
      </SteelCard>

      <ProtectedSeasonResetCard />
    </main>
  );
}

export default CommissionerSeasonOperations;
