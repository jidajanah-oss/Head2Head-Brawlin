import { useMemo } from "react";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { buildHeadToHeadStandings } from "../../lib/standingsEngine";

function getRankDisplay(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";

  return `#${index + 1}`;
}

function getRankLabel(index: number) {
  if (index === 0) return "Champion Pace";
  if (index === 1) return "Contender";
  if (index === 2) return "Podium";
  return "Chasing";
}

function StandingsBoard() {
  const { league, picks, gameResults, activePlayerId } = useLeague();

  const allPicks = useMemo(
    () =>
      league.players.reduce((acc: any, player: any) => {
        acc[player.id] = picks[player.id] || {};
        return acc;
      }, {}),
    [league.players, picks]
  );

  const standings = useMemo(
    () => buildHeadToHeadStandings(league.players, allPicks, gameResults),
    [league.players, allPicks, gameResults]
  );

  const leader = standings[0];
  const activePlayerStanding = standings.find(
    (player) => player.id === activePlayerId
  );

  const completedGames = Object.keys(gameResults).length;
  const totalPoints = standings.reduce((sum, player) => sum + player.points, 0);
  const averagePoints =
    standings.length > 0 ? Math.round(totalPoints / standings.length) : 0;

  return (
    <main className="standings standings-v2">
      <SteelHero
        eyebrow="Championship Race"
        title="Standings"
        subtitle={`Week ${league.currentWeek} rankings for Head2Head Brawlin' – Steel Edition.`}
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Game Center"
        secondaryHref="/games"
        rightContent={
          <div className="standings-hero-panel">
            <span>Current Leader</span>
            <strong>{leader ? leader.name : "—"}</strong>
            <small>{leader ? `${leader.points} points` : "No results yet"}</small>
          </div>
        }
      />

      <section className="standings-stat-grid">
        <SteelStatCard
          label="Players"
          value={league.players.length}
          helper="In the league"
          icon="👥"
        />

        <SteelStatCard
          label="Leader"
          value={leader ? leader.points : "—"}
          helper={leader ? leader.name : "Waiting on results"}
          icon="🏆"
        />

        <SteelStatCard
          label="Your Points"
          value={activePlayerStanding ? activePlayerStanding.points : "—"}
          helper={activePlayerStanding ? activePlayerStanding.name : "Select player"}
          icon="⭐"
        />

        <SteelStatCard
          label="Games Scored"
          value={completedGames}
          helper={`Average score: ${averagePoints}`}
          icon="📊"
        />
      </section>

      <SteelCard className="standings-podium-card" as="section">
        <SteelSectionHeader
          eyebrow="Top Three"
          title="Podium Watch"
          description="The current championship leaders based on scored results."
        />

        <div className="standings-podium-grid">
          {standings.slice(0, 3).map((player, index) => (
            <div
              className={`standings-podium-item standings-podium-item--${index + 1}`}
              key={player.id}
            >
              <span>{getRankDisplay(index)}</span>
              <strong>{player.name}</strong>
              <small>{player.points} pts</small>
            </div>
          ))}

          {standings.length === 0 ? (
            <p className="standings-muted">No standings available yet.</p>
          ) : null}
        </div>
      </SteelCard>

      <section className="standings-board-section">
        <SteelSectionHeader
          eyebrow="League Board"
          title={`Week ${league.currentWeek} Rankings`}
          description="Live leaderboard based on available game results."
          action={
            <SteelButton href="/picks" size="sm" variant="secondary">
              Make Picks
            </SteelButton>
          }
        />

        <div className="standings-list standings-list-v2">
          {standings.map((player, index) => {
            const isTop3 = index < 3;
            const isActivePlayer = player.id === activePlayerId;

            return (
              <SteelCard
                as="article"
                className={`standing-row standing-row-v2 ${
                  isTop3 ? "top" : ""
                } ${isActivePlayer ? "is-active-player" : ""}`}
                key={player.id}
              >
                <div className="rank standings-rank">
                  <span>{getRankDisplay(index)}</span>
                  <small>{getRankLabel(index)}</small>
                </div>

                <div className="name standings-player">
                  <strong>{player.name}</strong>
                  <small>{isActivePlayer ? "Active player" : "League player"}</small>
                </div>

                <div className="points standings-points">
                  <strong>{player.points}</strong>
                  <small>points</small>
                </div>

                <SteelBadge variant={isTop3 ? "gold" : "neutral"}>
                  {isTop3 ? "Top 3" : "Ranked"}
                </SteelBadge>
              </SteelCard>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default StandingsBoard;