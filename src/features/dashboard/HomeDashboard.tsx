import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import ActionCard from "../../components/common/ActionCard";

import logo from "../../assets/logo.png";

import PlayerSelector from "../players/PlayerSelector";

import {
  initialLeagueState,
  getCurrentWeekLabel,
  getPickStatusLabel,
  getPlayerCount,
} from "../../lib/leagueEngine";

function HomeDashboard() {
  const league = initialLeagueState;

  return (
    <div className="dashboard">

      {/* HEADER */}
      <div className="dashboard-header">

        <img
          src={logo}
          alt="League Logo"
          className="league-logo"
        />

        <PageHeader
          eyebrow="HEAD2HEAD BRAWLIN'"
          title={league.settings.season}
          subtitle="Welcome back"
        />

      </div>

      {/* 👤 PLAYER SELECTOR (NEW CORE FEATURE) */}
      <PlayerSelector />

      {/* STATS */}
      <div className="dashboard-stats">

        <StatCard
          label="Players"
          value={getPlayerCount(league)}
        />

        <StatCard
          label="Current Week"
          value={getCurrentWeekLabel(league)}
        />

        <StatCard
          label="Picks"
          value={getPickStatusLabel(league)}
        />

      </div>

      {/* ACTIONS */}
      <h3>Quick Actions</h3>

      <div className="dashboard-actions">

        <ActionCard
          icon="✅"
          title="Make Picks"
          subtitle="Submit this week's picks"
        />

        <ActionCard
          icon="🏈"
          title="Game Center"
          subtitle="Scores and live games"
        />

        <ActionCard
          icon="🏆"
          title="Standings"
          subtitle="Season leaderboard"
        />

      </div>

    </div>
  );
}

export default HomeDashboard;