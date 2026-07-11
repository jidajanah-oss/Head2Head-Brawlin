import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useSeasonCloseout } from "./SeasonCloseoutContext";
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
  ObscureStatCoinFlipHistory,
  ObscureStatCoinFlipResolution,
} from "../engine/obscureStatCoinFlipTypes";
import {
  getPayoutLedgerSeasonId,
  initializePayoutLedgerSeason as createPayoutLedgerSeason,
  removePayoutLedgerEntry as removeLedgerEntry,
  setPayoutLedgerEntryReviewStatus as updateLedgerEntryReviewStatus,
  setPayoutLedgerEntryStatus as updateLedgerEntryStatus,
  synchronizePayoutLedgerRosterAndBuyIns,
  upsertPayoutLedgerEntry as upsertLedgerEntry,
} from "../engine/payoutLedgerEngine";
import type {
  PayoutLedgerEntry,
  PayoutLedgerEntryStatus,
  PayoutLedgerHistory,
} from "../engine/payoutLedgerTypes";
import {
  clearPlayoffMatchupResult as clearStoredPlayoffMatchupResult,
  getPlayoffSeasonId,
  initializePlayoffSeason as createPlayoffSeason,
  recordPlayoffMatchupResult as recordStoredPlayoffMatchupResult,
} from "../engine/playoffResultsEngine";
import type {
  PlayoffResultsHistory,
  RecordPlayoffMatchupResultInput,
} from "../engine/playoffResultsTypes";
import type { NFLPlayoffPicture } from "../engine/h2hEngine";
import type {
  PickerClickerHistory,
  PickerClickerWeekState,
} from "../engine/pickerClickerTypes";
import {
  clampRegularSeasonWeek,
  getNextRegularSeasonWeek,
  getPreviousRegularSeasonWeek,
} from "../engine/weekControlEngine";
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

  // CURRENT NFL WEEK
  setCurrentWeek: (week: number) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;

  // MULTIPLAYER PICKS
  picks: Picks;
  setPick: (
    playerId: string,
    gameId: string,
    team: string,
  ) => void;

  // ACTIVE PLAYER SYSTEM
  activePlayerId: string;
  setActivePlayerId: (id: string) => void;

  // NFL GAME RESULTS
  gameResults: GameResults;
  setGameResults: (results: GameResults) => void;

  // FINALIZED WEEKLY SCORING
  scoringHistory: WeeklyScoringHistory;
  addFinalizedWeeklyScoringRecord: (
    record: FinalizedWeeklyScoringRecord,
  ) => void;

  // PICKER CLICKER
  pickerClickerHistory: PickerClickerHistory;
  upsertPickerClickerWeekState: (
    weekState: PickerClickerWeekState,
  ) => void;

  // OBSCURE STAT OFFLINE COIN FLIP
  obscureStatCoinFlipHistory:
    ObscureStatCoinFlipHistory;
  upsertObscureStatCoinFlipResolution: (
    resolution: ObscureStatCoinFlipResolution,
  ) => void;
  clearObscureStatCoinFlipResolution: (
    resolutionId: string,
  ) => void;

  // COMMISSIONER PAYOUT LEDGER
  payoutLedgerHistory: PayoutLedgerHistory;
  initializePayoutLedgerSeason: (
    season: number,
  ) => void;
  synchronizePayoutLedgerSeason: (
    season: number,
  ) => void;
  upsertPayoutLedgerEntry: (
    season: number,
    entry: PayoutLedgerEntry,
  ) => void;
  removePayoutLedgerEntry: (
    season: number,
    entryId: string,
  ) => void;
  setPayoutLedgerEntryStatus: (
    season: number,
    entryId: string,
    status: PayoutLedgerEntryStatus,
  ) => void;
  setPayoutLedgerEntryReviewStatus: (
    season: number,
    entryId: string,
    needsReview: boolean,
  ) => void;

  // PLAYOFF RESULTS
  playoffResultsHistory: PlayoffResultsHistory;
  initializePlayoffSeason: (
    season: number,
    playoffPicture: NFLPlayoffPicture,
  ) => void;
  resetPlayoffSeason: (
    season: number,
    playoffPicture: NFLPlayoffPicture,
  ) => void;
  recordPlayoffMatchupResult: (
    season: number,
    input: RecordPlayoffMatchupResultInput,
  ) => void;
  clearPlayoffMatchupResult: (
    season: number,
    matchupId: string,
  ) => void;

  // PERSISTENCE
  resetLeaguePersistence: () => void;
};

const LeagueContext = createContext<
  LeagueContextType | undefined
>(undefined);

function resolveActivePlayerId(
  activePlayerId: string,
  players: Player[],
) {
  if (
    activePlayerId &&
    players.some(
      (player) =>
        player.id === activePlayerId,
    )
  ) {
    return activePlayerId;
  }

  return players[0]?.id ?? "";
}

function removePicksForMissingPlayers(
  picks: Picks,
  players: Player[],
) {
  const validPlayerIds = new Set(
    players.map((player) => player.id),
  );

  return Object.entries(picks).reduce<
    Picks
  >(
    (
      cleanedPicks,
      [playerId, playerPicks],
    ) => {
      if (validPlayerIds.has(playerId)) {
        cleanedPicks[playerId] = playerPicks;
      }

      return cleanedPicks;
    },
    {},
  );
}

function normalizeLeagueWeek(
  league: LeagueState,
): LeagueState {
  return {
    ...league,
    currentWeek: clampRegularSeasonWeek(
      league.currentWeek,
    ),
  };
}


function getLeagueSeasonNumber(
  league: LeagueState,
): number {
  const seasonValue = Number.parseInt(
    String(league.settings.season),
    10,
  );

  return Number.isInteger(seasonValue) &&
    seasonValue > 0
    ? seasonValue
    : new Date().getFullYear();
}

export function LeagueProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    isSeasonClosed,
    isAreaLocked,
  } = useSeasonCloseout();

  const [persistedStartState] = useState(() =>
    loadPersistedLeagueState(
      initialLeagueState,
    ),
  );

  const [league, setLeague] = useState(() =>
    normalizeLeagueWeek(
      persistedStartState.league,
    ),
  );

  const [picks, setPicks] = useState(() =>
    removePicksForMissingPlayers(
      persistedStartState.picks,
      persistedStartState.league.players,
    ),
  );

  const [
    activePlayerId,
    setActivePlayerId,
  ] = useState(() =>
    resolveActivePlayerId(
      persistedStartState.activePlayerId,
      persistedStartState.league.players,
    ),
  );

  const [gameResults, setGameResults] =
    useState(
      persistedStartState.gameResults,
    );

  const [scoringHistory, setScoringHistory] =
    useState(
      persistedStartState.scoringHistory,
    );

  const [
    pickerClickerHistory,
    setPickerClickerHistory,
  ] = useState(
    persistedStartState.pickerClickerHistory,
  );

  const [
    obscureStatCoinFlipHistory,
    setObscureStatCoinFlipHistory,
  ] = useState(
    persistedStartState
      .obscureStatCoinFlipHistory,
  );

  const [
    payoutLedgerHistory,
    setPayoutLedgerHistory,
  ] = useState(
    persistedStartState.payoutLedgerHistory,
  );

  const [
    playoffResultsHistory,
    setPlayoffResultsHistory,
  ] = useState(
    persistedStartState.playoffResultsHistory,
  );

  useEffect(() => {
    savePersistedLeagueState({
      league,
      picks,
      activePlayerId,
      gameResults,
      scoringHistory,
      pickerClickerHistory,
      obscureStatCoinFlipHistory,
      payoutLedgerHistory,
      playoffResultsHistory,
    });
  }, [
    league,
    picks,
    activePlayerId,
    gameResults,
    scoringHistory,
    pickerClickerHistory,
    obscureStatCoinFlipHistory,
    payoutLedgerHistory,
    playoffResultsHistory,
  ]);

  const setPlayers = (
    players: Player[],
  ) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      players,
    }));

    setPicks((previousPicks) =>
      removePicksForMissingPlayers(
        previousPicks,
        players,
      ),
    );

    setActivePlayerId(
      (previousPlayerId) =>
        resolveActivePlayerId(
          previousPlayerId,
          players,
        ),
    );
  };

  const addPlayer = (
    player: Player,
  ) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      players: [
        ...previousLeague.players,
        player,
      ],
    }));

    setActivePlayerId(
      (previousPlayerId) =>
        previousPlayerId || player.id,
    );
  };

  const deletePlayer = (
    playerId: string,
  ) => {
    const remainingPlayers =
      league.players.filter(
        (player) =>
          player.id !== playerId,
      );

    setLeague((previousLeague) => ({
      ...previousLeague,
      players:
        previousLeague.players.filter(
          (player) =>
            player.id !== playerId,
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

        return remainingPlayers[0]?.id ?? "";
      },
    );
  };

  const updateGame = (
    game: Game,
  ) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      games: previousLeague.games.map(
        (currentGame) =>
          currentGame.id === game.id
            ? game
            : currentGame,
      ),
    }));
  };

  const setCurrentWeek = (
    week: number,
  ) => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      currentWeek:
        clampRegularSeasonWeek(week),
    }));
  };

  const goToPreviousWeek = () => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      currentWeek:
        getPreviousRegularSeasonWeek(
          previousLeague.currentWeek,
        ),
    }));
  };

  const goToNextWeek = () => {
    setLeague((previousLeague) => ({
      ...previousLeague,
      currentWeek:
        getNextRegularSeasonWeek(
          previousLeague.currentWeek,
        ),
    }));
  };

  const setPick = (
    playerId: string,
    gameId: string,
    team: string,
  ) => {
    setPicks((previousPicks) => ({
      ...previousPicks,
      [playerId]: {
        ...previousPicks[playerId],
        [gameId]: team,
      },
    }));
  };

  const addFinalizedWeeklyScoringRecord = (
    record: FinalizedWeeklyScoringRecord,
  ) => {
    if (
      isAreaLocked(
        record.season,
        "scoring",
      )
    ) {
      return;
    }

    setScoringHistory(
      (previousHistory) => {
        if (previousHistory[record.id]) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [record.id]: record,
        };
      },
    );
  };

  const upsertPickerClickerWeekState = (
    weekState: PickerClickerWeekState,
  ) => {
    if (
      isAreaLocked(
        weekState.season,
        "scoring",
      )
    ) {
      return;
    }

    setPickerClickerHistory(
      (previousHistory) => {
        if (
          previousHistory[weekState.id] ===
          weekState
        ) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [weekState.id]: weekState,
        };
      },
    );
  };

  const upsertObscureStatCoinFlipResolution = (
    resolution: ObscureStatCoinFlipResolution,
  ) => {
    if (
      isAreaLocked(
        resolution.season,
        "scoring",
      )
    ) {
      return;
    }

    setObscureStatCoinFlipHistory(
      (previousHistory) => ({
        ...previousHistory,
        [resolution.id]: resolution,
      }),
    );
  };

  const clearObscureStatCoinFlipResolution = (
    resolutionId: string,
  ) => {
    const normalizedResolutionId =
      resolutionId.trim();

    if (!normalizedResolutionId) {
      return;
    }

    const existingResolution =
      obscureStatCoinFlipHistory[
        normalizedResolutionId
      ];

    if (
      existingResolution &&
      isAreaLocked(
        existingResolution.season,
        "scoring",
      )
    ) {
      return;
    }

    setObscureStatCoinFlipHistory(
      (previousHistory) => {
        if (
          !previousHistory[
            normalizedResolutionId
          ]
        ) {
          return previousHistory;
        }

        const nextHistory = {
          ...previousHistory,
        };

        delete nextHistory[
          normalizedResolutionId
        ];

        return nextHistory;
      },
    );
  };

  const initializePayoutLedgerSeason = (
    season: number,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        if (previousHistory[ledgerId]) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: createPayoutLedgerSeason(
            season,
            league.players,
          ),
        };
      },
    );
  };

  const synchronizePayoutLedgerSeason = (
    season: number,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        const existingLedger =
          previousHistory[ledgerId];

        const nextLedger = existingLedger
          ? synchronizePayoutLedgerRosterAndBuyIns(
              existingLedger,
              league.players,
            )
          : createPayoutLedgerSeason(
              season,
              league.players,
            );

        if (nextLedger === existingLedger) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: nextLedger,
        };
      },
    );
  };

  const upsertPayoutLedgerEntry = (
    season: number,
    entry: PayoutLedgerEntry,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        const existingLedger =
          previousHistory[ledgerId];

        if (!existingLedger) {
          return previousHistory;
        }

        const nextLedger = upsertLedgerEntry(
          existingLedger,
          entry,
        );

        if (nextLedger === existingLedger) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: nextLedger,
        };
      },
    );
  };

  const removePayoutLedgerEntry = (
    season: number,
    entryId: string,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        const existingLedger =
          previousHistory[ledgerId];

        if (!existingLedger) {
          return previousHistory;
        }

        const nextLedger = removeLedgerEntry(
          existingLedger,
          entryId,
        );

        if (nextLedger === existingLedger) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: nextLedger,
        };
      },
    );
  };

  const setPayoutLedgerEntryStatus = (
    season: number,
    entryId: string,
    status: PayoutLedgerEntryStatus,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        const existingLedger =
          previousHistory[ledgerId];

        if (!existingLedger) {
          return previousHistory;
        }

        const nextLedger =
          updateLedgerEntryStatus(
            existingLedger,
            entryId,
            status,
          );

        if (nextLedger === existingLedger) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: nextLedger,
        };
      },
    );
  };

  const setPayoutLedgerEntryReviewStatus = (
    season: number,
    entryId: string,
    needsReview: boolean,
  ) => {
    if (
      isAreaLocked(
        season,
        "payout-ledger",
      )
    ) {
      return;
    }

    const ledgerId =
      getPayoutLedgerSeasonId(season);

    setPayoutLedgerHistory(
      (previousHistory) => {
        const existingLedger =
          previousHistory[ledgerId];

        if (!existingLedger) {
          return previousHistory;
        }

        const nextLedger =
          updateLedgerEntryReviewStatus(
            existingLedger,
            entryId,
            needsReview,
          );

        if (nextLedger === existingLedger) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [ledgerId]: nextLedger,
        };
      },
    );
  };

  const initializePlayoffSeason = (
    season: number,
    playoffPicture: NFLPlayoffPicture,
  ) => {
    if (
      isAreaLocked(
        season,
        "playoffs",
      )
    ) {
      return;
    }

    const seasonId = getPlayoffSeasonId(
      season,
    );

    setPlayoffResultsHistory(
      (previousHistory) => {
        if (previousHistory[seasonId]) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [seasonId]: createPlayoffSeason(
            season,
            playoffPicture,
          ),
        };
      },
    );
  };

  const resetPlayoffSeason = (
    season: number,
    playoffPicture: NFLPlayoffPicture,
  ) => {
    if (
      isAreaLocked(
        season,
        "playoffs",
      )
    ) {
      return;
    }

    const seasonId = getPlayoffSeasonId(
      season,
    );

    setPlayoffResultsHistory(
      (previousHistory) => ({
        ...previousHistory,
        [seasonId]: createPlayoffSeason(
          season,
          playoffPicture,
        ),
      }),
    );
  };

  const recordPlayoffMatchupResult = (
    season: number,
    input: RecordPlayoffMatchupResultInput,
  ) => {
    if (
      isAreaLocked(
        season,
        "playoffs",
      )
    ) {
      return;
    }

    const seasonId = getPlayoffSeasonId(
      season,
    );

    setPlayoffResultsHistory(
      (previousHistory) => {
        const existingSeason =
          previousHistory[seasonId];

        if (!existingSeason) {
          return previousHistory;
        }

        const nextSeason =
          recordStoredPlayoffMatchupResult(
            existingSeason,
            input,
          );

        return {
          ...previousHistory,
          [seasonId]: nextSeason,
        };
      },
    );
  };

  const clearPlayoffMatchupResult = (
    season: number,
    matchupId: string,
  ) => {
    if (
      isAreaLocked(
        season,
        "playoffs",
      )
    ) {
      return;
    }

    const seasonId = getPlayoffSeasonId(
      season,
    );

    setPlayoffResultsHistory(
      (previousHistory) => {
        const existingSeason =
          previousHistory[seasonId];

        if (!existingSeason) {
          return previousHistory;
        }

        const nextSeason =
          clearStoredPlayoffMatchupResult(
            existingSeason,
            matchupId,
          );

        if (nextSeason === existingSeason) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [seasonId]: nextSeason,
        };
      },
    );
  };

  const resetLeaguePersistence = () => {
    const season =
      getLeagueSeasonNumber(league);

    if (isSeasonClosed(season)) {
      return;
    }

    clearPersistedLeagueState();

    setLeague(
      normalizeLeagueWeek(
        initialLeagueState,
      ),
    );
    setPicks({});
    setGameResults({});
    setScoringHistory({});
    setPickerClickerHistory({});
    setObscureStatCoinFlipHistory({});
    setPayoutLedgerHistory({});
    setPlayoffResultsHistory({});
    setActivePlayerId(
      resolveActivePlayerId(
        "",
        initialLeagueState.players,
      ),
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
        setCurrentWeek,
        goToPreviousWeek,
        goToNextWeek,
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
        obscureStatCoinFlipHistory,
        upsertObscureStatCoinFlipResolution,
        clearObscureStatCoinFlipResolution,
        payoutLedgerHistory,
        initializePayoutLedgerSeason,
        synchronizePayoutLedgerSeason,
        upsertPayoutLedgerEntry,
        removePayoutLedgerEntry,
        setPayoutLedgerEntryStatus,
        setPayoutLedgerEntryReviewStatus,
        playoffResultsHistory,
        initializePlayoffSeason,
        resetPlayoffSeason,
        recordPlayoffMatchupResult,
        clearPlayoffMatchupResult,
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
    throw new Error(
      "useLeague must be used within LeagueProvider",
    );
  }

  return context;
}
