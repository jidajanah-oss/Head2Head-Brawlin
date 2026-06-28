import { useMemo, useState } from "react";
import { useLeague } from "../../context/LeagueContext";
import type { Player } from "../../types/player";
import { nflTeams } from "./nflTeams";
import PlayerCard from "./PlayerCard";
import PlayerForm from "./PlayerForm";

function PlayerManager() {
  const { league, addPlayer, deletePlayer } = useLeague();

  const players = league.players;

  const [name, setName] = useState("");
  const [nflTeam, setNflTeam] = useState("BUF");

  const availableTeams = useMemo(() => {
    const used = new Set(players.map((p) => p.nflTeam));
    return nflTeams.filter((t) => !used.has(t));
  }, [players]);

  const handleAddPlayer = () => {
    if (!name.trim()) return;
    if (players.length >= league.settings.maxPlayers) return;
    if (players.some((p) => p.nflTeam === nflTeam)) return;

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      nflTeam,
      status: "active",
      role: "player",
    };

    addPlayer(newPlayer);

    setName("");
    setNflTeam(availableTeams[0] ?? "");
  };

  return (
    <div className="player-manager">

      <div className="player-header">
        <h2>League Players</h2>
        <div>
          {players.length} / {league.settings.maxPlayers} Players
        </div>
      </div>

      <PlayerForm
        name={name}
        nflTeam={nflTeam}
        availableTeams={availableTeams}
        isAddDisabled={
          players.length >= league.settings.maxPlayers ||
          !name.trim() ||
          !nflTeam
        }
        onNameChange={setName}
        onTeamChange={setNflTeam}
        onAddPlayer={handleAddPlayer}
      />

      <div className="player-list">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onDelete={deletePlayer}
          />
        ))}
      </div>

    </div>
  );
}

export default PlayerManager;
