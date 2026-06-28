export type Conference = "AFC" | "NFC";

export type Division =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";

export interface LeaguePlayer {
  id: string;
  name: string;

  /** Assigned NFL franchise */
  nflTeam: string;

  conference: Conference;
  division: Division;

  /** Season record */
  wins: number;
  losses: number;
  ties: number;

  /** 3 / 1 / 0 scoring */
  leaguePoints: number;

  /** Total correct picks this season */
  correctPicks: number;

  /** Used as the 2nd tiebreaker */
  headToHeadWins: number;

  /** NFL bye week */
  byeWeek: number;
}

export interface NFLGame {
  id: string;

  week: number;

  homeTeam: string;
  awayTeam: string;

  kickoff: string;

  winner?: string;

  completed: boolean;
}

export interface WeeklyMatchup {
  week: number;

  homePlayerId: string;

  awayPlayerId: string;

  homeCorrect: number;

  awayCorrect: number;

  winnerId?: string;

  tie: boolean;

  played: boolean;
}

export interface WeeklyPick {
  gameId: string;

  selectedTeam: string;
}

export interface WeeklyPickSheet {
  playerId: string;

  week: number;

  picks: WeeklyPick[];

  submitted: boolean;

  submittedAt?: string;
}

export interface PlayoffSeed {
  seed: number;

  playerId: string;

  divisionWinner: boolean;

  wildCard: boolean;

  bye: boolean;
}

export interface LeagueSettings {
  leagueName: string;

  season: number;

  currentWeek: number;

  commissioner: string;

  picksLockMinutesBeforeKickoff: number;
}

export interface LeagueState {
  settings: LeagueSettings;

  players: LeaguePlayer[];

  schedule: NFLGame[];

  weeklyMatchups: WeeklyMatchup[];

  pickSheets: WeeklyPickSheet[];

  afcSeeds: PlayoffSeed[];

  nfcSeeds: PlayoffSeed[];
}