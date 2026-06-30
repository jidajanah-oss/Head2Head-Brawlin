export type NFLGameStatus =
  | "scheduled"
  | "pregame"
  | "in_progress"
  | "halftime"
  | "final"
  | "postponed"
  | "canceled";

export interface NFLTeamRef {
  id: string;
  abbreviation: string;
  name: string;
  displayName: string;
}

export interface NFLScore {
  home: number;
  away: number;
}

export interface NFLGame {
  id: string;
  week: number;
  season: number;
  kickoff: string;
  status: NFLGameStatus;
  homeTeam: NFLTeamRef;
  awayTeam: NFLTeamRef;
  score?: NFLScore;
}