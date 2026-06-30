import type { NFLTeam } from "../../types/nfl";
import { nflFranchises } from "../../lib/nflFranchises";

export const nflTeams: NFLTeam[] = nflFranchises.map((team) => ({
  id: team.id,
  abbreviation: team.abbreviation,
  city: team.city,
  nickname: team.nickname,
  fullName: team.fullName,
  conference: team.conference,
  division: team.division,
  logo: team.logo,
  primaryColor: team.primaryColor,
  secondaryColor: team.secondaryColor,
}));

export function getNFLTeam(teamId: string) {
  return nflTeams.find((team) => team.id === teamId);
}

export function getNFLTeamsByDivision(division: string) {
  return nflTeams.filter((team) => team.division === division);
}

export function getNFLTeamsByConference(conference: string) {
  return nflTeams.filter((team) => team.conference === conference);
}