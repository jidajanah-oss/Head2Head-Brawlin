import type { NFLFranchise } from "../../lib/nflFranchises";

export interface SetupPlayer {
  id: string;
  name: string;
  franchiseId?: string;
}

export interface LeagueSetupState {
  leagueName: string;
  season: number;
  commissioner: string;

  players: SetupPlayer[];

  selectedFranchises: Record<string, string>;
  // franchiseId -> playerId

  started: boolean;
}

export const defaultLeagueSetup: LeagueSetupState = {
  leagueName: "Head2Head Brawlin'",
  season: 2026,
  commissioner: "",

  players: [],

  selectedFranchises: {},

  started: false,
};

/**
 * Returns true when a franchise has already been assigned.
 */
export function isFranchiseAssigned(
  state: LeagueSetupState,
  franchise: NFLFranchise
) {
  return franchise.id in state.selectedFranchises;
}

/**
 * Returns true when exactly 32 players have been entered.
 */
export function hasAllPlayers(state: LeagueSetupState) {
  return state.players.length === 32;
}

/**
 * Returns true when all 32 franchises are assigned.
 */
export function hasAllFranchises(state: LeagueSetupState) {
  return Object.keys(state.selectedFranchises).length === 32;
}

/**
 * Returns true when the league can be started.
 */
export function canStartSeason(state: LeagueSetupState) {
  return hasAllPlayers(state) && hasAllFranchises(state);
}