import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  clearPersistedLeagueState,
  loadPersistedLeagueState,
  savePersistedLeagueState,
} from "../engine/leaguePersistence";
import type {
  PersistedGameResults,
  PersistedPicks,
} from "../engine/leaguePersistence";

import { initialLeagueState } from "../lib/leagueEngine";
import type { Game } from "../types/game";
import type { Player } from "../types/player";

type LeagueState = typeof initialLeagueState;
type Picks = PersistedPicks;
type GameResults = PersistedGameResults;

type LeagueContextType = {
  league: LeagueState;

  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  deletePlayer: (playerId: string) => void;
  updateGame: (game: Game) => void;

  // 🏈 MULTIPLAYER PICKS
  picks: Picks;
  setPick: (playerId: string, gameId: string, team: string) => void;

  // 🧠 ACTIVE PLAYER SYSTEM
  activePlayerId: string;
  setActivePlayerId: (id: string) => void;

  // 🧪 RESULTS
  gameResults: GameResults;
  setGameResults: (results: GameResults) => void;

  // 💾 PERSISTENCE
  resetLeaguePersistence: () => void;
};

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

function resolveActivePlayerId(activePlayerId: string, players: Player[]) {
  if (activePlayerId && players.some((player) => player.id === activePlayerId)) {
    return activePlayerId;
  }

  return players[0]?.id ?? "";
}

function removePicksForMissingPlayers(picks: Picks, players: Player[]) {
  const validPlayerIds = new Set(players.map((player) => player.id));

  return Object.entries(picks).reduce<Picks>((cleanedPicks, [playerId, playerPicks]) => {
    if (validPlayerIds.has(playerId)) {
      cleanedPicks[playerId] = playerPicks;
    }

    return cleanedPicks;
  }, {});
}

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [persistedStartState] = useState(() =>
    loadPersistedLeagueState(initialLeagueState)
  );

  const [league, setLeague] = useState<LeagueState>(persistedStartState.league);

  const [picks, setPicks] = useState<Picks>(() =>
    removePicksForMissingPlayers(
      persistedStartState.picks,
      persistedStartState.league.players
    )
  );

  const [activePlayerId, setActivePlayerId] = useState<string>(() =>
    resolveActivePlayerId(
      persistedStartState.activePlayerId,
      persistedStartState.league.players
    )
  );

  const [gameResults, setGameResults] = useState<GameResults>(
    persistedStartState.gameResults
  );

  useEffect(() => {
    savePersistedLeagueState({
      league,
      picks,
      activePlayerId,
      gameResults,
    });
  }, [league, picks, activePlayerId, gameResults]);

  const setPlayers = (players: Player[]) => {
    setLeague((prev) => ({
      ...prev,
      players,
    }));

    setPicks((prev) => removePicksForMissingPlayers(prev, players));

    setActivePlayerId((prev) => resolveActivePlayerId(prev, players));
  };

  const addPlayer = (player: Player) => {
    setLeague((prev) => ({
      ...prev,
      players: [...prev.players, player],
    }));

    setActivePlayerId((prev) => prev || player.id);
  };

  const deletePlayer = (playerId: string) => {
    const remainingPlayers = league.players.filter((player) => player.id !== playerId);

    setLeague((prev) => ({
      ...prev,
      players: prev.players.filter((player) => player.id !== playerId),
    }));

    setPicks((prev) => {
      const nextPicks = { ...prev };
      delete nextPicks[playerId];
      return nextPicks;
    });

    setActivePlayerId((prev) => {
      if (prev !== playerId) {
        return prev;
      }

      return remainingPlayers[0]?.id ?? "";
    });
  };

  const updateGame = (game: Game) => {
    setLeague((prev) => ({
      ...prev,
      games: prev.games.map((currentGame) =>
        currentGame.id === game.id ? game : currentGame
      ),
    }));
  };

  // 🏈 MULTIPLAYER PICK SYSTEM
  const setPick = (playerId: string, gameId: string, team: string) => {
    setPicks((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [gameId]: team,
      },
    }));
  };

  const resetLeaguePersistence = () => {
    clearPersistedLeagueState();

    setLeague(initialLeagueState);
    setPicks({});
    setGameResults({});
    setActivePlayerId(resolveActivePlayerId("", initialLeagueState.players));
  };

  return (
    <LeagueContext.Provider
      value={{
        league,

        setPlayers,
        addPlayer,
        deletePlayer,
        updateGame,

        // picks system
        picks,
        setPick,

        // active player
        activePlayerId,
        setActivePlayerId,

        // results
        gameResults,
        setGameResults,

        // persistence
        resetLeaguePersistence,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);

  if (!context) {
    throw new Error("useLeague must be used within LeagueProvider");
  }

  return context;
}