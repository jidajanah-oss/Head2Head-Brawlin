import { validateLeague } from "../../lib/setupValidationEngine";
import type { LeagueSetupState } from "./setupTypes";

interface Props {
  setup: LeagueSetupState;
}

export default function SetupValidationPanel({
  setup,
}: Props) {
  const result = validateLeague(setup);

  return (
    <div className="validation-panel">
      <h3>League Validation</h3>

      {result.ready ? (
        <div className="validation-success">
          ✅ League is ready to start.
        </div>
      ) : (
        <div className="validation-errors">
          <strong>Items Remaining</strong>

          <ul>
            {result.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="validation-stats">
        <div>
          <strong>Players</strong>
          <span>{setup.players.length} / 32</span>
        </div>

        <div>
          <strong>Assigned Franchises</strong>
          <span>
            {setup.players.filter((p) => p.franchiseId).length} / 32
          </span>
        </div>

        <div>
          <strong>Season</strong>
          <span>{setup.season}</span>
        </div>

        <div>
          <strong>Commissioner</strong>
          <span>
            {setup.commissioner || "Not Entered"}
          </span>
        </div>
      </div>
    </div>
  );
}