import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import OpponentPickRevealPanel from "../picks/OpponentPickRevealPanel";
import { HeadToHeadMatchupsBoard } from "../standings/StandingsBoard";
import HistoricalWeekPanel from "./HistoricalWeekPanel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import ObscureStatAwardCard from "../awards/ObscureStatAwardCard";
import { getStatusLabel } from "../games/gameCenterUtils";
import { isNFLByeWeek } from "../../engine/isNFLByeWeek";
import "../../styles/opponentPickReveal.css";
import "../../styles/compactHome.css";
import "../../styles/compactComparison.css";

const LEAGUE_LOGO_PATH = `${import.meta.env.BASE_URL}logos/league/head2head-brawlin.png`;
function HomeDetail({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="compact-home-detail" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>{open && <div className="compact-home-detail-content">{children}</div>}
  </details>;
}
export default function HomeDashboard() {
  const { league, scoringHistory, activePlayerId } = useLeague();
  const { snapshot } = useNFL();
  const [viewedWeek, setViewedWeek] = useState(league.currentWeek);
  useEffect(() => { setViewedWeek(league.currentWeek); }, [league.currentWeek]);
  const season = Number.parseInt(String(league.settings.season), 10);
  const pastWeeks = useMemo(() => Array.from(new Set(Object.values(scoringHistory)
    .filter(record => record.season === season && record.week < league.currentWeek)
    .map(record => record.week))).sort((left, right) => right - left), [league.currentWeek, scoringHistory, season]);
  const viewingCurrentWeek = viewedWeek === league.currentWeek;
  const currentSnapshot = snapshot?.season === season && snapshot.week === league.currentWeek ? snapshot : null;
  const liveGames = (currentSnapshot?.weekGames ?? []).filter(game => getStatusLabel(game).toLowerCase().includes("live"));
  const player = league.players.find(value => value.id === activePlayerId);
  const onBye = Boolean(player && currentSnapshot && isNFLByeWeek(player.nflTeam, league.currentWeek, currentSnapshot.weekGames));
  return <main className="dashboard dashboard-v2 compact-home">
    <header className="compact-home-header">
      <img src={LEAGUE_LOGO_PATH} alt="Head2Head Brawlin’" width="42" height="42" />
      <div className="compact-home-brand"><h1>Head2Head Brawlin’</h1><p>{season} Pick’em · {player ? `${player.name} · ${player.nflTeam}` : "League Home"}</p></div>
      <label className="compact-home-week"><span>Week</span><select aria-label="Display week" value={viewedWeek} onChange={event => setViewedWeek(Number(event.target.value))}>
        <option value={league.currentWeek}>{league.currentWeek} · Current</option>
        {pastWeeks.map(week => <option key={week} value={week}>{week} · Final</option>)}
      </select></label>
    </header>
    <nav className="compact-home-actions" aria-label="League shortcuts">
      <Link className="is-primary" to="/picks">{onBye ? "Bye Week" : "Make Picks"}</Link><Link to="/standings">Standings</Link><Link to="/games">NFL Games</Link>
    </nav>
    {viewingCurrentWeek ? <>
      {onBye ? <section className="compact-home-bye" role="status"><strong>Week {league.currentWeek}: You’re on a bye</strong><p>No picks required. Your picks resume next week.</p></section> : <HeadToHeadMatchupsBoard playerOnly compact />}
      <p className="compact-home-live">{liveGames.length ? `${liveGames.length} NFL game${liveGames.length === 1 ? "" : "s"} live now` : currentSnapshot ? `${currentSnapshot.weekGames.length} NFL games this week` : "Schedule loading…"} · Week {league.currentWeek}</p>
      {!onBye && <OpponentPickRevealPanel comparison compact />}
      <div key={`${league.currentWeek}:${activePlayerId ?? "none"}`} className="compact-home-details">
        <HomeDetail title="All league matchups"><HeadToHeadMatchupsBoard compact /></HomeDetail>
        <HomeDetail title="Weekly obscure stat"><ObscureStatAwardCard className="dashboard-obscure-stat-award" /></HomeDetail>
      </div>
    </> : <section className="compact-home-history">
      <div className="compact-home-history-notice"><span>Week {viewedWeek} · Read-only history</span><button type="button" onClick={() => setViewedWeek(league.currentWeek)}>Back to current</button></div>
      <HistoricalWeekPanel week={viewedWeek} />
    </section>}
  </main>;
}
