import { useState } from "react";

import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
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

const steps = [
  "League",
  "Players",
  "Franchises",
  "Review",
  "Start Season",
];

function getStepStatus(index: number, currentStep: number) {
  if (index === currentStep) return "Active";
  if (index < currentStep) return "Complete";
  return "Pending";
}

function SetupWizard() {
  const { league } = useLeague();
  const [currentStep, setCurrentStep] = useState(0);
  const [setup, setSetup] = useState<LeagueSetupState>(defaultLeagueSetup);

  const currentStepName = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const nextStep = () => {
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const previousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
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
          label="Season"
          value="Active"
          helper={league.settings.season}
          icon="🏈"
        />
      </section>

      <SteelCard className="commissioner-progress-card" as="section">
        <SteelSectionHeader
          eyebrow="Setup Wizard"
          title="League Operations"
          description="Configure league settings, players, franchise assignments, and season launch."
          action={<SteelBadge variant="gold">{currentStepName}</SteelBadge>}
        />

        <div className="setup-progress">
          {steps.map((step, index) => {
            const status = getStepStatus(index, currentStep);

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
                <div className="step-number">{index + 1}</div>
                <div className="step-title">{step}</div>
                <span>{status}</span>
              </div>
            );
          })}
        </div>
      </SteelCard>

      <SteelCard className="setup-card commissioner-workspace-card" as="section">
        {currentStep === 0 && (
          <>
            <SteelSectionHeader
              eyebrow="Step 1"
              title="League Setup"
              description="Set the league identity and core season configuration."
            />
            <SetupLeagueStep setup={setup} onChange={setSetup} />
          </>
        )}

        {currentStep === 1 && (
          <>
            <SteelSectionHeader
              eyebrow="Step 2"
              title="Player Manager"
              description="Add, review, and organize league players."
            />
            <SetupPlayerManager setup={setup} onChange={setSetup} />
          </>
        )}

        {currentStep === 2 && (
          <>
            <SteelSectionHeader
              eyebrow="Step 3"
              title="Franchise Assignment"
              description="Assign each league owner to one NFL franchise."
            />

            <p className="commissioner-step-note">
              Custom franchise logos will automatically appear here once they
              are uploaded.
            </p>

            <FranchiseAssignmentBoard setup={setup} onChange={setSetup} />
          </>
        )}

        {currentStep === 3 && (
          <>
            <SteelSectionHeader
              eyebrow="Step 4"
              title="Review League Setup"
              description="Check league configuration before starting the season."
            />
            <SetupReviewStep setup={setup} />
          </>
        )}

        {currentStep === 4 && (
          <>
            <SteelSectionHeader
              eyebrow="Step 5"
              title="Start Season"
              description="Launch the league when setup checks are complete."
            />
            <StartSeasonStep setup={setup} />
          </>
        )}
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