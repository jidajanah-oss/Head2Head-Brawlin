import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import { getNFLTeamDisplayName, getNFLTeamInfo } from "../../engine";

type PlayerFormProps = {
  name: string;
  nflTeam: string;
  availableTeams: string[];
  isAddDisabled: boolean;
  onNameChange: (name: string) => void;
  onTeamChange: (team: string) => void;
  onAddPlayer: () => void;
};

function PlayerForm({
  name,
  nflTeam,
  availableTeams,
  isAddDisabled,
  onNameChange,
  onTeamChange,
  onAddPlayer,
}: PlayerFormProps) {
  const selectedTeamInfo = getNFLTeamInfo(nflTeam);

  return (
    <div className="player-form">
      <div className="player-manager-logo-shell">
        <FranchiseLogo
          nflTeam={nflTeam}
          displayName={getNFLTeamDisplayName(nflTeam)}
          size="md"
          variant="tile"
        />

        <div>
          <strong>{selectedTeamInfo?.displayName ?? nflTeam}</strong>
          <small>
            {selectedTeamInfo
              ? `${selectedTeamInfo.conference} • ${selectedTeamInfo.division}`
              : "Select an open NFL franchise"}
          </small>
        </div>
      </div>

      <input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Player name"
      />

      <select value={nflTeam} onChange={(event) => onTeamChange(event.target.value)}>
        {availableTeams.map((team) => (
          <option key={team} value={team}>
            {team} — {getNFLTeamDisplayName(team)}
          </option>
        ))}
      </select>

      <button onClick={onAddPlayer} disabled={isAddDisabled} type="button">
        Add Player
      </button>
    </div>
  );
}

export default PlayerForm;