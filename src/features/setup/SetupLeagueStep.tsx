import type { LeagueSetupState } from "./setupTypes";

interface Props {
  setup: LeagueSetupState;
  onChange: (setup: LeagueSetupState) => void;
}

export default function SetupLeagueStep({ setup, onChange }: Props) {
  return (
    <>
      <h3>League Information</h3>

      <label>League Name</label>
      <input
        value={setup.leagueName}
        onChange={(event) =>
          onChange({
            ...setup,
            leagueName: event.target.value,
          })
        }
      />

      <label>Season</label>
      <input
        type="number"
        value={setup.season}
        onChange={(event) =>
          onChange({
            ...setup,
            season: Number(event.target.value),
          })
        }
      />

      <label>Commissioner</label>
      <input
        placeholder="Main commissioner name..."
        value={setup.commissioner}
        onChange={(event) =>
          onChange({
            ...setup,
            commissioner: event.target.value,
          })
        }
      />

      <label>Backup Commissioner</label>
      <input
        placeholder="Backup commissioner name..."
        value={setup.backupCommissioner}
        onChange={(event) =>
          onChange({
            ...setup,
            backupCommissioner: event.target.value,
          })
        }
      />

      <p className="commissioner-step-note">
        The backup commissioner can help manage the league if the main
        commissioner is unavailable.
      </p>
    </>
  );
}