import type { Division, Conference } from "./nflStructure";
import { nflDivisions } from "./nflStructure";
import { getDivisionFromTeam, getConferenceFromTeam } from "./divisionEngine";

type PlayerStanding = {
  id: string;
  name: string;
  nflTeam: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  ties: number;
  correctPicks: number;
};

export type DivisionStandingGroup = {
  division: Division;
  conference: Conference;
  teams: PlayerStanding[];
};

function sortStandings(a: PlayerStanding, b: PlayerStanding) {
  if (b.leaguePoints !== a.leaguePoints) {
    return b.leaguePoints - a.leaguePoints;
  }

  return b.correctPicks - a.correctPicks;
}

export function buildDivisionStandings(players: PlayerStanding[]) {
  const groups: DivisionStandingGroup[] = [];

  for (const division of Object.keys(nflDivisions) as Division[]) {
    const conference = nflDivisions[division].conference;

    const teams = players
      .filter((player) => getDivisionFromTeam(player.nflTeam) === division)
      .sort(sortStandings);

    groups.push({
      division,
      conference,
      teams,
    });
  }

  return groups;
}

export function buildConferenceStandings(
  players: PlayerStanding[],
  conference: Conference
) {
  return players
    .filter((player) => getConferenceFromTeam(player.nflTeam) === conference)
    .sort(sortStandings);
}