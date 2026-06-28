import { useLeague } from "../../context/LeagueContext";
import { getGamesForWeek, isPickLocked } from "../../lib/gameEngine";
import PlayerSelector from "../players/PlayerSelector";

function PickSheet() {
  const { league, picks, setPick, activePlayerId } = useLeague();

  const games = getGamesForWeek(league.currentWeek);
  const activePicks = picks[activePlayerId] || {};

  return (
    <div className="pick-sheet">
      <div className="pick-sheet-header">
        <h2>✅ Pick Sheet</h2>
        <p>Week {league.currentWeek}</p>
      </div>

      <PlayerSelector />

      <div className="pick-list">
        {games.map((game) => {
          const locked = isPickLocked(game);
          const selected = activePicks[game.id];

          return (
            <div key={game.id} className="pick-card">
              <div className="pick-matchup">
                {game.awayTeam} <span>@</span> {game.homeTeam}
              </div>

              <div className="pick-options">
                <button
                  disabled={locked || !activePlayerId}
                  className={selected === game.awayTeam ? "selected" : ""}
                  onClick={() => setPick(activePlayerId, game.id, game.awayTeam)}
                >
                  {game.awayTeam}
                </button>

                <button
                  disabled={locked || !activePlayerId}
                  className={selected === game.homeTeam ? "selected" : ""}
                  onClick={() => setPick(activePlayerId, game.id, game.homeTeam)}
                >
                  {game.homeTeam}
                </button>
              </div>

              <div className="pick-status">
                {locked ? "🔒 Locked" : "🟢 Open"}
                {selected && <strong> Pick: {selected}</strong>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PickSheet;