import { useState } from "react";
import type { LeagueSetupState } from "./setupTypes";
import { validateLeague } from "../../lib/setupValidationEngine";
import { generateSeasonFromSetup } from "../../lib/seasonGenerator";

interface Props {
  setup: LeagueSetupState;
}

export default function StartSeasonStep({ setup }: Props) {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  const validation = validateLeague(setup);

  function startSeason() {
    setError("");

    if (!validation.ready) {
      setError("League is not ready to start.");
      return;
    }

    try {
      const season = generateSeasonFromSetup(setup);
      console.log("Generated season:", season);
      setStarted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start season."
      );
    }
  }

  return (
    <>
      <h3>🏆 Ready To Start</h3>

      <p>Starting the season will generate the initial LeagueState.</p>

      <ul>
        <li>League settings</li>
        <li>32 league players</li>
        <li>Week 1 pick sheets</li>
        <li>Empty standings</li>
        <li>Playoff seed placeholders</li>
      </ul>

      {!validation.ready && (
        <div className="validation-errors">
          <strong>Cannot start yet</strong>
          <ul>
            {validation.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="setup-error">{error}</p>}

      {started && (
        <div className="validation-success">
          ✅ Season generated successfully. Check the browser console for the LeagueState.
        </div>
      )}

      <button
        className="start-season-btn"
        onClick={startSeason}
        disabled={!validation.ready}
      >
        🏈 Start Season
      </button>
    </>
  );
}