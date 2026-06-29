import type { LeagueSetupState } from "./setupTypes";

interface Props {
  setup: LeagueSetupState;
  onChange: (setup: LeagueSetupState) => void;
}

export default function SetupLeagueStep({
  setup,
  onChange,
}: Props) {
  return (
    <>
      <h3>League Information</h3>

      <label>League Name</label>
      <input
        value={setup.leagueName}
        onChange={(e) =>
          onChange({
            ...setup,
            leagueName: e.target.value,
          })
        }
      />

      <label>Season</label>

      <input
        type="number"
        value={setup.season}
        onChange={(e) =>
          onChange({
            ...setup,
            season: Number(e.target.value),
          })
        }
      />

      <label>Commissioner</label>

      <input
        value={setup.commissioner}
        onChange={(e) =>
          onChange({
            ...setup,
            commissioner: e.target.value,
          })
        }
      />
    </>
  );
}