import { useLeague } from "../../context/LeagueContext";
import { buildHeadToHeadStandings } from "../../lib/standingsEngine";

function StandingsBoard() {
  const { league, picks, gameResults } = useLeague();

  const allPicks = league.players.reduce((acc: any, player: any) => {
    acc[player.id] = picks[player.id] || {};
    return acc;
  }, {});

  const standings = buildHeadToHeadStandings(
    league.players,
    allPicks,
    gameResults
  );

  return (
    <div className="standings">

      {/* HEADER */}
      <div className="standings-header">
        <h2>🏆 League Standings</h2>
        <p>Week {league.currentWeek} Rankings</p>
      </div>

      {/* TABLE */}
      <div className="standings-list">

        {standings.map((player, index) => {

          const isTop3 = index < 3;

          return (
            <div
              key={player.id}
              className={`standing-row ${isTop3 ? "top" : ""}`}
            >

              {/* RANK */}
              <div className="rank">
                {index === 0 && "🥇"}
                {index === 1 && "🥈"}
                {index === 2 && "🥉"}
                {index > 2 && `#${index + 1}`}
              </div>

              {/* PLAYER */}
              <div className="name">
                {player.name}
              </div>

              {/* POINTS */}
              <div className="points">
                {player.points} pts
              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default StandingsBoard;