import type { PlayerRole } from "../types/player";

export type CloudAuthStatus =
  | "disabled"
  | "loading"
  | "signed-out"
  | "signed-in-unlinked"
  | "signed-in-linked"
  | "error";

export type CloudConnectionStatus =
  | "disabled"
  | "checking"
  | "connected"
  | "error";

export type CloudAuthIdentity = {
  userId: string;
  email: string;
};

export type CloudAccountLink = {
  userId: string;
  leagueId: string;
  playerId: string;
  role: PlayerRole;
  active: boolean;
  leagueName?: string;
  season?: number;
  playerName?: string;
  nflTeam?: string;
};

export type CloudAccessState = {
  identity: CloudAuthIdentity | null;
  accountLink: CloudAccountLink | null;
  role: PlayerRole | null;
  linkedPlayerId: string | null;
  isAuthenticated: boolean;
  isLinked: boolean;
  canViewLeague: boolean;
  canManageOwnPicks: boolean;
  canManageAllPicks: boolean;
  canAccessCommissioner: boolean;
  canManageLeague: boolean;
  canManageAccounts: boolean;
};
