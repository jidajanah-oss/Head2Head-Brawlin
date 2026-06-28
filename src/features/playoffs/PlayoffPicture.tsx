import { useLeague } from "../../context/LeagueContext";
import {
  buildPlayoffBracket,
  isPlayoffViewVisible,
} from "../../lib/playoffEngine";

function PlayoffPicture() {
  const { league } = useLeague();

  if (!isPlayoffViewVisible(league.currentWeek)) {
    return (
      <div className="playoff-picture">
        <div className="playoff-lock-card">
          <h2>🏆 Playoff Picture</h2>
          <p>Playoff picture unlocks after Week 14.</p>
          <strong>Current Week: {league.currentWeek}</strong>
        </div>
      </div>
    );
  }

  const afc = buildPlayoffBracket(league.players, "AFC");
  const nfc = buildPlayoffBracket(league.players, "NFC");

  return (
    <div className="playoff-picture">
      <h2>🏆 Playoff Picture</h2>

      {[afc, nfc].map((bracket) => (
        <section key={bracket.conference} className="conference-card">
          <h3>{bracket.conference}</h3>

          <div className="seed-list">
            {bracket.seeds.map((seed) => (
              <div key={seed.seed} className="seed-row">
                <span className="seed-number">#{seed.seed}</span>
                <span className="seed-name">{seed.player.name}</span>
                <span className="seed-team">{seed.player.nflTeam}</span>
                <span className="seed-label">
                  {seed.seed === 1
                    ? "BYE"
                    : seed.divisionWinner
                    ? "Division"
                    : "Wild Card"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default PlayoffPicture;