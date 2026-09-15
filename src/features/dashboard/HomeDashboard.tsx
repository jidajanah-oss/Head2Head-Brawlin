import OpponentPickRevealPanel from "../picks/OpponentPickRevealPanel";
import { HeadToHeadMatchupsBoard } from "../standings/StandingsBoard";
import "../../styles/opponentPickReveal.css";
import { SteelButton, SteelCard } from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import ObscureStatAwardCard from "../awards/ObscureStatAwardCard";
import { getStatusLabel } from "../games/gameCenterUtils";

const LEAGUE_LOGO_PATH =
  `${import.meta.env.BASE_URL}logos/league/head2head-brawlin.png`;

function HomeDashboard() {
  const { league } = useLeague();
  const { snapshot } = useNFL();
  const liveGames = (snapshot?.weekGames ?? []).filter(game =>
    getStatusLabel(game).toLowerCase().includes("live"),
  );
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

      <OpponentPickRevealPanel comparison />
      <HeadToHeadMatchupsBoard />

      <ObscureStatAwardCard className="dashboard-obscure-stat-award" />
    </main>
  );
}

export default HomeDashboard;

