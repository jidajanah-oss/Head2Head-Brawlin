import { useState } from "react";
import type { Player } from "../types/player";
import type { LeagueState } from "../types/league";
import { mockPlayers } from "../features/players/mockPlayers";

const initialLeagueState: LeagueState = {
  settings: {
    leagueName: "Head2Head Brawlin",
    season: "2026 Pick'em",
    maxPlayers: 32,
    pickLockMinutesBeforeKickoff: 5,
  },
  players: mockPlayers,
};

export function useLeagueStore() {
  const [league, setLeague] = useState<LeagueState>(initialLeagueState);

  const addPlayer = (player: Player) => {
    setLeague((current) => ({
      ...current,
      players: [...current.players, player],
    }));
  };

  const deletePlayer = (playerId: string) => {
    setLeague((current) => ({
      ...current,
      players: current.players.filter((player) => player.id !== playerId),
    }));
  };

  return {
    league,
    addPlayer,
    deletePlayer,
  };
}