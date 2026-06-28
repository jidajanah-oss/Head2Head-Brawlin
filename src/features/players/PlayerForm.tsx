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
  return (
    <div className="player-form">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Player name"
      />

      <select value={nflTeam} onChange={(e) => onTeamChange(e.target.value)}>
        {availableTeams.map((team) => (
          <option key={team} value={team}>
            {team}
          </option>
        ))}
      </select>

      <button onClick={onAddPlayer} disabled={isAddDisabled}>
        Add Player
      </button>
    </div>
  );
}

export default PlayerForm;