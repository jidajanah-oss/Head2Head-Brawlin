import type {
  PlayerRole,
  PlayerStatus,
} from "../types/player";

export type FutureSeasonPlanStatus =
  | "draft"
  | "ready"
  | "activated";

export type FutureSeasonRosterDecision =
  | "returning"
  | "replacement"
  | "inactive";

export type FutureSeasonPlayerPlan = {
  playerId: string;
  sourcePlayerId: string;
  name: string;
  nflTeam: string;
  email?: string;
  customLogo?: string;
  role: PlayerRole;
  status: PlayerStatus;
  rosterDecision: FutureSeasonRosterDecision;
  preservesCloudLink: boolean;
};

export type FutureSeasonPlan = {
  id: string;
  sourceSeason: number;
  targetSeason: number;
  leagueName: string;
  status: FutureSeasonPlanStatus;
  players: FutureSeasonPlayerPlan[];
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
};

export type FutureSeasonValidationCode =
  | "invalid-source-season"
  | "invalid-target-season"
  | "target-season-not-later"
  | "missing-league-name"
  | "invalid-player-count"
  | "duplicate-player-id"
  | "duplicate-player-name"
  | "duplicate-nfl-team"
  | "missing-primary-commissioner"
  | "multiple-primary-commissioners"
  | "missing-backup-commissioner"
  | "multiple-backup-commissioners"
  | "same-commissioner-account"
  | "inactive-roster-player"
  | "replacement-preserves-cloud-link";

export type FutureSeasonValidationIssue = {
  code: FutureSeasonValidationCode;
  message: string;
  playerId?: string;
};

export type FutureSeasonValidationResult = {
  ready: boolean;
  issues: FutureSeasonValidationIssue[];
};