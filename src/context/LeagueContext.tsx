import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
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
import type {
  PickerClickerHistory,
  PickerClickerWeekState,
} from "../engine/pickerClickerTypes";
import type {
  FinalizedWeeklyScoringRecord,
  WeeklyScoringHistory,
} from "../engine/weeklyScoringTypes";

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
  setPick: (
    playerId: string,
    gameId: string,
    team: string
  ) => void;

  // 🧠 ACTIVE PLAYER SYSTEM
  activePlayerId: string;
  setActivePlayerId: (id: string) => void;

  // 🧪 NFL GAME RESULTS
  gameResults: GameResults;
  setGameResults: (results: GameResults) => void;

  // 🏆 FINALIZED WEEKLY SCORING
  scoringHistory: WeeklyScoringHistory;
  addFinalizedWeeklyScoringRecord: (
    record: FinalizedWeeklyScoringRecord
  ) => void;

  // 🖱️ PICKER CLICKER
  pickerClickerHistory: PickerClickerHistory;
  upsertPickerClickerWeekState: (
    weekState: PickerClickerWeekState
  ) => void;

  // 💾 PERSISTENCE
  resetLeaguePersistence: () => void;
};

const LeagueContext = createContext<
  LeagueContextType | undefined
>(undefined);

function resolveActivePlayerId(
  activePlayerId: string,
  players: Player[]
) {
  if (
    activePlayerId &&
    players.some(
      (player) => player.id === activePlayerId
    )
  ) {
    return activePlayerId;
  }

  return players[0]?.id ?? "";
}

function removePicksForMissingPlayers(
  picks: Picks,
  players: Player[]
) {
  const validPlayerIds = new Set(
    players.map((player) => player.id)
  );

  return Object.entries(picks).reduce<Picks>(
    (
      cleanedPicks,
      [playerId, playerPicks]
    ) => {
      if (validPlayerIds.has(playerId)) {
        cleanedPicks[playerId] = playerPicks;
      }

      return cleanedPicks;
    },
    {}
  );
}

export function LeagueProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [persistedStartState] = useState(() =>
    loadPersistedLeagueState(
      initialLeagueState
    )
  );

  const [league, setLeague] =
    useState<LeagueState>(
      persistedStartState.league
    );

  const [picks, setPicks] = useState<Picks>(
    () =>
      removePicksForMissingPlayers(
        persistedStartState.picks,
        persistedStartState.league.players
      )
  );

  const [
    activePlayerId,
    setActivePlayerId,
  ] = useState<string>(() =>
    resolveActivePlayerId(
      persistedStartState.activePlayerId,
      persistedStartState.league.players
    )
  );

  const [gameResults, setGameResults] =
    useState<GameResults>(
      persistedStartState.gameResults
    );

  const [
    scoringHistory,
    setScoringHistory,
  ] = useState<WeeklyScoringHistory>(
    persistedStartState.scoringHistory
  );

  const [
    pickerClickerHistory,
    setPickerClickerHistory,
  ] = useState<PickerClickerHistory>(
    persistedStartState.pickerClickerHistory
  );

  useEffect(() => {
    savePersistedLeagueState({
      league,
      picks,
      activePlayerId,
      gameResults,
      scoringHistory,
      pickerClickerHistory,
    });
  }, [
    league,
    picks,
    activePlayerId,
    gameResults,
    scoringHistory,
    pickerClickerHistory,
  ]);

  const setPlayers = (players: Player[]) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      players,
    }));

    setPicks((previousPicks) =>
      removePicksForMissingPlayers(
        previousPicks,
        players
      )
    );

    setActivePlayerId(
      (previousPlayerId) =>
        resolveActivePlayerId(
          previousPlayerId,
          players
        )
    );
  };

  const addPlayer = (player: Player) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      players: [
        ...previousLeague.players,
        player,
      ],
    }));

    setActivePlayerId(
      (previousPlayerId) =>
        previousPlayerId || player.id
    );
  };

  const deletePlayer = (
    playerId: string
  ) => {
    const remainingPlayers =
      league.players.filter(
        (player) =>
          player.id !== playerId
      );

    setLeague((previousLeague) => ({
      ...previousLeague,
      players:
        previousLeague.players.filter(
          (player) =>
            player.id !== playerId
        ),
    }));

    setPicks((previousPicks) => {
      const nextPicks = {
        ...previousPicks,
      };

      delete nextPicks[playerId];

      return nextPicks;
    });

    setActivePlayerId(
      (previousPlayerId) => {
        if (
          previousPlayerId !== playerId
        ) {
          return previousPlayerId;
        }

        return (
          remainingPlayers[0]?.id ?? ""
        );
      }
    );
  };

  const updateGame = (game: Game) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      games: previousLeague.games.map(
        (currentGame) =>
          currentGame.id === game.id
            ? game
            : currentGame
      ),
    }));
  };

  const setPick = (
    playerId: string,
    gameId: string,
    team: string
  ) => {
    setPicks((previousPicks) => ({
      ...previousPicks,

      [playerId]: {
        ...previousPicks[playerId],
        [gameId]: team,
      },
    }));
  };

  const addFinalizedWeeklyScoringRecord =
    (
      record: FinalizedWeeklyScoringRecord
    ) => {
      setScoringHistory(
        (previousHistory) => {
          if (
            previousHistory[record.id]
          ) {
            return previousHistory;
          }

          return {
            ...previousHistory,
            [record.id]: record,
          };
        }
      );
    };

  const upsertPickerClickerWeekState =
    (
      weekState: PickerClickerWeekState
    ) => {
      setPickerClickerHistory(
        (previousHistory) => {
          if (
            previousHistory[
              weekState.id
            ] === weekState
          ) {
            return previousHistory;
          }

          return {
            ...previousHistory,
            [weekState.id]: weekState,
          };
        }
      );
    };

  const resetLeaguePersistence = () => {
    clearPersistedLeagueState();

    setLeague(initialLeagueState);
    setPicks({});
    setGameResults({});
    setScoringHistory({});
    setPickerClickerHistory({});

    setActivePlayerId(
      resolveActivePlayerId(
        "",
        initialLeagueState.players
      )
    );
  };

  return (
    <LeagueContext.Provider
      value={{
        league,

        setPlayers,
        addPlayer,
        deletePlayer,
        updateGame,

        picks,
        setPick,

        activePlayerId,
        setActivePlayerId,

        gameResults,
        setGameResults,

        scoringHistory,
        addFinalizedWeeklyScoringRecord,

        pickerClickerHistory,
        upsertPickerClickerWeekState,

        resetLeaguePersistence,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context =
    useContext(LeagueContext);

  if (!context) {
    throw new Error(
      "useLeague must be used within LeagueProvider"
    );
  }

  return context;
}