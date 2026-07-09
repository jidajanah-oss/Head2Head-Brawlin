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
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "../games/gameCenterUtils";

function HomeDashboard() {
  const { league } = useLeague();
  const { snapshot, loading } = useNFL();

  const weekGames = snapshot?.weekGames ?? [];
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
        <SteelStatCard label="Players" value="32" helper="Registered competitors" icon="👥" />
        <SteelStatCard
          label="Games Loaded"
          value={loading ? "..." : weekGames.length}
          helper={`Week ${league.currentWeek} schedule`}
          icon="🏈"
        />
        <SteelStatCard
          label="Live Games"
          value={loading ? "..." : liveGames.length}
          helper="Real-time status board"
          icon="📡"
        />
        <SteelStatCard
          label="Final Games"
          value={loading ? "..." : finalGames.length}
          helper="Pick window closed"
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
            <div className="dashboard-matchup">
              <div>
                <small>Away</small>
                <strong>{featuredGame.awayTeam}</strong>
              </div>

              <span>@</span>

              <div>
                <small>Home</small>
                <strong>{featuredGame.homeTeam}</strong>
              </div>
            </div>

            <div className="dashboard-meta-row">
              <SteelBadge variant="success">
                {getStatusEmoji(featuredGame)} {getStatusLabel(featuredGame)}
              </SteelBadge>

              <SteelBadge variant="neutral">
                🕒 {formatKickoff(featuredGame.kickoff)}
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
              <span>🏈</span>
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
            <span>Current Leader</span>
            <strong>—</strong>
          </div>

          <div>
            <span>Your Rank</span>
            <strong>—</strong>
          </div>
        </div>
      </SteelCard>
    </main>
  );
}

export default HomeDashboard;