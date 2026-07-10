import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { useLeague } from "./LeagueContext";
import { useNFL } from "./NFLContext";
import {
  applySeasonAwardCoinFlipResolution,
  buildSeasonAwardResults,
  createSeasonAwardCoinFlipResolution,
  getSeasonAwardCoinFlipId,
  SEASON_AWARD_CATEGORIES,
  type SeasonAwardCategory,
  type SeasonAwardCoinFlipHistory,
  type SeasonAwardCoinFlipResolution,
  type SeasonAwardResults,
} from "../engine";

const STORAGE_KEY =
  "head2head-brawlin-steel.season-award-coin-flips.v1";

type SeasonAwardContextValue = {
  season: number;
  results: SeasonAwardResults;
  coinFlipHistory: SeasonAwardCoinFlipHistory;
  recordCoinFlipWinner: (
    category: SeasonAwardCategory,
    winnerPlayerId: string,
  ) => void;
  clearCoinFlipResolution: (
    category: SeasonAwardCategory,
  ) => void;
  getCoinFlipResolution: (
    category: SeasonAwardCategory,
  ) => SeasonAwardCoinFlipResolution | null;
};

const SeasonAwardContext = createContext<
  SeasonAwardContextValue | undefined
>(undefined);

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isSeasonAwardCategory(
  value: unknown,
): value is SeasonAwardCategory {
  return (
    value === "biggest-winner" ||
    value === "biggest-loser" ||
    value === "last-to-lose"
  );
}

function sanitizePlayerIds(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (playerId): playerId is string =>
            typeof playerId === "string",
        )
        .map((playerId) => playerId.trim())
        .filter(Boolean),
    ),
  ).sort();
}

function sanitizeResolution(
  value: unknown,
): SeasonAwardCoinFlipResolution | null {
  if (!isRecord(value)) {
    return null;
  }

  const season =
    typeof value.season === "number" &&
    Number.isInteger(value.season) &&
    value.season > 0
      ? value.season
      : 0;

  const category = isSeasonAwardCategory(
    value.category,
  )
    ? value.category
    : null;

  const winnerPlayerId =
    typeof value.winnerPlayerId === "string"
      ? value.winnerPlayerId.trim()
      : "";

  const eligiblePlayerIds =
    sanitizePlayerIds(
      value.eligiblePlayerIds,
    );

  const resolvedAt =
    typeof value.resolvedAt === "string"
      ? value.resolvedAt
      : "";

  if (
    season <= 0 ||
    !category ||
    !winnerPlayerId ||
    eligiblePlayerIds.length < 2 ||
    !eligiblePlayerIds.includes(
      winnerPlayerId,
    )
  ) {
    return null;
  }

  const expectedId =
    getSeasonAwardCoinFlipId(
      season,
      category,
    );

  return {
    id: expectedId,
    season,
    category,
    winnerPlayerId,
    eligiblePlayerIds,
    resolvedAt,
  };
}

function loadCoinFlipHistory():
  SeasonAwardCoinFlipHistory {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return {};
  }

  try {
    const rawValue =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!rawValue) {
      return {};
    }

    const parsedValue: unknown =
      JSON.parse(rawValue);

    if (!isRecord(parsedValue)) {
      return {};
    }

    return Object.values(
      parsedValue,
    ).reduce<SeasonAwardCoinFlipHistory>(
      (history, resolutionValue) => {
        const resolution =
          sanitizeResolution(
            resolutionValue,
          );

        if (resolution) {
          history[resolution.id] =
            resolution;
        }

        return history;
      },
      {},
    );
  } catch {
    return {};
  }
}

function saveCoinFlipHistory(
  history: SeasonAwardCoinFlipHistory,
): void {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history),
    );
  } catch {
    // The app remains usable when browser
    // storage is unavailable or full.
  }
}

export function SeasonAwardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { league, scoringHistory } =
    useLeague();

  const { season } = useNFL();

  const [
    coinFlipHistory,
    setCoinFlipHistory,
  ] = useState<SeasonAwardCoinFlipHistory>(
    loadCoinFlipHistory,
  );

  const baseResults = useMemo(
    () =>
      buildSeasonAwardResults({
        players: league.players,
        scoringHistory,
        season,
      }),
    [
      league.players,
      scoringHistory,
      season,
    ],
  );

  const results = useMemo(() => {
    return SEASON_AWARD_CATEGORIES.reduce<
      SeasonAwardResults
    >(
      (nextResults, category) => {
        const result =
          baseResults[category];

        const resolutionId =
          getSeasonAwardCoinFlipId(
            season,
            category,
          );

        nextResults[category] =
          applySeasonAwardCoinFlipResolution(
            result,
            coinFlipHistory[
              resolutionId
            ],
          );

        return nextResults;
      },
      {
        "biggest-winner":
          baseResults["biggest-winner"],
        "biggest-loser":
          baseResults["biggest-loser"],
        "last-to-lose":
          baseResults["last-to-lose"],
      },
    );
  }, [
    baseResults,
    coinFlipHistory,
    season,
  ]);

  useEffect(() => {
    saveCoinFlipHistory(
      coinFlipHistory,
    );
  }, [coinFlipHistory]);

  const recordCoinFlipWinner = (
    category: SeasonAwardCategory,
    winnerPlayerId: string,
  ) => {
    const result =
      baseResults[category];

    const resolution =
      createSeasonAwardCoinFlipResolution({
        result,
        winnerPlayerId,
      });

    setCoinFlipHistory(
      (previousHistory) => ({
        ...previousHistory,
        [resolution.id]: resolution,
      }),
    );
  };

  const clearCoinFlipResolution = (
    category: SeasonAwardCategory,
  ) => {
    const resolutionId =
      getSeasonAwardCoinFlipId(
        season,
        category,
      );

    setCoinFlipHistory(
      (previousHistory) => {
        if (
          !previousHistory[
            resolutionId
          ]
        ) {
          return previousHistory;
        }

        const nextHistory = {
          ...previousHistory,
        };

        delete nextHistory[
          resolutionId
        ];

        return nextHistory;
      },
    );
  };

  const getCoinFlipResolution = (
    category: SeasonAwardCategory,
  ) => {
    const resolutionId =
      getSeasonAwardCoinFlipId(
        season,
        category,
      );

    return (
      coinFlipHistory[
        resolutionId
      ] ?? null
    );
  };

  return (
    <SeasonAwardContext.Provider
      value={{
        season,
        results,
        coinFlipHistory,
        recordCoinFlipWinner,
        clearCoinFlipResolution,
        getCoinFlipResolution,
      }}
    >
      {children}
    </SeasonAwardContext.Provider>
  );
}

export function useSeasonAwards() {
  const context =
    useContext(SeasonAwardContext);

  if (!context) {
    throw new Error(
      "useSeasonAwards must be used within SeasonAwardProvider",
    );
  }

  return context;
}
