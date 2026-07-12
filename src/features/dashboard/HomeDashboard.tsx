import { useMemo } from "react";
import { Link } from "react-router-dom";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildSeasonAwareNFLStyleDivisionStandings,
  formatHeadToHeadRecord,
  getNFLTeamDisplayName,
  PickLockEngine,
} from "../../engine";
import ObscureStatAwardCard from "../awards/ObscureStatAwardCard";
import {
  formatKickoff,
  getStatusEmoji,
  getStatusLabel,
} from "../games/gameCenterUtils";

type DashboardTeamWordmarkProps = {
  team: string;
  side: "Away" | "Home";
};

const LEAGUE_LOGO_PATH =
  `${import.meta.env.BASE_URL}logos/league/head2head-brawlin.png`;

function getTeamDisplayName(team?: string) {
  if (!team) {
    return "Pending";
  }

  return getNFLTeamDisplayName(team);
}

function DashboardTeamWordmark({
  team,
  side,
}: DashboardTeamWordmarkProps) {
  return (
    <div
      className={`dashboard-matchup-team dashboard-team-wordmark ${
        side === "Home" ? "is-home" : ""
      }`.trim()}
    >
      <small>{side}</small>

      <div className="team-wordmark dashboard-team-wordmark-badge">
        <strong className="team-wordmark-abbr">
          {team}
        </strong>

        <span className="team-wordmark-name">
          {getTeamDisplayName(team)}
        </span>
      </div>
    </div>
  );
}

function HomeDashboard() {
  const { access } = useAuth();

  const {
    league,
    picks,
    gameResults,
    scoringHistory,
    activePlayerId,
  } = useLeague();

  const {
    season,
    snapshot,
    loading,
  } = useNFL();

  const weekGames =
    snapshot?.weekGames ?? [];

  const nflGames =
    snapshot?.nflGames ?? [];

  const featuredGame =
    weekGames[0];

  const liveGames = weekGames.filter(
    (game) =>
      getStatusLabel(game)
        .toLowerCase()
        .includes("live"),
  );

  const finalGames = weekGames.filter(
    (game) =>
      getStatusLabel(game)
        .toLowerCase()
        .includes("final"),
  );

  const upcomingGames =
    weekGames.filter((game) => {
      const label =
        getStatusLabel(game).toLowerCase();

      return (
        !label.includes("live") &&
        !label.includes("final")
      );
    });

  const lockedGames =
    weekGames.filter((game) =>
      PickLockEngine.isPickLocked(game),
    );

  const allPicks = useMemo(
    () =>
      league.players.reduce<
        Record<
          string,
          Record<string, string>
        >
      >((playerPicks, player) => {
        playerPicks[player.id] =
          picks[player.id] || {};

        return playerPicks;
      }, {}),
    [league.players, picks],
  );

  const divisionStandings = useMemo(
    () =>
      buildSeasonAwareNFLStyleDivisionStandings({
        players: league.players,
        picks: allPicks,
        gameResults,
        scoringHistory,
        nflGames,
        season,
        week: league.currentWeek,
      }),
    [
      league.players,
      allPicks,
      gameResults,
      scoringHistory,
      nflGames,
      season,
      league.currentWeek,
    ],
  );

  const standings =
    divisionStandings.allRows;

  const leader =
    standings[0];

  const activePlayerRankIndex =
    standings.findIndex(
      (player) =>
        player.id === activePlayerId,
    );

  const activePlayerRank =
    activePlayerRankIndex >= 0
      ? activePlayerRankIndex + 1
      : null;

  const activePlayer =
    league.players.find(
      (player) =>
        player.id === activePlayerId,
    );

  const selectedPickCount =
    activePlayerId
      ? Object.values(
          picks[activePlayerId] ?? {},
        ).filter(Boolean).length
      : 0;

  return (
    <main className="dashboard dashboard-v2">
      <SteelCard
        className="dashboard-brand-hero"
        as="section"
      >
        <div className="dashboard-brand-hero__logo-shell">
          <img
            className="dashboard-brand-hero__logo"
            src={LEAGUE_LOGO_PATH}
            alt="Head2Head Brawlin' Pick Em 2026 league logo"
          />
        </div>

        <div className="dashboard-brand-hero__content">
          <p className="steel-ui-eyebrow">
            2026 Pick&apos;em League
          </p>

          <h1>
            League Command Center
          </h1>

          <p>
            Make your picks, follow the
            weekly schedule, and track
            the championship race.
          </p>

          <div className="dashboard-brand-hero__actions">
            <SteelButton
              href="/picks"
              size="lg"
            >
              Make Picks
            </SteelButton>

            <SteelButton
              href="/games"
              size="lg"
              variant="secondary"
            >
              Game Center
            </SteelButton>
          </div>
        </div>

        <div className="dashboard-week-card dashboard-brand-hero__week">
          <span>
            Current Week
          </span>

          <strong>
            Week {league.currentWeek}
          </strong>

          <small>
            {liveGames.length > 0
              ? "Games live now"
              : "Board active"}
          </small>
        </div>
      </SteelCard>

      <section className="dashboard-stat-grid">
        <SteelStatCard
          label="Players"
          value={league.players.length}
          helper={`${league.settings.maxPlayers} max competitors`}
          icon="👥"
        />

        <SteelStatCard
          label="Games Loaded"
          value={
            loading
              ? "..."
              : weekGames.length
          }
          helper={`Week ${league.currentWeek} schedule`}
          icon="🗓️"
        />

        <SteelStatCard
          label="Live Games"
          value={
            loading
              ? "..."
              : liveGames.length
          }
          helper="Real-time status board"
          icon="⚡"
        />

        <SteelStatCard
          label="Locked"
          value={
            loading
              ? "..."
              : lockedGames.length
          }
          helper="Pick windows closed"
          icon="🔒"
        />
      </section>

      <ObscureStatAwardCard className="dashboard-obscure-stat-award" />

      <SteelCard
        className="dashboard-featured-game"
        as="section"
      >
        <SteelSectionHeader
          eyebrow="Featured Matchup"
          title={
            loading
              ? "Loading NFL Game..."
              : "Game of the Week"
          }
          action={
            <SteelBadge
              variant={
                featuredGame
                  ? "gold"
                  : "neutral"
              }
            >
              {featuredGame
                ? getStatusLabel(
                    featuredGame,
                  )
                : "Pending"}
            </SteelBadge>
          }
        />

        {featuredGame ? (
          <>
            <div className="dashboard-matchup dashboard-matchup--wordmarks">
              <DashboardTeamWordmark
                team={
                  featuredGame.awayTeam
                }
                side="Away"
              />

              <div className="dashboard-matchup-at">
                @
              </div>

              <DashboardTeamWordmark
                team={
                  featuredGame.homeTeam
                }
                side="Home"
              />
            </div>

            <div className="dashboard-meta-row">
              <SteelBadge variant="success">
                {getStatusEmoji(
                  featuredGame,
                )}{" "}
                {getStatusLabel(
                  featuredGame,
                )}
              </SteelBadge>

              <SteelBadge variant="neutral">
                {formatKickoff(
                  featuredGame.kickoff,
                )}
              </SteelBadge>
            </div>
          </>
        ) : (
          <p className="dashboard-muted">
            No featured game loaded yet.
          </p>
        )}
      </SteelCard>

      <SteelCard
        className="dashboard-command-card"
        as="section"
        variant="gold"
      >
        <div>
          <p className="steel-ui-eyebrow">
            Next Move
          </p>

          <h2>
            Lock in your picks before
            kickoff.
          </h2>

          <p>
            Review the board, make your
            selections, and stay ahead of
            the league.
          </p>
        </div>

        <SteelButton
          href="/picks"
          size="lg"
        >
          Continue Picking
        </SteelButton>
      </SteelCard>

      <section className="dashboard-section">
        <SteelSectionHeader
          eyebrow="Control Room"
          title="Quick Actions"
        />

        <div className="dashboard-action-grid">
          <SteelCard
            as="div"
            className="dashboard-action-card"
          >
            <Link to="/games">
              <span>🏈</span>

              <strong>
                Game Center
              </strong>

              <small>
                Live games, scores, and
                kickoff status
              </small>
            </Link>
          </SteelCard>

          <SteelCard
            as="div"
            className="dashboard-action-card"
          >
            <Link to="/picks">
              <span>✅</span>

              <strong>
                Make Picks
              </strong>

              <small>
                Submit this week&apos;s
                winning card
              </small>
            </Link>
          </SteelCard>

          <SteelCard
            as="div"
            className="dashboard-action-card"
          >
            <Link to="/standings">
              <span>📊</span>

              <strong>
                Standings
              </strong>

              <small>
                Track the championship
                race
              </small>
            </Link>
          </SteelCard>

          {access.canAccessCommissioner ? (
            <SteelCard
              as="div"
              className="dashboard-action-card"
            >
              <Link to="/commissioner">
                <span>⚙️</span>

                <strong>
                  Commish HQ
                </strong>

                <small>
                  Manage league operations
                </small>
              </Link>
            </SteelCard>
          ) : null}
        </div>
      </section>

      <section className="dashboard-franchise-grid">
        <SteelCard
          className="dashboard-franchise-card"
          as="article"
        >
          <SteelSectionHeader
            eyebrow="Active Franchise"
            title={
              activePlayer
                ? activePlayer.name
                : "No Active Player"
            }
            description={
              activePlayer
                ? `${activePlayer.nflTeam} • ${getTeamDisplayName(
                    activePlayer.nflTeam,
                  )}`
                : "Select an active player from Player Manager."
            }
          />

          <div className="dashboard-franchise-logo-row">
            <FranchiseLogo
              nflTeam={
                activePlayer?.nflTeam
              }
              customLogo={
                activePlayer?.customLogo
              }
              displayName={
                activePlayer
                  ? getTeamDisplayName(
                      activePlayer.nflTeam,
                    )
                  : "No team"
              }
              size="xl"
              variant="tile"
            />

            <div>
              <span>
                Pick Card
              </span>

              <strong>
                {selectedPickCount}/
                {weekGames.length || 0}
              </strong>

              <small>
                Week{" "}
                {league.currentWeek}{" "}
                selections
              </small>
            </div>
          </div>
        </SteelCard>

        <SteelCard
          className="dashboard-franchise-card"
          as="article"
        >
          <SteelSectionHeader
            eyebrow="Top Seed"
            title={
              leader
                ? leader.name
                : "No Leader Yet"
            }
            description={
              leader
                ? `${leader.nflTeamAbbreviation} • ${leader.division}`
                : "Standings will activate once players and results exist."
            }
          />

          <div className="dashboard-franchise-logo-row">
            <FranchiseLogo
              nflTeam={
                leader?.nflTeamAbbreviation
              }
              displayName={
                leader?.nflTeamDisplayName
              }
              size="xl"
              variant="tile"
            />

            <div>
              <span>
                Record
              </span>

              <strong>
                {leader
                  ? formatHeadToHeadRecord(
                      leader,
                    )
                  : "—"}
              </strong>

              <small>
                {leader
                  ? `${leader.leaguePoints} league pts`
                  : "Pending"}
              </small>
            </div>
          </div>
        </SteelCard>
      </section>

      <SteelCard
        className="dashboard-snapshot"
        as="section"
      >
        <SteelSectionHeader
          eyebrow="League Snapshot"
          title={`Week ${league.currentWeek} Board`}
        />

        <div className="dashboard-snapshot-grid">
          <div>
            <span>
              Games Remaining
            </span>

            <strong>
              {loading
                ? "..."
                : upcomingGames.length}
            </strong>
          </div>

          <div>
            <span>
              Final Games
            </span>

            <strong>
              {loading
                ? "..."
                : finalGames.length}
            </strong>
          </div>

          <div>
            <span>
              Your Rank
            </span>

            <strong>
              {activePlayerRank
                ? `#${activePlayerRank}`
                : "—"}
            </strong>
          </div>
        </div>
      </SteelCard>
    </main>
  );
}

export default HomeDashboard;