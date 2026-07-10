import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  buildObscureStatAwardResult,
  getObscureStatRule,
  NFLGameStatsProviderFactory,
} from "../engine";
import type {
  ObscureStatAwardResult,
  ObscureStatGameStatsById,
  ObscureStatRule,
} from "../engine";
import { useLeague } from "./LeagueContext";
import { useNFL } from "./NFLContext";

type ObscureStatContextValue = {
  rule: ObscureStatRule;
  result: ObscureStatAwardResult;

  gameStatsById:
    ObscureStatGameStatsById;

  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
};

const ObscureStatContext =
  createContext<
    ObscureStatContextValue | undefined
  >(undefined);

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to load NFL game statistics.";
}

export function ObscureStatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    league,
    scoringHistory,
  } = useLeague();

  const {
    season,
    week,
    snapshot,
  } = useNFL();

  const [gameStatsById, setGameStatsById] =
    useState<ObscureStatGameStatsById>(
      {},
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const gameStatsRef =
    useRef<ObscureStatGameStatsById>(
      {},
    );

  const activeWeekKeyRef =
    useRef(
      `${season}:${league.currentWeek}`,
    );

  const rule = useMemo(
    () =>
      getObscureStatRule(
        league.currentWeek,
      ),
    [league.currentWeek],
  );

  useEffect(() => {
    const nextWeekKey =
      `${season}:${league.currentWeek}`;

    activeWeekKeyRef.current =
      nextWeekKey;

    gameStatsRef.current = {};
    setGameStatsById({});
    setError(null);
    setLoading(false);
  }, [
    season,
    league.currentWeek,
  ]);

  const refresh =
    useCallback(async () => {
      const requestWeekKey =
        `${season}:${league.currentWeek}`;

      if (
        rule.status !== "active" ||
        !snapshot ||
        snapshot.season !== season ||
        snapshot.week !== week ||
        week !== league.currentWeek
      ) {
        return;
      }

      const completedGames =
        snapshot.nflGames.filter(
          (game) =>
            game.season === season &&
            game.week === week &&
            game.status === "final",
        );

      const missingCompletedGames =
        completedGames.filter(
          (game) =>
            !gameStatsRef.current[
              game.id
            ],
        );

      if (
        missingCompletedGames.length ===
        0
      ) {
        return;
      }

      setLoading(true);
      setError(null);

      const provider =
        NFLGameStatsProviderFactory.getProvider();

      try {
        const loadResults =
          await Promise.allSettled(
            missingCompletedGames.map(
              async (game) => ({
                gameId: game.id,
                snapshot:
                  await provider.getGameStatsById(
                    game.id,
                  ),
              }),
            ),
          );

        if (
          activeWeekKeyRef.current !==
          requestWeekKey
        ) {
          return;
        }

        const nextGameStats = {
          ...gameStatsRef.current,
        };

        const loadErrors: string[] = [];

        loadResults.forEach(
          (loadResult, index) => {
            const game =
              missingCompletedGames[
                index
              ];

            if (
              loadResult.status ===
              "rejected"
            ) {
              loadErrors.push(
                `${game.id}: ${getErrorMessage(
                  loadResult.reason,
                )}`,
              );

              return;
            }

            if (
              !loadResult.value.snapshot
            ) {
              loadErrors.push(
                `${game.id}: NFL game statistics were unavailable.`,
              );

              return;
            }

            nextGameStats[
              loadResult.value.gameId
            ] =
              loadResult.value.snapshot;
          },
        );

        gameStatsRef.current =
          nextGameStats;

        setGameStatsById(
          nextGameStats,
        );

        if (loadErrors.length > 0) {
          setError(
            loadErrors.join(" "),
          );
        }
      } finally {
        if (
          activeWeekKeyRef.current ===
          requestWeekKey
        ) {
          setLoading(false);
        }
      }
    }, [
      league.currentWeek,
      rule.status,
      season,
      snapshot,
      week,
    ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const matchingSnapshot =
    snapshot &&
    snapshot.season === season &&
    snapshot.week === week &&
    week === league.currentWeek
      ? snapshot
      : null;

  const result = useMemo(
    () =>
      buildObscureStatAwardResult({
        players: league.players,
        nflGames:
          matchingSnapshot
            ?.nflGames ?? [],
        gameStatsById,
        scoringHistory,
        season,
        week: league.currentWeek,
      }),
    [
      league.players,
      league.currentWeek,
      matchingSnapshot,
      gameStatsById,
      scoringHistory,
      season,
    ],
  );

  const value = useMemo(
    () => ({
      rule,
      result,
      gameStatsById,
      loading,
      error,
      refresh,
    }),
    [
      rule,
      result,
      gameStatsById,
      loading,
      error,
      refresh,
    ],
  );

  return (
    <ObscureStatContext.Provider
      value={value}
    >
      {children}
    </ObscureStatContext.Provider>
  );
}

export function useObscureStat() {
  const context = useContext(
    ObscureStatContext,
  );

  if (!context) {
    throw new Error(
      "useObscureStat must be used inside ObscureStatProvider",
    );
  }

  return context;
}