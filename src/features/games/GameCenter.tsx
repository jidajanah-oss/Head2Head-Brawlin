import { useLeague } from "../../context/LeagueContext";
import {
  getGamesForWeek,
  isPickLocked,
} from "../../lib/gameEngine";

function GameCenter() {
  const {
    league,
    picks,
    setPick,
    activePlayerId,
    setGameResults,
  } = useLeague();

  const games = getGamesForWeek(league.currentWeek);

  // 🧪 TEST MODE: simulate winners
  const loadTestResults = () => {
    setGameResults({
      "1-1": "BUF",
      "1-2": "BAL",
      "1-3": "PHI",
    });
  };

  return (
    <div className="games">

      {/* HEADER */}
      <div className="games-header">
        <h2>🏈 Game Center</h2>
        <p>Week {league.currentWeek}</p>

        {/* 🧪 TEST BUTTON */}
        <button
          onClick={loadTestResults}
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "none",
            background: "#22c55e",
            color: "#111",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Load Test Results
        </button>

      </div>

      {/* GAMES */}
      <div className="games-list">

        {games.map((game) => {
          const locked = isPickLocked(game);

          // current player's pick
          const playerPicks = picks[activePlayerId] || {};
          const selected = playerPicks[game.id];

          return (
            <div key={game.id} className="game-card">

              {/* MATCHUP */}
              <div className="game-header">
                <div className="game-teams">
                  {game.awayTeam} <span className="vs">@</span> {game.homeTeam}
                </div>
              </div>

              {/* PICK BUTTONS */}
              <div className="pick-buttons">

                <button
                  disabled={locked}
                  className={selected === game.awayTeam ? "picked" : ""}
                  onClick={() =>
                    setPick(activePlayerId, game.id, game.awayTeam)
                  }
                >
                  {game.awayTeam}
                </button>

                <button
                  disabled={locked}
                  className={selected === game.homeTeam ? "picked" : ""}
                  onClick={() =>
                    setPick(activePlayerId, game.id, game.homeTeam)
                  }
                >
                  {game.homeTeam}
                </button>

              </div>

              {/* STATUS */}
              <div className="game-info">

                {locked ? (
                  <p className="locked">🔒 LOCKED</p>
                ) : (
                  <p className="open">🟢 OPEN</p>
                )}

                {activePlayerId && selected && (
                  <p>
                    {activePlayerId}'s pick: <strong>{selected}</strong>
                  </p>
                )}

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default GameCenter;