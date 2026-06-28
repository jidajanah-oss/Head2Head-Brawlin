import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { initialLeagueState } from "../lib/leagueEngine";
import type { Game } from "../types/game";
import type { Player } from "../types/player";

type Picks = Record<string, Record<string, string>>;

type LeagueContextType = {
  league: typeof initialLeagueState;

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
  gameResults: Record<string, string>;
  setGameResults: (results: Record<string, string>) => void;
};

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState(initialLeagueState);

  const [picks, setPicks] = useState<Picks>({});

  const [activePlayerId, setActivePlayerId] = useState<string>("");

  const [gameResults, setGameResults] = useState<Record<string, string>>({});

  const setPlayers = (players: Player[]) => {
    setLeague((prev) => ({ ...prev, players }));
  };

  const addPlayer = (player: Player) => {
    setLeague((prev) => ({
      ...prev,
      players: [...prev.players, player],
    }));
  };

  const deletePlayer = (playerId: string) => {
    setLeague((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
    }));
  };

  const updateGame = (game: Game) => {
    setLeague((prev) => ({
      ...prev,
      games: prev.games.map((g) =>
        g.id === game.id ? game : g
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