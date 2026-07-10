export type WeeklyScoringOutcome =
  | "win"
  | "loss"
  | "tie"
  | "bye"
  | "open";

export type WeeklyScoringMatchupType =
  | "owned-opponent"
  | "open-opponent"
  | "bye";

export type WeeklyScoringMatchupStatus =
  | "final"
  | "bye"
  | "open";

export type WeeklyPlayerScoringResult = {
  playerId: string;
  playerName: string;
  nflTeam: string;

  matchupId: string;
  matchupType: WeeklyScoringMatchupType;

  opponentId: string | null;
  opponentName: string;

  correctPicks: number;
  possiblePicks: number;
  missingPicks: number;

  outcome: WeeklyScoringOutcome;
  leaguePointsAwarded: number;
};

export type FinalizedWeeklyMatchupRecord = {
  id: string;
  season: number;
  week: number;

  matchupId: string;
  matchupType: WeeklyScoringMatchupType;
  sourceGameId?: string;

  playerAId: string;
  playerAName: string;
  playerATeam: string;

  playerBId: string | null;
  playerBName: string | null;
  playerBTeam: string | null;

  playerAScore: number;
  playerBScore: number;
  possiblePoints: number;

  winnerId: string | null;
  isTie: boolean;

  status: WeeklyScoringMatchupStatus;
  resultLabel: string;
};

export type FinalizedWeeklyScoringRecord = {
  id: string;
  season: number;
  week: number;
  finalizedAt: string;

  totalScheduledGames: number;
  completedGameCount: number;
  canceledGameCount: number;
  eligibleScoringGameCount: number;

  completedGameIds: string[];
  canceledGameIds: string[];

  matchups: FinalizedWeeklyMatchupRecord[];

  playerResults: Record<string, WeeklyPlayerScoringResult>;
};

export type WeeklyScoringHistory = Record<
  string,
  FinalizedWeeklyScoringRecord
>;

export type SeasonPlayerScoringSummary = {
  playerId: string;
  playerName: string;
  nflTeam: string;

  wins: number;
  losses: number;
  ties: number;

  leaguePoints: number;
  seasonCorrectPicks: number;
  seasonPossiblePicks: number;
  seasonMissingPicks: number;

  completedHeadToHeadWeeks: number;
  byeWeeks: number;
  openOpponentWeeks: number;
};

export function getWeeklyScoringRecordId(
  season: number,
  week: number
) {
  return `${season}-week-${week}`;
}