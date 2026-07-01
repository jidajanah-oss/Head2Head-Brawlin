import type { LeagueSetupState } from "./setupTypes";
import {
  hasAllFranchises,
  hasAllPlayers,
  hasBackupCommissioner,
  hasCommissioner,
  hasValidCommissionerTeam,
} from "./setupTypes";
import SetupValidationPanel from "./SetupValidationPanel";

interface Props {
  setup: LeagueSetupState;
}

export default function SetupReviewStep({ setup }: Props) {
  return (
    <>
      <h3>League Review</h3>

      <div className="review-card">
        <p>
          <strong>League:</strong> {setup.leagueName}
        </p>

        <p>
          <strong>Season:</strong> {setup.season}
        </p>

        <p>
          <strong>Commissioner:</strong>{" "}
          {setup.commissioner || "Not Entered"}
        </p>

        <p>
          <strong>Backup Commissioner:</strong>{" "}
          {setup.backupCommissioner || "Not Entered"}
        </p>

        <hr />

        <p>
          <strong>Players:</strong> {setup.players.length}/32
        </p>

        <p>
          <strong>Franchises:</strong>{" "}
          {setup.players.filter((player) => player.franchiseId).length}/32
        </p>

        <hr />

        <h4>Status</h4>

        <ul>
          <li>
            {hasCommissioner(setup)
              ? "✅ Commissioner Entered"
              : "❌ Commissioner Required"}
          </li>

          <li>
            {hasBackupCommissioner(setup)
              ? "✅ Backup Commissioner Entered"
              : "❌ Backup Commissioner Required"}
          </li>

          <li>
            {hasValidCommissionerTeam(setup)
              ? "✅ Commissioner Team Valid"
              : "❌ Commissioner and Backup Must Be Different"}
          </li>

          <li>
            {hasAllPlayers(setup)
              ? "✅ 32 Players"
              : "❌ Need 32 Players"}
          </li>

          <li>
            {hasAllFranchises(setup)
              ? "✅ All Franchises Assigned"
              : "❌ Missing Franchise Assignments"}
          </li>
        </ul>
      </div>

      <SetupValidationPanel setup={setup} />
    </>
  );
}