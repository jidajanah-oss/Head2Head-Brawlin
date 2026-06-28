import type { Player } from "./player";

export type LeagueSettings = {
  leagueName: string;
  season: string;
  maxPlayers: number;
  pickLockMinutesBeforeKickoff: number;
};

export type LeagueState = {
  settings: LeagueSettings;
  players: Player[];
};