import { useLeague } from "../../context/LeagueContext";

function PlayerSelector() {
  const { league, activePlayerId, setActivePlayerId } = useLeague();

  return (
    <div className="player-selector">

      <h3>👤 Select Player</h3>

      <div className="player-list">

        {league.players.map((player) => {
          const isActive = player.id === activePlayerId;

          return (
            <button
              key={player.id}
              onClick={() => setActivePlayerId(player.id)}
              className={`player-btn ${isActive ? "active" : ""}`}
            >
              {player.name}
            </button>
          );
        })}

      </div>

    </div>
  );
}

export default PlayerSelector;