import { useMemo } from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildNFLStyleDivisionStandings,
  formatHeadToHeadRecord,
  getNFLTeamDisplayName,
  PickLockEngine,
} from "../../engine";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "../games/gameCenterUtils";

function getTeamDisplayName(team?: string) {
  if (!team) return "Pending";

  return getNFLTeamDisplayName(team);
}

function HomeDashboard() {
  const { league, picks, gameResults, activePlayerId } = useLeague();
  const { snapshot, loading } = useNFL();

  const weekGames = snapshot?.weekGames ?? [];
  const nflGames = snapshot?.nflGames ?? [];
  const featuredGame = weekGames[0];

  const liveGames = weekGames.filter((game) =>
    getStatusLabel(game).toLowerCase().includes("live")
  );

  const finalGames = weekGames.filter((game) =>
    getStatusLabel(game).toLowerCase().includes("final")
  );

  const upcomingGames = weekGames.filter((game) => {
    const label = getStatusLabel(game).toLowerCase();

    return !label.includes("live") && !label.includes("final");
  });

  const lockedGames = weekGames.filter((game) => PickLockEngine.isPickLocked(game));

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

  const divisionStandings = useMemo(
    () =>
      buildNFLStyleDivisionStandings(
        league.players,
        allPicks,
        gameResults,
        league.currentWeek,
        nflGames
      ),
    [league.players, allPicks, gameResults, league.currentWeek, nflGames]
  );

  const standings = divisionStandings.allRows;
  const leader = standings[0];

  const activePlayerRankIndex = standings.findIndex(
    (player) => player.id === activePlayerId
  );

  const activePlayerRank =
    activePlayerRankIndex >= 0 ? activePlayerRankIndex + 1 : null;

  const activePlayer = league.players.find((player) => player.id === activePlayerId);

  const selectedPickCount = activePlayerId
    ? Object.values(picks[activePlayerId] ?? {}).filter(Boolean).length
    : 0;

  return (
    <main className="dashboard dashboard-v2">
      <SteelHero
        eyebrow="Head2Head Brawlin'"
        title="Steel Edition"
        subtitle="Premium 2026 Pick'em League Command Center"
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Game Center"
        secondaryHref="/games"
        rightContent={
          <div className="dashboard-week-card">
            <span>Current Week</span>
            <strong>Week {league.currentWeek}</strong>
            <small>{liveGames.length > 0 ? "Games live now" : "Board active"}</small>
          </div>
        }
      />

      <section className="dashboard-stat-grid">
        <SteelStatCard
          label="Players"
          value={league.players.length}
          helper={`${league.settings.maxPlayers} max competitors`}
          icon="🏈"
        />

        <SteelStatCard
          label="Games Loaded"
          value={loading ? "..." : weekGames.length}
          helper={`Week ${league.currentWeek} schedule`}
          icon="📅"
        />

        <SteelStatCard
          label="Live Games"
          value={loading ? "..." : liveGames.length}
          helper="Real-time status board"
          icon="⚡"
        />

        <SteelStatCard
          label="Locked"
          value={loading ? "..." : lockedGames.length}
          helper="Pick windows closed"
          icon="🔒"
        />
      </section>

      <SteelCard className="dashboard-featured-game" as="section">
        <SteelSectionHeader
          eyebrow="Featured Matchup"
          title={loading ? "Loading NFL Game..." : "Game of the Week"}
          action={
            <SteelBadge variant={featuredGame ? "gold" : "neutral"}>
              {featuredGame ? getStatusLabel(featuredGame) : "Pending"}
            </SteelBadge>
          }
        />

        {featuredGame ? (
          <>
            <div className="dashboard-matchup dashboard-matchup--logos">
              <div className="dashboard-matchup-team">
                <small>Away</small>

                <FranchiseLogo
                  nflTeam={featuredGame.awayTeam}
                  displayName={getTeamDisplayName(featuredGame.awayTeam)}
                  size="lg"
                  variant="tile"
                />

                <strong>{featuredGame.awayTeam}</strong>
                <span>{getTeamDisplayName(featuredGame.awayTeam)}</span>
              </div>

              <div className="dashboard-matchup-at">@</div>

              <div className="dashboard-matchup-team is-home">
                <small>Home</small>

                <FranchiseLogo
                  nflTeam={featuredGame.homeTeam}
                  displayName={getTeamDisplayName(featuredGame.homeTeam)}
                  size="lg"
                  variant="tile"
                />

                <strong>{featuredGame.homeTeam}</strong>
                <span>{getTeamDisplayName(featuredGame.homeTeam)}</span>
              </div>
            </div>

            <div className="dashboard-meta-row">
              <SteelBadge variant="success">
                {getStatusEmoji(featuredGame)} {getStatusLabel(featuredGame)}
              </SteelBadge>

              <SteelBadge variant="neutral">
                {formatKickoff(featuredGame.kickoff)}
              </SteelBadge>
            </div>
          </>
        ) : (
          <p className="dashboard-muted">No featured game loaded yet.</p>
        )}
      </SteelCard>

      <SteelCard className="dashboard-command-card" as="section" variant="gold">
        <div>
          <p className="steel-ui-eyebrow">Next Move</p>
          <h2>Lock in your picks before kickoff.</h2>
          <p>
            Review the board, make your selections, and stay ahead of the league.
          </p>
        </div>

        <SteelButton href="/picks" size="lg">
          Continue Picking
        </SteelButton>
      </SteelCard>

      <section className="dashboard-section">
        <SteelSectionHeader eyebrow="Control Room" title="Quick Actions" />

        <div className="dashboard-action-grid">
          <SteelCard as="div" className="dashboard-action-card">
            <a href="/games">
              <span>📺</span>
              <strong>Game Center</strong>
              <small>Live games, scores, and kickoff status</small>
            </a>
          </SteelCard>

          <SteelCard as="div" className="dashboard-action-card">
            <a href="/picks">
              <span>✅</span>
              <strong>Make Picks</strong>
              <small>Submit this week&apos;s winning card</small>
            </a>
          </SteelCard>

          <SteelCard as="div" className="dashboard-action-card">
            <a href="/standings">
              <span>🏆</span>
              <strong>Standings</strong>
              <small>Track the championship race</small>
            </a>
          </SteelCard>

          <SteelCard as="div" className="dashboard-action-card">
            <a href="/commissioner">
              <span>⚙️</span>
              <strong>Commish HQ</strong>
              <small>Manage league operations</small>
            </a>
          </SteelCard>
        </div>
      </section>

      <section className="dashboard-franchise-grid">
        <SteelCard className="dashboard-franchise-card" as="article">
          <SteelSectionHeader
            eyebrow="Active Franchise"
            title={activePlayer ? activePlayer.name : "No Active Player"}
            description={
              activePlayer
                ? `${activePlayer.nflTeam} • ${getTeamDisplayName(activePlayer.nflTeam)}`
                : "Select an active player from Player Manager."
            }
          />

          <div className="dashboard-franchise-logo-row">
            <FranchiseLogo
              nflTeam={activePlayer?.nflTeam}
              customLogo={activePlayer?.customLogo}
              displayName={
                activePlayer ? getTeamDisplayName(activePlayer.nflTeam) : "No team"
              }
              size="xl"
              variant="tile"
            />

            <div>
              <span>Pick Card</span>
              <strong>
                {selectedPickCount}/{weekGames.length || 0}
              </strong>
              <small>Week {league.currentWeek} selections</small>
            </div>
          </div>
        </SteelCard>

        <SteelCard className="dashboard-franchise-card" as="article">
          <SteelSectionHeader
            eyebrow="Top Seed"
            title={leader ? leader.name : "No Leader Yet"}
            description={
              leader
                ? `${leader.nflTeamAbbreviation} • ${leader.division}`
                : "Standings will activate once players and results exist."
            }
          />

          <div className="dashboard-franchise-logo-row">
            <FranchiseLogo
              nflTeam={leader?.nflTeamAbbreviation}
              displayName={leader?.nflTeamDisplayName}
              size="xl"
              variant="tile"
            />

            <div>
              <span>Record</span>
              <strong>{leader ? formatHeadToHeadRecord(leader) : "—"}</strong>
              <small>{leader ? `${leader.leaguePoints} league pts` : "Pending"}</small>
            </div>
          </div>
        </SteelCard>
      </section>

      <SteelCard className="dashboard-snapshot" as="section">
        <SteelSectionHeader
          eyebrow="League Snapshot"
          title={`Week ${league.currentWeek} Board`}
        />

        <div className="dashboard-snapshot-grid">
          <div>
            <span>Games Remaining</span>
            <strong>{loading ? "..." : upcomingGames.length}</strong>
          </div>

          <div>
            <span>Final Games</span>
            <strong>{loading ? "..." : finalGames.length}</strong>
          </div>

          <div>
            <span>Your Rank</span>
            <strong>{activePlayerRank ? `#${activePlayerRank}` : "—"}</strong>
          </div>
        </div>
      </SteelCard>
    </main>
  );
}

export default HomeDashboard;