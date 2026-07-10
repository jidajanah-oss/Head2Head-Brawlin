import type {
  ObscureStatRule,
  ObscureStatTieBreaker,
} from "./obscureStatTypes";

export type ObscureStatAwardStatus =
  | "no-award"
  | "pending"
  | "resolved"
  | "coin-flip-required"
  | "unavailable";

export type ObscureStatAwardPendingReason =
  | "game-stats-incomplete"
  | "weekly-scoring-not-final";

export type ObscureStatCandidateEligibility =
  | "eligible"
  | "no-weekly-game"
  | "game-not-final"
  | "stat-unavailable";

export type ObscureStatAwardResolutionMethod =
  | "stat-value"
  | ObscureStatTieBreaker;

export type ObscureStatAwardCandidate = {
  playerId: string;
  playerName: string;
  nflTeam: string;

  gameId: string | null;
  opponentNFLTeam: string | null;

  eligibility:
    ObscureStatCandidateEligibility;

  statValue: number | null;

  weeklyCorrectPicks: number | null;
  leaguePoints: number;
  assignedNFLTeamWon: boolean | null;

  primaryRank: number | null;
};

export type ObscureStatAwardWinner = {
  playerId: string;
  playerName: string;
  nflTeam: string;

  gameId: string;
  opponentNFLTeam: string;

  statValue: number;

  weeklyCorrectPicks: number;
  leaguePoints: number;
  assignedNFLTeamWon: boolean | null;

  resolutionMethod:
    ObscureStatAwardResolutionMethod;
};

export type ObscureStatAwardResult = {
  id: string;
  season: number;
  week: number;

  rule: ObscureStatRule;

  status: ObscureStatAwardStatus;

  pendingReason:
    | ObscureStatAwardPendingReason
    | null;

  candidates: ObscureStatAwardCandidate[];

  winner: ObscureStatAwardWinner | null;

  tiedPlayerIds: string[];
  coinFlipPlayerIds: string[];

  eligiblePlayerCount: number;
  unavailablePlayerCount: number;

  weeklyScoringFinalized: boolean;
  allRequiredGameStatsFinal: boolean;
};

export function getObscureStatAwardId(
  season: number,
  week: number,
): string {
  return `${season}-week-${week}-obscure-stat`;
}