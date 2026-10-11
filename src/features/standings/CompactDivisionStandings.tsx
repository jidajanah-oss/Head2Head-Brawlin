import { useState } from "react";
import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import type { NFLStyleDivisionStandings, NFLStyleDivisionStandingGroup } from "../../engine";

type Props = { standings: NFLStyleDivisionStandings; activePlayerId: string | null };
type View = "mine" | "AFC" | "NFC" | "all";

function DivisionTable({ division, activePlayerId }: {
  division: NFLStyleDivisionStandingGroup; activePlayerId: string | null;
}) {
  const openTeams = division.teams.filter(team => !division.rows.some(row => row.nflTeamAbbreviation === team.abbreviation));
  return <section className="compact-division" aria-label={`${division.division} standings`}>
    <header><h2>{division.division}</h2><span>{division.claimedCount} teams</span></header>
    <table>
      <caption className="compact-sr-only">{division.division}: season records, league points, and correct picks</caption>
      <thead><tr><th scope="col">Team / Player</th><th scope="col">W–L–T</th><th scope="col"><abbr title="League points">PTS</abbr></th><th scope="col"><abbr title="Season eligible correct picks">Picks</abbr></th></tr></thead>
      <tbody>{division.rows.map(row => <tr key={row.id} className={row.id === activePlayerId ? "is-you" : ""}>
        <th scope="row"><div className="compact-team">
          <span className="compact-position">{row.divisionRank}</span>
          <FranchiseLogo nflTeam={row.nflTeamAbbreviation} displayName={row.nflTeamDisplayName} size="sm" />
          <span className="compact-name"><strong>{row.nflTeamAbbreviation}<span className="compact-player-name"> · {row.name}</span></strong>
            <small>{row.name}{row.hasBye ? " · BYE" : ""}{row.id === activePlayerId ? " · YOU" : ""}</small>
          </span>
        </div></th>
        <td>{row.wins}–{row.losses}–{row.ties}</td><td className="compact-points">{row.leaguePoints}</td><td>{row.pickPoints}</td>
      </tr>)}</tbody>
    </table>
    {!division.rows.length && <p className="compact-empty">No franchise owners yet.</p>}
    {openTeams.length > 0 && <p className="compact-open">Open: {openTeams.map(team => team.abbreviation).join(" · ")}</p>}
  </section>;
}

export default function CompactDivisionStandings({ standings, activePlayerId }: Props) {
  const [view, setView] = useState<View>("mine");
  const [chosenDivision, setChosenDivision] = useState<string | null>(null);
  const myDivision = standings.divisions.find(division => division.rows.some(row => row.id === activePlayerId));
  const selectedDivision = chosenDivision ?? myDivision?.division ?? standings.divisions[0]?.division;
  const visible = standings.divisions.filter(division => view === "mine"
    ? division.division === selectedDivision : view === "all" || division.conference === view);
  const tabs: Array<[View, string]> = [["mine", "My Division"], ["AFC", "AFC"], ["NFC", "NFC"], ["all", "All"]];
  return <section className="compact-browser" aria-label="Division standings">
    <div className="compact-view-tabs" role="group" aria-label="Standings view">
      {tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={view === value}
        onClick={() => { setView(value); setChosenDivision(null); }}>{label}</button>)}
    </div>
    {view === "mine" && <div className="compact-division-picker">
      <label htmlFor="compact-division-choice">Division</label>
      <select id="compact-division-choice" value={selectedDivision ?? ""} onChange={event => setChosenDivision(event.target.value)}>
        {standings.divisions.map(division => <option key={division.division} value={division.division}>{division.division}{division.division === myDivision?.division ? " · Yours" : ""}</option>)}
      </select>
      {chosenDivision && chosenDivision !== myDivision?.division && myDivision && <button type="button" onClick={() => setChosenDivision(null)}>Back to mine</button>}
    </div>}
    <div className="compact-divisions-grid">{visible.map(division => <DivisionTable key={division.division} division={division} activePlayerId={activePlayerId} />)}</div>
    {!visible.length && <p className="compact-empty">Standings will appear when the roster is loaded.</p>}
    <p className="compact-key">PTS: league points · Picks: season correct picks · Highlighted row: your franchise</p>
  </section>;
}
