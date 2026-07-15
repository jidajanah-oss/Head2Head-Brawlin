import { useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";

function getPlayerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role?: string) {
  if (!role) {
    return "Player";
  }

  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function PlayerSelector() {
  const { status, access } = useAuth();
  const { league, activePlayerId, setActivePlayerId } = useLeague();
  const [isPlayerListOpen, setIsPlayerListOpen] = useState(false);

  const activePlayer = useMemo(
    () => league.players.find((player) => player.id === activePlayerId),
    [activePlayerId, league.players],
  );

  const canSwitchPlayers =
    status !== "signed-in-linked" || access.canManageLeague;

  const selectPlayer = (playerId: string) => {
    setActivePlayerId(playerId);
    setIsPlayerListOpen(false);
  };

  if (league.players.length === 0) {
    return (
      <div className="player-selector player-selector-v2">
        <div className="player-selector-empty">
          <span className="player-selector-empty-icon" />
          <div>
            <strong>No players available</strong>
            <p>Add players in Commissioner HQ before making picks.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`player-selector player-selector-v2 ${
        canSwitchPlayers ? "can-switch-players" : "is-player-locked"
      }`}
    >
      <div className="player-selector-active-card">
        <div className="player-selector-active-avatar">
          {activePlayer ? getPlayerInitials(activePlayer.name) : "?"}
        </div>

        <div className="player-selector-active-copy">
          <span>Currently Making Picks As</span>
          <strong>{activePlayer?.name ?? "Select Player"}</strong>
          <small>
            {activePlayer
              ? `${formatRole(activePlayer.role)} • ${
                  activePlayer.nflTeam ?? "No Team"
                }`
              : canSwitchPlayers
                ? "Open the player list to activate a pick card"
                : "Your linked pick card will load automatically"}
          </small>
        </div>

        {canSwitchPlayers ? (
          <button
            aria-controls="pick-card-player-switcher"
            aria-expanded={isPlayerListOpen}
            className="player-selector-toggle"
            onClick={() => setIsPlayerListOpen((current) => !current)}
            type="button"
          >
            <span>{isPlayerListOpen ? "Close List" : "Switch Player"}</span>
            <span aria-hidden="true" className="player-selector-toggle-icon">
              {isPlayerListOpen ? "−" : "+"}
            </span>
          </button>
        ) : null}
      </div>

      {canSwitchPlayers && isPlayerListOpen ? (
        <div
          className="player-selector-switcher"
          id="pick-card-player-switcher"
        >
          <div className="player-selector-header">
            <div>
              <span>Player Switcher</span>
              <strong>Change active pick card</strong>
            </div>
            <small>{league.players.length} players</small>
          </div>

          <div className="player-list player-list-v2">
            {league.players.map((player) => {
              const isActive = player.id === activePlayerId;

              return (
                <button
                  aria-pressed={isActive}
                  className={`player-btn player-btn-v2 ${
                    isActive ? "active is-active" : ""
                  }`}
                  key={player.id}
                  onClick={() => selectPlayer(player.id)}
                  type="button"
                >
                  <span className="player-btn-avatar">
                    {getPlayerInitials(player.name)}
                  </span>
                  <span className="player-btn-copy">
                    <strong>{player.name}</strong>
                    <small>
                      {formatRole(player.role)} • {player.nflTeam ?? "No Team"}
                    </small>
                  </span>
                  <span className="player-btn-status">
                    {isActive ? "Active" : "Switch"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PlayerSelector;
