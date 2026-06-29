import { useState } from "react";

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

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [setup, setSetup] =
    useState<LeagueSetupState>(defaultLeagueSetup);

  const nextStep = () => {
    setCurrentStep((step) =>
      Math.min(step + 1, steps.length - 1)
    );
  };

  const previousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  return (
    <div className="setup-wizard">
      <h1>🏈 Head2Head Brawlin'</h1>
      <h2>Commissioner Setup Wizard</h2>

      <div className="setup-progress">
        {steps.map((step, index) => (
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
          </div>
        ))}
      </div>

      <div className="setup-card">
        {currentStep === 0 && (
          <SetupLeagueStep setup={setup} onChange={setSetup} />
        )}

        {currentStep === 1 && (
          <SetupPlayerManager setup={setup} onChange={setSetup} />
        )}

        {currentStep === 2 && (
          <>
            <h3>Franchise Assignment</h3>
            <p>Assign each league owner to one NFL franchise.</p>
            <p>
              Your custom franchise logos will automatically appear here once
              they are uploaded.
            </p>

            <FranchiseAssignmentBoard setup={setup} onChange={setSetup} />
          </>
        )}

        {currentStep === 3 && <SetupReviewStep setup={setup} />}

        {currentStep === 4 && <StartSeasonStep setup={setup} />}
      </div>

      <div className="wizard-buttons">
        <button onClick={previousStep} disabled={currentStep === 0}>
          ◀ Previous
        </button>

        <button
          onClick={nextStep}
          disabled={currentStep === steps.length - 1}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}