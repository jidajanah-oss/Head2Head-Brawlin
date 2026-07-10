import { useState } from "react";

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
import FranchiseAssignmentBoard from "../franchise/FranchiseAssignmentBoard";
import SetupLeagueStep from "./SetupLeagueStep";
import SetupPlayerManager from "./SetupPlayerManager";
import SetupReviewStep from "./SetupReviewStep";
import StartSeasonStep from "./StartSeasonStep";
import {
  defaultLeagueSetup,
  type LeagueSetupState,
} from "./setupTypes";

import "../../styles/setup.css";
import "../../styles/franchise.css";
import "../../styles/week-control.css";

const steps = [
  "League",
  "Players",
  "Franchises",
  "Review",
  "Start Season",
];

const regularSeasonWeeks = Array.from(
  {
    length:
      LAST_REGULAR_SEASON_WEEK -
      FIRST_REGULAR_SEASON_WEEK +
      1,
  },
  (_, index) =>
    FIRST_REGULAR_SEASON_WEEK + index,
);

function getStepStatus(
  index: number,
  currentStep: number,
) {
  if (index === currentStep) {
    return "Active";
  }

  if (index < currentStep) {
    return "Complete";
  }

  return "Pending";
}

function SetupWizard() {
  const {
    league,
    pickerClickerHistory,
    setCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
  } = useLeague();

  const { season } = useNFL();

  const [currentStep, setCurrentStep] =
    useState(0);

  const [setup, setSetup] =
    useState<LeagueSetupState>(
      defaultLeagueSetup,
    );

  const currentStepName =
    steps[currentStep];

  const isFirstStep =
    currentStep === 0;

  const isLastStep =
    currentStep === steps.length - 1;

  const weekControlState =
    getWeekControlState(
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
    pickerClickerWeekState
      ?.ineligiblePlayerIds.length ?? 0;

  const lockedGameCount =
    pickerClickerWeekState
      ?.lockedGameIds.length ?? 0;

  const fallbackPickCount =
    pickerClickerWeekState
      ? Object.values(
          pickerClickerWeekState.fallbackPicks,
        ).reduce(
          (
            totalFallbacks,
            playerFallbacks,
          ) =>
            totalFallbacks +
            Object.keys(
              playerFallbacks,
            ).length,
          0,
        )
      : 0;

  const nextStep = () => {
    setCurrentStep((step) =>
      Math.min(
        step + 1,
        steps.length - 1,
      ),
    );
  };

  const previousStep = () => {
    setCurrentStep((step) =>
      Math.max(step - 1, 0),
    );
  };

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
            <span>Setup Progress</span>

            <strong>
              {currentStep + 1}/{steps.length}
            </strong>

            <small>{currentStepName}</small>
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
          icon="🔒"
        />

        <SteelStatCard
          label="PC Assists"
          value={fallbackPickCount}
          helper={`${assistedPlayerCount} assisted players`}
          icon="🖱️"
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
            disabled={
              !weekControlState.canGoPrevious
            }
            onClick={goToPreviousWeek}
            size="md"
            variant="secondary"
          >
            ◀ Week{" "}
            {weekControlState.previousWeek}
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
              {regularSeasonWeeks.map(
                (week) => (
                  <option
                    key={week}
                    value={week}
                  >
                    Week {week}
                  </option>
                ),
              )}
            </select>

            <small>
              {league.settings.season} NFL
              regular season
            </small>
          </label>

          <SteelButton
            disabled={
              !weekControlState.canGoNext
            }
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
            aria-valuemin={
              FIRST_REGULAR_SEASON_WEEK
            }
            aria-valuemax={
              LAST_REGULAR_SEASON_WEEK
            }
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
              Week{" "}
              {FIRST_REGULAR_SEASON_WEEK}
            </span>

            <strong>
              {
                weekControlState.progressPercent
              }
              %
            </strong>

            <span>
              Week{" "}
              {LAST_REGULAR_SEASON_WEEK}
            </span>
          </div>
        </div>

        <p className="commissioner-week-control-note">
          Changing the active week loads that
          week&apos;s NFL schedule. Picks,
          finalized scoring records, Picker
          Clicker history, and obscure-stat
          results from other weeks remain
          stored and are not deleted.
        </p>
      </SteelCard>

      <ObscureStatAwardCard
        className="commissioner-obscure-stat-award"
        showLeaderboard
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
              pickerClickerSourcePlayer
                ?.nflTeam ??
              pickerClickerAssignment
                ?.sourceNFLTeam
            }
            customLogo={
              pickerClickerSourcePlayer
                ?.customLogo
            }
            displayName={
              pickerClickerAssignment
                ?.sourcePlayerName ??
              "Picker Clicker"
            }
            size="lg"
            variant="tile"
          />

          <div className="commissioner-picker-clicker-source">
            <span>Weekly Source Player</span>

            <strong>
              {pickerClickerAssignment
                ? pickerClickerAssignment
                    .sourcePlayerName
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

              <strong>
                {lockedGameCount}
              </strong>
            </div>

            <div>
              <span>Fallback Picks</span>

              <strong>
                {fallbackPickCount}
              </strong>
            </div>

            <div>
              <span>Prize Ineligible</span>

              <strong>
                {assistedPlayerCount}
              </strong>
            </div>
          </div>
        </div>

        <p className="commissioner-picker-clicker-note">
          Missing locked picks copy the source
          player&apos;s selection. When the source
          also has no selection, no pick is awarded
          and that NFL game is scored incorrect.
        </p>
      </SteelCard>

      <SteelCard
        className="commissioner-progress-card"
        as="section"
      >
        <SteelSectionHeader
          eyebrow="Setup Wizard"
          title="League Operations"
          description="Configure league settings, players, franchise assignments, and season launch."
          action={
            <SteelBadge variant="gold">
              {currentStepName}
            </SteelBadge>
          }
        />

        <div className="setup-progress">
          {steps.map((step, index) => {
            const status = getStepStatus(
              index,
              currentStep,
            );

            return (
              <div
                key={step}
                className={`setup-step ${
                  index === currentStep
                    ? "active"
                    : index < currentStep
                      ? "complete"
                      : ""
                }`}
              >
                <div className="step-number">
                  {index + 1}
                </div>

                <div className="step-title">
                  {step}
                </div>

                <span>{status}</span>
              </div>
            );
          })}
        </div>
      </SteelCard>

      <SteelCard
        className="setup-card commissioner-workspace-card"
        as="section"
      >
        {currentStep === 0 ? (
          <>
            <SteelSectionHeader
              eyebrow="Step 1"
              title="League Setup"
              description="Set the league identity and core season configuration."
            />

            <SetupLeagueStep
              setup={setup}
              onChange={setSetup}
            />
          </>
        ) : null}

        {currentStep === 1 ? (
          <>
            <SteelSectionHeader
              eyebrow="Step 2"
              title="Player Manager"
              description="Add, review, and organize league players."
            />

            <SetupPlayerManager
              setup={setup}
              onChange={setSetup}
            />
          </>
        ) : null}

        {currentStep === 2 ? (
          <>
            <SteelSectionHeader
              eyebrow="Step 3"
              title="Franchise Assignment"
              description="Assign each league owner to one NFL franchise."
            />

            <p className="commissioner-step-note">
              Custom franchise logos will
              automatically appear here once they
              are uploaded.
            </p>

            <FranchiseAssignmentBoard
              setup={setup}
              onChange={setSetup}
            />
          </>
        ) : null}

        {currentStep === 3 ? (
          <>
            <SteelSectionHeader
              eyebrow="Step 4"
              title="Review League Setup"
              description="Check league configuration before starting the season."
            />

            <SetupReviewStep
              setup={setup}
            />
          </>
        ) : null}

        {currentStep === 4 ? (
          <>
            <SteelSectionHeader
              eyebrow="Step 5"
              title="Start Season"
              description="Launch the league when setup checks are complete."
            />

            <StartSeasonStep
              setup={setup}
            />
          </>
        ) : null}
      </SteelCard>

      <div className="wizard-buttons">
        <SteelButton
          disabled={isFirstStep}
          onClick={previousStep}
          size="md"
          variant="secondary"
        >
          ◀ Previous
        </SteelButton>

        <SteelButton
          disabled={isLastStep}
          onClick={nextStep}
          size="md"
          variant="primary"
        >
          Next ▶
        </SteelButton>
      </div>
    </main>
  );
}

export default SetupWizard;