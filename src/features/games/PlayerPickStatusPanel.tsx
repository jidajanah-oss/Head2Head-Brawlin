import { useEffect, useState } from "react";
import { SteelBadge, SteelButton, SteelCard, SteelSectionHeader } from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { getPickCompletionStatus, loadCloudPlayerPickStatus, type PickCompletionStatus, type PlayerPickStatusReport } from "../../services/cloudPlayerPickStatusService";
import { supabaseClient } from "../../services/supabaseClient";
import "../../styles/playerPickStatus.css";

const labels: Record<PickCompletionStatus, string> = {
  complete: "Complete",
  "in-progress": "In Progress",
  "not-started": "Not Started",
  "missing-locked": "Missing Locked Pick",
};
const variants = { complete: "success", "in-progress": "gold", "not-started": "neutral", "missing-locked": "danger" } as const;
const statuses = Object.keys(labels) as PickCompletionStatus[];

function CommissionerPickStatus({ leagueId, season, currentWeek }: { leagueId: string; season: number; currentWeek: number }) {
  const [week, setWeek] = useState(currentWeek);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [result, setResult] = useState<{ week: number; report: PlayerPickStatusReport | null; loading: boolean; error: string | null; updatedAt: string | null }>({ week, report: null, loading: true, error: null, updatedAt: null });

  useEffect(() => {
    let canceled = false;
    let running = false;
    const load = async () => {
      if (running || !supabaseClient) return;
      running = true;
      setResult(previous => ({ ...previous, week, report: previous.week === week ? previous.report : null, loading: true, error: null, updatedAt: previous.week === week ? previous.updatedAt : null }));
      try {
        const report = await loadCloudPlayerPickStatus(supabaseClient, { leagueId, season, week });
        if (!canceled) setResult({ week, report, loading: false, error: null, updatedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
      } catch (error) {
        if (!canceled) setResult(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Unable to load player pick status." }));
      } finally {
        running = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { canceled = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [leagueId, season, week, refreshVersion]);

  const selectedResult = result.week === week ? result : null;
  const report = selectedResult?.report;
  const totals = Object.fromEntries(statuses.map(status => [status, report?.players.filter(player => getPickCompletionStatus(player, report.totalGames) === status).length ?? 0]));
  const loading = !selectedResult || selectedResult.loading;

  return <SteelCard as="section" variant="gold" className="player-pick-status" aria-label="Player Pick Status">
    <SteelSectionHeader eyebrow={`Commissioners only • Season ${season}`} title="Player Pick Status" description="Check who still needs to make picks. Selections stay private." action={<div className="player-pick-status-controls">
      <label>Week<select aria-label="Player pick status week" value={week} onChange={event => setWeek(Number(event.target.value))}>
        {Array.from({ length: currentWeek }, (_, index) => index + 1).map(value => <option key={value} value={value}>Week {value}{value === currentWeek ? " (Current)" : ""}</option>)}
      </select></label>
      <SteelButton size="sm" variant="secondary" disabled={loading} onClick={() => setRefreshVersion(value => value + 1)}>{loading ? "Checking…" : "Refresh Status"}</SteelButton>
    </div>} />

    <p className="player-pick-status-note" role="status">{selectedResult?.error ? `${selectedResult.error}${report ? " Showing the last successful check." : ""}` : !report ? "Loading player pick status…" : `Week ${week} • ${report.players.length} players • ${report.totalGames} games • ${report.lockedGames} locked${selectedResult?.updatedAt ? ` • Checked ${selectedResult.updatedAt}` : ""}`}</p>

    {report && report.totalGames === 0 ? <p className="player-pick-status-empty">The shared schedule is not available for this week yet. Pick completion cannot be calculated.</p> : null}
    {report && report.totalGames > 0 ? <>
      <div className="player-pick-status-totals">{statuses.map(status => <div key={status} className={`player-pick-status-total is-${status}`}><strong>{totals[status]}</strong><span>{labels[status]}</span></div>)}</div>
      {report.players.length === 0 ? <p>No active players are listed for this league.</p> : <div className="player-pick-status-table-wrap"><table>
        <caption className="player-pick-status-caption">Player completion for Week {week}</caption>
        <thead><tr><th scope="col">Player</th><th scope="col">Franchise</th><th scope="col">Games Picked</th><th scope="col">Pick Status</th><th scope="col">Locks</th></tr></thead>
        <tbody>{report.players.map(player => {
          const status = getPickCompletionStatus(player, report.totalGames);
          return <tr key={player.playerId}><th scope="row">{player.name}</th><td>{player.nflTeam}</td><td className="player-pick-status-count">{player.pickedCount}/{report.totalGames}</td><td><SteelBadge variant={variants[status]}>{labels[status]}</SteelBadge></td><td>{player.lockedMissingCount > 0 ? <span className="player-pick-status-missing">{player.lockedMissingCount} missed locked {player.lockedMissingCount === 1 ? "game" : "games"}<br /></span> : null}{report.lockedGames === report.totalGames ? "Fully Locked" : `${report.totalGames - report.lockedGames} games still open`}</td></tr>;
        })}</tbody>
      </table></div>}
      <p className="player-pick-status-note">Manual picks and deliberate Picker Clicker choices count. Automatic fallback does not count as a made pick. Completion reflects saved choices, not the last submission checkpoint.</p>
    </> : null}
  </SteelCard>;
}

export default function PlayerPickStatusPanel() {
  const { status, accountLink, access } = useAuth();
  const { league } = useLeague();
  if (status !== "signed-in-linked" || !accountLink || !access.canManageLeague || !supabaseClient || !accountLink.season) return null;
  const currentWeek = Math.min(18, Math.max(1, league.currentWeek));
  return <CommissionerPickStatus key={`${accountLink.userId}:${accountLink.leagueId}:${accountLink.season}:${currentWeek}`} leagueId={accountLink.leagueId} season={accountLink.season} currentWeek={currentWeek} />;
}
