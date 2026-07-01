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
  backupCommissioner: string;

  players: SetupPlayer[];

  selectedFranchises: Record<string, string>;
  // franchiseId -> playerId

  started: boolean;
}

export const defaultLeagueSetup: LeagueSetupState = {
  leagueName: "Head2Head Brawlin'",
  season: 2026,
  commissioner: "",
  backupCommissioner: "",

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
 * Returns true when the commissioner field is filled in.
 */
export function hasCommissioner(state: LeagueSetupState) {
  return state.commissioner.trim().length > 0;
}

/**
 * Returns true when the backup commissioner field is filled in.
 */
export function hasBackupCommissioner(state: LeagueSetupState) {
  return state.backupCommissioner.trim().length > 0;
}

/**
 * Returns true when the commissioner and backup commissioner are different people.
 */
export function hasValidCommissionerTeam(state: LeagueSetupState) {
  const commissioner = state.commissioner.trim().toLowerCase();
  const backupCommissioner = state.backupCommissioner.trim().toLowerCase();

  if (!commissioner || !backupCommissioner) return false;

  return commissioner !== backupCommissioner;
}

/**
 * Returns true when the league can be started.
 */
export function canStartSeason(state: LeagueSetupState) {
  return (
    hasCommissioner(state) &&
    hasBackupCommissioner(state) &&
    hasValidCommissionerTeam(state) &&
    hasAllPlayers(state) &&
    hasAllFranchises(state)
  );
}