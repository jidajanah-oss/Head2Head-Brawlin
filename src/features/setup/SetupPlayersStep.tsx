import { useState } from "react";

export default function SetupPlayersStep() {
  const [players, setPlayers] = useState<string[]>([]);
  const [name, setName] = useState("");

  const addPlayer = () => {
    const trimmed = name.trim();

    if (!trimmed) return;
    if (players.length >= 32) return;
    if (players.includes(trimmed)) return;

    setPlayers([...players, trimmed]);
    setName("");
  };

  const removePlayer = (playerName: string) => {
    setPlayers(players.filter((player) => player !== playerName));
  };

  return (
    <div className="setup-players-step">
      <h3>League Players</h3>

      <p>Add all 32 league owners before assigning NFL franchises.</p>

      <div className="setup-player-form">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Owner name"
        />

        <button onClick={addPlayer} disabled={players.length >= 32}>
          Add Player
        </button>
      </div>

      <div className="setup-player-count">
        {players.length} / 32 Players
      </div>

      <div className="setup-player-list">
        {players.map((player) => (
          <div key={player} className="setup-player-row">
            <span>{player}</span>

            <button onClick={() => removePlayer(player)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}