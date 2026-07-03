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
import {
  buildHeadToHeadMatchupResults,
  buildHeadToHeadStandings,
  formatHeadToHeadRecord,
  formatWeeklyResultLabel,
} from "../../engine";

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

function getResultBadgeVariant(result: string) {
  if (result === "win") return "success";
  if (result === "loss") return "danger";
  if (result === "tie") return "gold";
  if (result === "bye") return "neutral";

  return "neutral";
}

function StandingsBoard() {
  const { league, picks, gameResults, activePlayerId } = useLeague();

  const allPicks = useMemo(
    () =>
      league.players.reduce<Record<string, Record<string, string>>>(
        (playerPicks, player) => {
          playerPicks[player.id] = picks[player.id] || {};
          return playerPicks;
        },
        {}
      ),
    [league.players, picks]
  );

  const standings = useMemo(
    () =>
      buildHeadToHeadStandings(
        league.players,
        allPicks,
        gameResults,
        league.currentWeek
      ),
    [league.players, allPicks, gameResults, league.currentWeek]
  );

  const weeklyMatchups = useMemo(
    () =>
      buildHeadToHeadMatchupResults(
        league.players,
        allPicks,
        gameResults,
        league.currentWeek
      ),
    [league.players, allPicks, gameResults, league.currentWeek]
  );

  const leader = standings[0];
  const activePlayerStanding = standings.find(
    (player) => player.id === activePlayerId
  );

  const completedGames = Object.keys(gameResults).length;
  const totalPickPoints = standings.reduce(
    (sum, player) => sum + player.pickPoints,
    0
  );
  const averagePickPoints =
    standings.length > 0 ? Math.round(totalPickPoints / standings.length) : 0;

  return (
    <main className="standings standings-v2">
      <SteelHero
        eyebrow="Head-To-Head Race"
        title="Standings"
        subtitle={`Week ${league.currentWeek} matchup standings for Head2Head Brawlin' – Steel Edition.`}
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Game Center"
        secondaryHref="/games"
        rightContent={
          <div className="standings-hero-panel">
            <span>Current Leader</span>
            <strong>{leader ? leader.name : "—"}</strong>
            <small>
              {leader
                ? `${formatHeadToHeadRecord(leader)} • ${leader.leaguePoints} pts`
                : "No results yet"}
            </small>
          </div>
        }
      />

      <section className="standings-stat-grid">
        <SteelStatCard
          label="Players"
          value={league.players.length}
          helper="Active league roster"
          icon="👥"
        />

        <SteelStatCard
          label="Leader"
          value={leader ? formatHeadToHeadRecord(leader) : "—"}
          helper={leader ? `${leader.leaguePoints} league points` : "Waiting"}
          icon="🏆"
        />

        <SteelStatCard
          label="Your Record"
          value={
            activePlayerStanding ? formatHeadToHeadRecord(activePlayerStanding) : "—"
          }
          helper={activePlayerStanding ? activePlayerStanding.name : "Select player"}
          icon="⭐"
        />

        <SteelStatCard
          label="Games Scored"
          value={completedGames}
          helper={`Average picks: ${averagePickPoints}`}
          icon="📊"
        />
      </section>

      <SteelCard className="standings-matchups-card" as="section">
        <SteelSectionHeader
          eyebrow="This Week"
          title={`Week ${league.currentWeek} Head-To-Head Matchups`}
          description="Each player is matched against one opponent for the weekly brawl."
        />

        <div className="standings-matchups-grid">
          {weeklyMatchups.map((matchup) => (
            <div className="standings-matchup-item" key={matchup.id}>
              <div className="standings-matchup-player">
                <strong>{matchup.playerA.name}</strong>
                <span>{matchup.playerAScore}</span>
              </div>

              <div className="standings-matchup-center">
                <small>{matchup.playerB ? "vs" : "bye"}</small>
                <SteelBadge
                  variant={
                    matchup.status === "final"
                      ? "gold"
                      : matchup.status === "bye"
                        ? "neutral"
                        : "neutral"
                  }
                >
                  {matchup.resultLabel}
                </SteelBadge>
              </div>

              <div className="standings-matchup-player is-right">
                <strong>{matchup.playerB?.name ?? "Bye Week"}</strong>
                <span>{matchup.playerB ? matchup.playerBScore : "—"}</span>
              </div>
            </div>
          ))}

          {weeklyMatchups.length === 0 ? (
            <p className="standings-muted">No weekly matchups available yet.</p>
          ) : null}
        </div>
      </SteelCard>

      <SteelCard className="standings-podium-card" as="section">
        <SteelSectionHeader
          eyebrow="Top Three"
          title="Podium Watch"
          description="The current leaders based on head-to-head league points."
        />

        <div className="standings-podium-grid">
          {standings.slice(0, 3).map((player, index) => (
            <div
              className={`standings-podium-item standings-podium-item--${index + 1}`}
              key={player.id}
            >
              <span>{getRankDisplay(index)}</span>
              <strong>{player.name}</strong>
              <small>
                {formatHeadToHeadRecord(player)} • {player.leaguePoints} pts
              </small>
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
          description="True head-to-head rankings based on weekly matchups."
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
                  <small>
                    vs {player.weeklyOpponentName} •{" "}
                    {formatWeeklyResultLabel(player.weeklyResult)}
                  </small>
                </div>

                <div className="standings-record">
                  <strong>{formatHeadToHeadRecord(player)}</strong>
                  <small>Record</small>
                </div>

                <div className="points standings-points">
                  <strong>{player.leaguePoints}</strong>
                  <small>League pts</small>
                </div>

                <div className="standings-pick-score">
                  <strong>
                    {player.pickPoints}/{player.possiblePoints}
                  </strong>
                  <small>Pick score</small>
                </div>

                <SteelBadge variant={getResultBadgeVariant(player.weeklyResult)}>
                  {formatWeeklyResultLabel(player.weeklyResult)}
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