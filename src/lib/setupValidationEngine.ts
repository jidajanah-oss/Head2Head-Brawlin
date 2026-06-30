import type { LeagueSetupState } from "../features/setup/setupTypes";

export interface ValidationResult {
  ready: boolean;

  messages: string[];
}

export function validateLeague(
  setup: LeagueSetupState
): ValidationResult {
  const messages: string[] = [];

  if (!setup.leagueName.trim()) {
    messages.push("League name required.");
  }

  if (!setup.commissioner.trim()) {
    messages.push("Commissioner required.");
  }

  if (setup.players.length !== 32) {
    messages.push(
      `Need 32 players (${setup.players.length}/32).`
    );
  }

  if (
    Object.keys(setup.selectedFranchises).length !== 32
  ) {
    messages.push("Assign every NFL franchise.");
  }

  return {
    ready: messages.length === 0,
    messages,
  };
}