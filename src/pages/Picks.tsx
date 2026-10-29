import { useState } from "react";
import { NFLProvider } from "../context/NFLContext";
import CloudPlayerPickIntentSync from "../features/auth/CloudPlayerPickIntentSync";
import CloudPickerClickerAssignmentSync from "../features/auth/CloudPickerClickerAssignmentSync";
import { advancePickWeeks } from "../features/picks/advancePickWeeks";
import { useAuth } from "../context/AuthContext";
import { usePickerClickerCloudAuthority } from "../services/pickerClickerCloudAuthorityService";
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

function SelectedWeekPicks() {
  const { league, activePlayerId } = useLeague();
  const { snapshot, loading, season, week } = useNFL();
  const { accountLink } = useAuth();
  const authority = usePickerClickerCloudAuthority(season, week, accountLink?.leagueId);
  const advance = week !== league.currentWeek;
  const player = league.players.find(value => value.id === activePlayerId);
  if (player && !loading && snapshot?.season === season && snapshot.week === week &&
      isNFLByeWeek(player.nflTeam, week, snapshot.weekGames)) {
    return <main className="pick-sheet picks-v2">
      <PlayerSelector />
      <section role="status" className="picks-state-card">
        <h1>You’re on a bye week</h1>
        <h2>Week {week} • {player.nflTeam} • No picks required</h2>
        <p>Your franchise has a bye this week. You can relax and return next week to make your picks.</p>
        <p>No loss, missed-pick penalty, or automatic Picker Clicker applies. Any picks already saved for this week will not count.</p>
        <Link to="/standings">View standings</Link>
      </section>
    </main>;
  }
  return (
    <>
      {advance && authority.status !== "ready" ? <section role="status" className="picks-state-card">
        <h2>Week {week} is being prepared</h2>
        <p>The commissioner must publish this week’s schedule and shared Picker Clicker source before advance picks open. Saved picks are unchanged.</p>
      </section> : null}
      <WeeklyPickSubmissionPanel />
      <PickSheet />
      {!advance ? <OpponentPickRevealPanel /> : null}
    </>
  );
}

export default function Picks() {
  const { league } = useLeague();
  const { season } = useNFL();
  const [selection, setSelection] = useState({ current: league.currentWeek, week: league.currentWeek });
  const weeks = advancePickWeeks(league.currentWeek);
  const week = selection.current === league.currentWeek && weeks.includes(selection.week)
    ? selection.week : league.currentWeek;
  return <>
    <section className="picks-state-card picks-week-selector">
      <label htmlFor="advance-pick-week">Pick week </label>
      <select id="advance-pick-week" value={week} onChange={event => setSelection({ current: league.currentWeek, week: Number(event.target.value) })}>
        {weeks.map(value => <option key={value} value={value}>Week {value}{value === league.currentWeek ? " (current)" : " (advance)"}</option>)}
      </select>
      <p>Make picks up to two weeks early. Use Sync and Submit to save your card. Each game keeps its normal lock time.</p>
    </section>
    {week === league.currentWeek ? <SelectedWeekPicks /> :
      <NFLProvider key={`${season}:${week}`} initialSeason={season} initialWeek={week}>
        <CloudPickerClickerAssignmentSync targetWeek={week} />
        <CloudPlayerPickIntentSync advance />
        <SelectedWeekPicks />
      </NFLProvider>}
  </>;
}
