import type { NFLScheduleGame } from "./nfl";

/**
 * One player's picks for a single week.
 */
export interface WeeklyPickSheet {
  playerId: string;
  week: number;

  picks: {
    gameId: string;
    selectedTeam: string;
    locked: boolean;
    correct?: boolean;
  }[];

  submitted: boolean;
  submittedAt?: string;

  autoPickerClicker: boolean;
}

/**
 * One head-to-head matchup.
 */
export interface WeeklyMatchup {
  week: number;

  homePlayerId: string;
  awayPlayerId?: string; // undefined = Bye Week

  homeFranchise: string;
  awayFranchise?: string;

  homeCorrectPicks: number;
  awayCorrectPicks: number;

  winnerId?: string;

  leaguePointsAwarded: boolean;

  completed: boolean;

  isByeWeek: boolean;
}

/**
 * Entire league state for one NFL week.
 */
export interface WeekState {
  season: number;

  week: number;

  nflGames: NFLScheduleGame[];

  playerMatchups: WeeklyMatchup[];

  pickSheets: WeeklyPickSheet[];

  picksLocked: boolean;

  resultsFinalized: boolean;

  completed: boolean;
}