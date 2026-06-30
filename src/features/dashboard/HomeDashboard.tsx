import { Link } from "react-router-dom";
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

  const liveGames = weekGames.filter((game) => getStatusLabel(game).toLowerCase().includes("live"));
  const lockedGames = weekGames.filter((game) => getStatusLabel(game).toLowerCase().includes("final"));
  const upcomingGames = weekGames.filter((game) => {
    const label = getStatusLabel(game).toLowerCase();
    return !label.includes("live") && !label.includes("final");
  });

  return (
    <main className="dashboard steel-dashboard">
      <section className="steel-hero">
        <div className="steel-hero-content">
          <p className="steel-eyebrow">Head2Head Brawlin&apos;</p>
          <h1>Steel Edition</h1>
          <p className="steel-hero-subtitle">
            Premium 2026 Pick&apos;em League Command Center
          </p>

          <div className="steel-hero-actions">
            <Link to="/picks" className="steel-primary-button">
              Make Picks
            </Link>

            <Link to="/games" className="steel-secondary-button">
              Game Center
            </Link>
          </div>
        </div>

        <div className="steel-week-panel">
          <span>Current Week</span>
          <strong>Week {league.currentWeek}</strong>
          <small>{liveGames.length > 0 ? "Games live now" : "League board active"}</small>
        </div>
      </section>

      <section className="steel-grid">
        <article className="steel-card steel-stat-card">
          <span>Players</span>
          <strong>32</strong>
          <small>Registered competitors</small>
        </article>

        <article className="steel-card steel-stat-card">
          <span>Games Loaded</span>
          <strong>{loading ? "..." : weekGames.length}</strong>
          <small>Week {league.currentWeek} schedule</small>
        </article>

        <article className="steel-card steel-stat-card">
          <span>Live Games</span>
          <strong>{loading ? "..." : liveGames.length}</strong>
          <small>Real-time status board</small>
        </article>

        <article className="steel-card steel-stat-card">
          <span>Locked / Final</span>
          <strong>{loading ? "..." : lockedGames.length}</strong>
          <small>Pick window closed</small>
        </article>
      </section>

      <section className="steel-card steel-featured-game">
        <div className="section-row">
          <div>
            <p className="steel-eyebrow">Featured Matchup</p>
            <h2>{loading ? "Loading NFL Game..." : "Game of the Week"}</h2>
          </div>

          <span className="steel-live-pill">
            {featuredGame ? getStatusLabel(featuredGame) : "Pending"}
          </span>
        </div>

        {featuredGame ? (
          <>
            <div className="featured-matchup">
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

            <div className="featured-meta">
              <span>
                {getStatusEmoji(featuredGame)} {getStatusLabel(featuredGame)}
              </span>
              <span>🕒 {formatKickoff(featuredGame.kickoff)}</span>
            </div>
          </>
        ) : (
          <p className="steel-muted">No featured game loaded yet.</p>
        )}
      </section>

      <section className="steel-card steel-command-card">
        <div>
          <p className="steel-eyebrow">Next Move</p>
          <h2>Lock in your picks before kickoff.</h2>
          <p>
            Review the live board, make your selections, and stay ahead of the
            league before games close.
          </p>
        </div>

        <Link to="/picks" className="steel-primary-button steel-wide-button">
          Continue Picking
        </Link>
      </section>

      <section>
        <div className="section-row">
          <div>
            <p className="steel-eyebrow">Control Room</p>
            <h2 className="steel-section-title">Quick Actions</h2>
          </div>
        </div>

        <div className="quick-action-grid">
          <Link to="/games" className="steel-card quick-action">
            <span>🏈</span>
            <strong>Game Center</strong>
            <small>Live games, scores, and kickoff status</small>
          </Link>

          <Link to="/picks" className="steel-card quick-action">
            <span>✅</span>
            <strong>Make Picks</strong>
            <small>Submit this week&apos;s winning card</small>
          </Link>

          <Link to="/standings" className="steel-card quick-action">
            <span>🏆</span>
            <strong>Standings</strong>
            <small>Track the championship race</small>
          </Link>

          <Link to="/commissioner" className="steel-card quick-action">
            <span>⚙️</span>
            <strong>Commish HQ</strong>
            <small>Manage league operations</small>
          </Link>
        </div>
      </section>

      <section className="steel-card steel-snapshot">
        <div className="section-row">
          <div>
            <p className="steel-eyebrow">League Snapshot</p>
            <h2>Week {league.currentWeek} Board</h2>
          </div>
        </div>

        <div className="snapshot-grid">
          <div>
            <span>Games Remaining</span>
            <strong>{loading ? "..." : upcomingGames.length}</strong>
          </div>

          <div>
            <span>Current Leader</span>
            <strong>TBD</strong>
          </div>

          <div>
            <span>Your Rank</span>
            <strong>TBD</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomeDashboard;