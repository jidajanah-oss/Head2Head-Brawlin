import { useMemo, useState } from "react";
import type { LeagueSetupState } from "./setupTypes";

interface Props {
  setup: LeagueSetupState;
  onChange: (setup: LeagueSetupState) => void;
}

export default function SetupPlayerManager({
  setup,
  onChange,
}: Props) {
  const [newPlayer, setNewPlayer] = useState("");
  const [search, setSearch] = useState("");

  const duplicate = useMemo(() => {
    return setup.players.some(
      (player) =>
        player.name.trim().toLowerCase() ===
        newPlayer.trim().toLowerCase()
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
      players: setup.players.filter(
        (player) => player.id !== id
      ),
    });
  }

  const filteredPlayers = setup.players.filter((player) =>
    player.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <h3>League Players</h3>

      <p>
        Add the 32 owners participating this season.
      </p>

      <div className="setup-player-toolbar">
        <input
          placeholder="Owner name..."
          value={newPlayer}
          onChange={(e) =>
            setNewPlayer(e.target.value)
          }
        />

        <button
          onClick={addPlayer}
          disabled={
            duplicate ||
            setup.players.length >= 32
          }
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
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

      <div className="player-table">
        <div className="player-table-header">
          <span>Owner</span>
          <span>Status</span>
          <span></span>
        </div>

        {filteredPlayers.map((player) => (
          <div
            key={player.id}
            className="player-row"
          >
            <span>{player.name}</span>

            <span>
              {player.franchiseId
                ? "Assigned"
                : "Unassigned"}
            </span>

            <button
              onClick={() =>
                removePlayer(player.id)
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </>
  );
}