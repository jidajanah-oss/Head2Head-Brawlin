import { nflDivisions } from "./nflStructure";
import type { Division, Conference } from "./nflStructure";

/**
 * Get division from NFL team
 */
export function getDivisionFromTeam(team: string): Division | null {
  for (const division of Object.keys(nflDivisions) as Division[]) {
    if (nflDivisions[division].teams.includes(team)) {
      return division;
    }
  }
  return null;
}

/**
 * Get conference from NFL team
 */
export function getConferenceFromTeam(team: string): Conference | null {
  const division = getDivisionFromTeam(team);
  if (!division) return null;

  return nflDivisions[division].conference;
}