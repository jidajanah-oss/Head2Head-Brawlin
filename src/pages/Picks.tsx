import PickSheet from "../features/picks/PickSheet";
import OpponentPickRevealPanel from "../features/picks/OpponentPickRevealPanel";
import WeeklyPickSubmissionPanel from "../features/picks/WeeklyPickSubmissionPanel";
import "../styles/picks.css";
import "../styles/weeklyPickSubmission.css";
import "../styles/opponentPickReveal.css";

import { useLeague } from "../context/LeagueContext";
import { useNFL } from "../context/NFLContext";
import { isNFLByeWeek } from "../engine/isNFLByeWeek";
import { Link } from "react-router-dom";
import PlayerSelector from "../features/players/PlayerSelector";

export default function Picks() {
  const { league, activePlayerId } = useLeague();
  const { snapshot, loading, season } = useNFL();
  const player = league.players.find(value => value.id === activePlayerId);
  if (player && !loading && snapshot?.season === season && snapshot.week === league.currentWeek &&
      isNFLByeWeek(player.nflTeam, league.currentWeek, snapshot.weekGames)) {
    return <main className="pick-sheet picks-v2">
      <PlayerSelector />
      <section role="status" className="picks-state-card">
        <h1>You’re on a bye week</h1>
        <h2>Week {league.currentWeek} • {player.nflTeam} • No picks required</h2>
        <p>Your franchise has a bye this week. You can relax and return next week to make your picks.</p>
        <p>No loss, missed-pick penalty, or automatic Picker Clicker applies. Any picks already saved for this week will not count.</p>
        <Link to="/standings">View standings</Link>
      </section>
    </main>;
  }
  return (
    <>
      <WeeklyPickSubmissionPanel />
      <PickSheet />
      <OpponentPickRevealPanel />
    </>
  );
}
