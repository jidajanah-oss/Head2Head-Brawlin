export type SeasonAwardCategory =
  | "biggest-winner"
  | "biggest-loser"
  | "last-to-lose";

export type SeasonAwardStatus =
  | "unavailable"
  | "provisional"
  | "coin-flip-required"
  | "resolved";

export type SeasonAwardResolutionMethod =
  | "wins"
  | "losses"
  | "undefeated"
  | "first-loss-week"
  | "league-points"
  | "season-correct-picks"
  | "offline-coin-flip";

export type SeasonAwardCandidate = {
  playerId: string;
  playerName: string;
  nflTeam: string;
  wins: number;
  losses: number;
  ties: number;
  leaguePoints: number;
  seasonCorrectPicks: number;
  completedHeadToHeadWeeks: number;
  firstLossWeek: number | null;
  undefeated: boolean;
};

export type SeasonAwardWinner =
  SeasonAwardCandidate & {
    resolutionMethod: SeasonAwardResolutionMethod;
  };

export type SeasonAwardResult = {
  id: string;
  season: number;
  category: SeasonAwardCategory;
  title: string;
  status: SeasonAwardStatus;
  isSeasonFinal: boolean;
  calculatedThroughWeek: number;
  eligiblePlayerCount: number;
  candidates: SeasonAwardCandidate[];
  leadingPlayerIds: string[];
  coinFlipPlayerIds: string[];
  winner: SeasonAwardWinner | null;
  pendingReason: string | null;
};

export type SeasonAwardResults = Record<
  SeasonAwardCategory,
  SeasonAwardResult
>;

export type SeasonAwardCoinFlipResolution = {
  id: string;
  season: number;
  category: SeasonAwardCategory;
  winnerPlayerId: string;
  eligiblePlayerIds: string[];
  resolvedAt: string;
};

export type SeasonAwardCoinFlipHistory = Record<
  string,
  SeasonAwardCoinFlipResolution
>;

export function getSeasonAwardId(
  season: number,
  category: SeasonAwardCategory,
): string {
  return `${season}-${category}-season-award`;
}

export function getSeasonAwardCoinFlipId(
  season: number,
  category: SeasonAwardCategory,
): string {
  return `${getSeasonAwardId(season, category)}-coin-flip`;
}
