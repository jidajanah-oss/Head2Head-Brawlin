import { useEffect } from "react";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { PickLockEngine } from "../../engine";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "./gameCenterUtils";

function GameCenter() {
  const { league, picks, setPick, activePlayerId, setGameResults } = useLeague();
  const { week, setWeek, snapshot, loading, error, refresh } = useNFL();

  useEffect(() => {
    if (week !== league.currentWeek) {
      setWeek(league.currentWeek);
    }
  }, [league.currentWeek, week, setWeek]);

  const games = snapshot?.weekGames ?? [];

  const loadTestResults = () => {
    setGameResults({
      "2026-W1-G1": "PHI",
    });
  };

  return (
    <div className="games">
      <div className="games-header">
        <h2>🏈 Game Center</h2>
        <p>Week {league.currentWeek}</p>

        <button onClick={() => void refresh()}>Refresh NFL Data</button>
        <button onClick={loadTestResults}>Load Test Results</button>

        {loading && <p>Loading NFL games...</p>}
        {error && <p className="locked">Error: {error}</p>}
      </div>

      <div className="games-list">
        {games.map((game) => {
          const locked = PickLockEngine.isPickLocked(game);
          const playerPicks = picks[activePlayerId] || {};
          const selected = playerPicks[game.id];

          return (
            <div key={game.id} className="game-card">
              <div className="game-header">
                <div className="game-teams">
                  {game.awayTeam} <span className="vs">@</span> {game.homeTeam}
                </div>
              </div>

              <div className="pick-buttons">
                <button
                  disabled={locked}
                  className={selected === game.awayTeam ? "picked" : ""}
                  onClick={() => setPick(activePlayerId, game.id, game.awayTeam)}
                >
                  {game.awayTeam}
                </button>

                <button
                  disabled={locked}
                  className={selected === game.homeTeam ? "picked" : ""}
                  onClick={() => setPick(activePlayerId, game.id, game.homeTeam)}
                >
                  {game.homeTeam}
                </button>
              </div>

              <div className="game-info">
                <div className={`status-chip ${getStatusLabel(game).toLowerCase()}`}>
                  {getStatusEmoji(game)} {getStatusLabel(game)}
                </div>

                <p className="kickoff-time">🕒 {formatKickoff(game.kickoff)}</p>

                {activePlayerId && selected && (
                  <p>
                    {activePlayerId}'s pick: <strong>{selected}</strong>
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {!loading && games.length === 0 && <p>No games loaded for this week.</p>}
      </div>
    </div>
  );
}

export default GameCenter;