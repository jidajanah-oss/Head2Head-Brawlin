import { useMemo, useState } from "react";
import type { LeagueSetupState } from "./setupTypes";

interface Props {
  setup: LeagueSetupState;
  onChange: (setup: LeagueSetupState) => void;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function getPlayerRoleLabel(playerName: string, setup: LeagueSetupState) {
  const name = normalizeName(playerName);
  const commissioner = normalizeName(setup.commissioner);
  const backupCommissioner = normalizeName(setup.backupCommissioner);

  if (commissioner && name === commissioner) {
    return "Commissioner";
  }

  if (backupCommissioner && name === backupCommissioner) {
    return "Backup Commish";
  }

  return "Player";
}

export default function SetupPlayerManager({ setup, onChange }: Props) {
  const [newPlayer, setNewPlayer] = useState("");
  const [search, setSearch] = useState("");

  const duplicate = useMemo(() => {
    return setup.players.some(
      (player) => normalizeName(player.name) === normalizeName(newPlayer)
    );
  }, [newPlayer, setup.players]);

  function addPlayer() {
    const name = newPlayer.trim();

    if (!name) return;
    if (duplicate) return;
    if (setup.players.length >= 32) return;

    onChange({
      ...setup,
      players: [
        ...setup.players,
        {
          id: crypto.randomUUID(),
          name,
        },
      ],
    });

    setNewPlayer("");
  }

  function removePlayer(id: string) {
    onChange({
      ...setup,
      players: setup.players.filter((player) => player.id !== id),
    });
  }

  const filteredPlayers = setup.players.filter((player) =>
    player.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <h3>League Players</h3>

      <p>Add the 32 owners participating this season.</p>

      <div className="setup-player-toolbar">
        <input
          placeholder="Owner name..."
          value={newPlayer}
          onChange={(event) => setNewPlayer(event.target.value)}
        />

        <button
          onClick={addPlayer}
          disabled={duplicate || setup.players.length >= 32}
        >
          Add
        </button>
      </div>

      {duplicate && (
        <p className="setup-error">
          That owner already exists.
        </p>
      )}

      <div className="setup-progress-label">
        {setup.players.length} / 32 Players
      </div>

      <input
        placeholder="Search owners..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="player-table">
        <div className="player-table-header">
          <span>Owner</span>
          <span>Role</span>
          <span>Status</span>
          <span></span>
        </div>

        {filteredPlayers.map((player) => (
          <div key={player.id} className="player-row">
            <span>{player.name}</span>

            <span>{getPlayerRoleLabel(player.name, setup)}</span>

            <span>
              {player.franchiseId ? "Assigned" : "Unassigned"}
            </span>

            <button onClick={() => removePlayer(player.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </>
  );
}