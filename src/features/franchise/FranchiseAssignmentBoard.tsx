import { useMemo, useState } from "react";
import { nflFranchises } from "../../lib/nflFranchises";
import type { LeagueSetupState, SetupPlayer } from "../setup/setupTypes";

interface Props {
  setup: LeagueSetupState;
  onChange: (setup: LeagueSetupState) => void;
}

export default function FranchiseAssignmentBoard({ setup, onChange }: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  const selectedPlayer = setup.players.find(
    (player) => player.id === selectedPlayerId
  );

  const unassignedPlayers = setup.players.filter(
    (player) => !player.franchiseId
  );

  const assignedCount = setup.players.filter(
    (player) => player.franchiseId
  ).length;

  const playerByFranchise = useMemo(() => {
    const map: Record<string, SetupPlayer> = {};

    for (const player of setup.players) {
      if (player.franchiseId) {
        map[player.franchiseId] = player;
      }
    }

    return map;
  }, [setup.players]);

  function assignFranchise(franchiseId: string) {
    if (!selectedPlayerId) return;

    const alreadyAssignedOwner = playerByFranchise[franchiseId];

    if (alreadyAssignedOwner) return;

    onChange({
      ...setup,
      players: setup.players.map((player) =>
        player.id === selectedPlayerId
          ? { ...player, franchiseId }
          : player
      ),
    });

    setSelectedPlayerId("");
  }

  function clearAssignment(playerId: string) {
    onChange({
      ...setup,
      players: setup.players.map((player) =>
        player.id === playerId
          ? { ...player, franchiseId: undefined }
          : player
      ),
    });
  }

  return (
    <div className="assignment-layout">
      <aside className="owner-panel">
        <h3>Owners</h3>
        <p>{assignedCount} / 32 Assigned</p>

        <div className="owner-list">
          {setup.players.map((player) => {
            const isSelected = player.id === selectedPlayerId;

            return (
              <button
                key={player.id}
                className={`owner-chip ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedPlayerId(player.id)}
              >
                <span>{player.name}</span>
                <small>{player.franchiseId || "Unassigned"}</small>
              </button>
            );
          })}
        </div>

        {unassignedPlayers.length === 0 && setup.players.length > 0 && (
          <div className="assignment-complete">
            ✅ All owners assigned
          </div>
        )}
      </aside>

      <section className="franchise-board-section">
        <div className="assignment-helper">
          {selectedPlayer ? (
            <strong>
              Assigning franchise to: {selectedPlayer.name}
            </strong>
          ) : (
            <strong>Select an owner, then click an available franchise.</strong>
          )}
        </div>

        <div className="franchise-board">
          {nflFranchises.map((team) => {
            const assignedPlayer = playerByFranchise[team.id];
            const isAssigned = Boolean(assignedPlayer);

            return (
              <div
                key={team.id}
                className={`franchise-card ${isAssigned ? "assigned" : ""}`}
                style={{ borderColor: team.primaryColor }}
                onClick={() => assignFranchise(team.id)}
              >
                <img
                  src={team.logo}
                  alt={team.fullName}
                  className="franchise-logo"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />

                <h3>{team.fullName}</h3>
                <p>{team.division}</p>

                <div className="franchise-status">
                  {assignedPlayer ? (
                    <>
                      <span>👤 {assignedPlayer.name}</span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          clearAssignment(assignedPlayer.id);
                        }}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <span>⚪ Available</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}