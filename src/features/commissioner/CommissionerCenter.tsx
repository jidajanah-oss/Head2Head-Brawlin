import { useLeague } from "../../context/LeagueContext";
import CommissionerCard from "./CommissionerCard";

function CommissionerCenter() {
  const { league } = useLeague();

  return (
    <div className="commissioner-center">
      <section className="hero-card">
        <p className="eyebrow">Admin Control Room</p>
        <h2>Commissioner Center</h2>
        <p>{league.settings.leagueName} • {league.settings.season}</p>
      </section>

      <section className="commissioner-grid">
        <CommissionerCard
          icon="👥"
          title="Manage Players"
          subtitle={`${league.players.length} / ${league.settings.maxPlayers} players`}
        />

        <CommissionerCard
          icon="🏈"
          title="NFL Schedule"
          subtitle="Import and manage weekly games"
        />

        <CommissionerCard
          icon="📅"
          title="Current Week"
          subtitle="Week 1"
        />

        <CommissionerCard
          icon="🔒"
          title="Pick Status"
          subtitle={`Locks ${league.settings.pickLockMinutesBeforeKickoff} minutes before kickoff`}
        />

        <CommissionerCard
          icon="📢"
          title="Announcements"
          subtitle="Post league updates"
        />

        <CommissionerCard
          icon="⚙️"
          title="League Settings"
          subtitle="Rules, season, scoring, and setup"
        />
      </section>
    </div>
  );
}

export default CommissionerCenter;