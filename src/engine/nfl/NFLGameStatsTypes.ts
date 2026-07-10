import type { NFLGameStatus } from "./NFLTypes";

export type NFLTeamGameLocation =
  | "home"
  | "away";

export type NFLTeamGameStats = {
  teamId: string;
  abbreviation: string;
  displayName: string;
  homeAway: NFLTeamGameLocation;

  score: number | null;
  wonGame: boolean | null;

  firstDowns: number | null;

  thirdDownConversions: number | null;
  thirdDownAttempts: number | null;

  totalOffensivePlays: number | null;
  totalYards: number | null;
  yardsPerPlay: number | null;

  netPassingYards: number | null;
  passingAttempts: number | null;
  sacksAllowed: number | null;
  yardsPerPassAttempt: number | null;

  rushingYards: number | null;
  rushingAttempts: number | null;
  yardsPerRushAttempt: number | null;

  punts: number | null;
  possessionSeconds: number | null;
};

export type NFLGameStatsSnapshot = {
  gameId: string;
  season: number | null;
  week: number | null;
  status: NFLGameStatus;
  isFinal: boolean;

  awayTeam: NFLTeamGameStats;
  homeTeam: NFLTeamGameStats;

  fetchedAt: string;
};

export interface NFLGameStatsProvider {
  getGameStatsById(
    gameId: string,
  ): Promise<NFLGameStatsSnapshot | null>;
}