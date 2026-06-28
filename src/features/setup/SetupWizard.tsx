import { useState } from "react";
import FranchiseAssignmentBoard from "../franchise/FranchiseAssignmentBoard";
import SetupPlayersStep from "./SetupPlayersStep";

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

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="setup-wizard">
      <h1>🏈 Head2Head Brawlin'</h1>
      <h2>Commissioner Setup Wizard</h2>

      {/* Progress Bar */}
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

        {/* STEP 1 */}
        {currentStep === 0 && (
          <>
            <h3>League Information</h3>

            <label>League Name</label>
            <input
              type="text"
              defaultValue="Head2Head Brawlin'"
            />

            <label>Season</label>
            <input
              type="number"
              defaultValue={2026}
            />

            <label>Commissioner</label>
            <input
              type="text"
              placeholder="Commissioner Name"
            />
          </>
        )}

        {/* STEP 2 */}
        {currentStep === 1 && <SetupPlayersStep />}

        {/* STEP 3 */}
        {currentStep === 2 && (
          <>
            <h3>Franchise Assignment</h3>

            <p>
              Assign each league owner to one NFL franchise.
            </p>

            <p>
              Your custom franchise logos will automatically
              appear here once they are uploaded.
            </p>

            <FranchiseAssignmentBoard />
          </>
        )}

        {/* STEP 4 */}
        {currentStep === 3 && (
          <>
            <h3>League Validation</h3>

            <div
              style={{
                background: "#1e293b",
                padding: 20,
                borderRadius: 12,
              }}
            >
              <h4>Validation Checklist</h4>

              <ul>
                <li>✅ 32 Players Added</li>
                <li>✅ 32 Unique NFL Teams</li>
                <li>✅ All AFC Teams Assigned</li>
                <li>✅ All NFC Teams Assigned</li>
                <li>✅ Every Division Complete</li>
                <li>✅ Ready To Start Season</li>
              </ul>
            </div>
          </>
        )}

        {/* STEP 5 */}
        {currentStep === 4 && (
          <>
            <h3>🏆 Ready To Start</h3>

            <p>
              Starting the season will automatically generate:
            </p>

            <ul>
              <li>Week 1 Pick Sheets</li>
              <li>NFL Schedule</li>
              <li>Player Matchups</li>
              <li>Bye Weeks</li>
              <li>Division Standings</li>
              <li>Conference Standings</li>
              <li>Playoff Picture</li>
              <li>Awards Tracking</li>
              <li>Payout Tracking</li>
            </ul>

            <button
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              🏈 Start Season
            </button>
          </>
        )}

      </div>

      {/* Navigation */}
      <div className="wizard-buttons">
        <button
          onClick={previousStep}
          disabled={currentStep === 0}
        >
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