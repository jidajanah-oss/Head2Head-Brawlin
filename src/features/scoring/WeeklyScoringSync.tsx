import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  applyPickerClickerFallbacks,
  buildEffectiveHeadToHeadPicks,
  buildFinalizedWeeklyScoringRecord,
  createPickerClickerWeekState,
  getPickerClickerAssignmentId,
  getPickerClickerWeekId,
  getPlayerSelectedPickerClickerPickId,
  getWeeklyScoringRecordId,
  inspectNFLWeekCompletion,
  type PickerClickerWeekSelections,
  type PickerClickerWeekState,
} from "../../engine";
import { loadCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
import {
  loadCloudPickerClickerWeekAssignment,
  type CloudPickerClickerWeekAssignment,
} from "../../services/cloudPickerClickerAssignmentService";
import { synchronizeCloudLeagueGames } from "../../services/cloudLeagueGameService";
import {
  loadCloudWeeklyScoringPickIntents,
  loadCloudWeeklyScoringRecords,
  publishCloudWeeklyScoringRecord,
  type CloudWeeklyScoringPickIntent,
} from "../../services/cloudWeeklyScoringService";
import { supabaseClient } from "../../services/supabaseClient";
import type { Player } from "../../types/player";

const CLOUD_SCORING_POLL_INTERVAL_MS = 15_000;

type HeadToHeadPicks = Record<
  string,
  Record<string, string>
>;

function areGameResultsEqual(
  currentResults: Record<string, string>,
  nextResults: Record<string, string>,
): boolean {
  const currentEntries = Object.entries(currentResults);
  const nextEntries = Object.entries(nextResults);

  if (currentEntries.length !== nextEntries.length) {
    return false;
  }

  return nextEntries.every(
    ([gameId, winner]) =>
      currentResults[gameId] === winner,
  );
}

function getLeagueSeason(
  localSeason: unknown,
  linkedSeason: number | undefined,
): number {
  if (
    linkedSeason !== undefined &&
    Number.isInteger(linkedSeason) &&
    linkedSeason > 0
  ) {
    return linkedSeason;
  }

  const parsedSeason = Number.parseInt(
    String(localSeason),
    10,
  );

  return Number.isInteger(parsedSeason) &&
    parsedSeason > 0
    ? parsedSeason
    : new Date().getFullYear();
}

function getValidTimestamp(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    if (
      value &&
      !Number.isNaN(Date.parse(value))
    ) {
      return value;
    }
  }

  return new Date().toISOString();
}

function mapCloudAssignment(
  assignment: CloudPickerClickerWeekAssignment,
) {
  return {
    id: getPickerClickerAssignmentId(
      assignment.season,
      assignment.week,
    ),
    season: assignment.season,
    week: assignment.week,
    sourcePlayerId: assignment.sourcePlayerId,
    sourcePlayerName: assignment.sourcePlayerName,
    sourceNFLTeam: assignment.sourceNFLTeam,
    cycleNumber: assignment.cycleNumber,
    assignedAt: assignment.assignedAt,
  };
}

function buildCloudWeeklyScoringState(params: {
  players: Player[];
  intents: CloudWeeklyScoringPickIntent[];
  assignment: CloudPickerClickerWeekAssignment;
  weekGames: Array<{
    id: string;
    week: number;
    homeTeam: string;
    awayTeam: string;
    kickoff: string;
    final?: boolean;
  }>;
  appliedAt: string;
}): {
  picks: HeadToHeadPicks;
  weekState: PickerClickerWeekState;
} {
  const activePlayers = params.players.filter(
    (player) => player.status === "active",
  );
  const activePlayerIds = new Set(
    activePlayers.map((player) => player.id),
  );
  const gameIds = new Set(
    params.weekGames.map((game) => game.id),
  );
  const picks = activePlayers.reduce<HeadToHeadPicks>(
    (playerPicks, player) => {
      playerPicks[player.id] = {};
      return playerPicks;
    },
    {},
  );
  const playerSelectedPicks: PickerClickerWeekSelections =
    {};

  for (const intent of params.intents) {
    if (
      intent.week !== params.assignment.week ||
      !activePlayerIds.has(intent.playerId) ||
      !gameIds.has(intent.gameId)
    ) {
      continue;
    }

    if (
      intent.source === "picker_clicker" &&
      intent.playerId !==
        params.assignment.sourcePlayerId &&
      intent.pickerClickerSourcePlayerId ===
        params.assignment.sourcePlayerId
    ) {
      const playerSelections =
        playerSelectedPicks[intent.playerId] ?? {};
      const selectedAt = getValidTimestamp(
        intent.submittedAt,
        intent.updatedAt,
      );

      playerSelectedPicks[intent.playerId] = {
        ...playerSelections,
        [intent.gameId]: {
          id: getPlayerSelectedPickerClickerPickId(
            params.assignment.season,
            params.assignment.week,
            intent.playerId,
            intent.gameId,
          ),
          season: params.assignment.season,
          week: params.assignment.week,
          gameId: intent.gameId,
          playerId: intent.playerId,
          selectedAt,
        },
      };
      continue;
    }

    if (intent.selectedTeam) {
      picks[intent.playerId] = {
        ...picks[intent.playerId],
        [intent.gameId]: intent.selectedTeam,
      };
    }
  }

  const initialWeekState = createPickerClickerWeekState(
    mapCloudAssignment(params.assignment),
  );
  const selectedWeekState: PickerClickerWeekState = {
    ...initialWeekState,
    playerSelectedPicks,
    updatedAt: params.appliedAt,
  };
  const weekState = applyPickerClickerFallbacks({
    players: activePlayers,
    picks,
    games: params.weekGames,
    weekState: selectedWeekState,
    appliedAt: params.appliedAt,
  });

  return {
    picks,
    weekState,
  };
}

function WeeklyScoringSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();
  const {
    league,
    picks,
    gameResults,
    setGameResults,
    scoringHistory,
    addFinalizedWeeklyScoringRecord,
    pickerClickerHistory,
    upsertPickerClickerWeekState,
  } = useLeague();
  const {
    season,
    week,
    snapshot,
  } = useNFL();
  const [
    hydratedCloudKey,
    setHydratedCloudKey,
  ] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] =
    useState(0);
  const latestStateRef = useRef({
    addFinalizedWeeklyScoringRecord,
    upsertPickerClickerWeekState,
  });
  const cloudRecordIdsRef = useRef<Set<string>>(
    new Set(),
  );
  const publishingRecordIdsRef = useRef<Set<string>>(
    new Set(),
  );
  const retryTimerRef = useRef<number | null>(null);

  latestStateRef.current = {
    addFinalizedWeeklyScoringRecord,
    upsertPickerClickerWeekState,
  };

  const linkedSeason = useMemo(
    () =>
      getLeagueSeason(
        league.settings.season,
        accountLink?.season,
      ),
    [accountLink?.season, league.settings.season],
  );

  const cloudKey = useMemo(() => {
    if (
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked
    ) {
      return null;
    }

    return [
      accountLink.userId,
      accountLink.leagueId,
      linkedSeason,
    ].join(":");
  }, [
    access.isLinked,
    accountLink,
    linkedSeason,
    status,
  ]);

  useEffect(() => {
    cloudRecordIdsRef.current = new Set();
    publishingRecordIdsRef.current.clear();
    setHydratedCloudKey(null);
  }, [cloudKey]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      !cloudKey ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked
    ) {
      return;
    }

    let canceled = false;
    let running = false;
    let intervalId: number | null = null;

    const hydrateCloudScoring = async () => {
      if (running || canceled) {
        return;
      }

      running = true;

      try {
        const cloudRecords =
          await loadCloudWeeklyScoringRecords(
            client,
            accountLink.leagueId,
            linkedSeason,
          );

        if (canceled) {
          return;
        }

        cloudRecordIdsRef.current = new Set(
          cloudRecords.map(
            (cloudRecord) =>
              cloudRecord.record.id,
          ),
        );

        for (const cloudRecord of cloudRecords) {
          latestStateRef.current.addFinalizedWeeklyScoringRecord(
            cloudRecord.record,
          );
        }

        setHydratedCloudKey(cloudKey);
      } catch (error) {
        if (!canceled) {
          console.error(
            "Cloud weekly scoring hydration failed.",
            error,
          );
        }
      } finally {
        running = false;
      }
    };

    void hydrateCloudScoring();

    intervalId = window.setInterval(() => {
      void hydrateCloudScoring();
    }, CLOUD_SCORING_POLL_INTERVAL_MS);

    return () => {
      canceled = true;

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    access.isLinked,
    accountLink,
    cloudKey,
    linkedSeason,
    status,
  ]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (
      snapshot.season !== season ||
      snapshot.week !== week ||
      week !== league.currentWeek
    ) {
      return;
    }

    const completion = inspectNFLWeekCompletion(
      snapshot.nflGames,
      season,
      week,
    );
    const mergedGameResults = {
      ...gameResults,
      ...completion.gameResults,
    };

    if (
      !areGameResultsEqual(
        gameResults,
        mergedGameResults,
      )
    ) {
      setGameResults(mergedGameResults);
    }

    if (!completion.isComplete) {
      return;
    }

    const scoringRecordId =
      getWeeklyScoringRecordId(season, week);

    if (!cloudKey) {
      if (scoringHistory[scoringRecordId]) {
        return;
      }

      const pickerClickerWeekId =
        getPickerClickerWeekId(season, week);
      const pickerClickerWeekState =
        pickerClickerHistory[pickerClickerWeekId];

      if (!pickerClickerWeekState) {
        return;
      }

      const processedLockedGameIds = new Set(
        pickerClickerWeekState.lockedGameIds,
      );
      const completedGamesProcessed =
        completion.completedGameIds.every((gameId) =>
          processedLockedGameIds.has(gameId),
        );

      if (!completedGamesProcessed) {
        return;
      }

      const effectivePicks =
        buildEffectiveHeadToHeadPicks({
          picks,
          pickerClickerHistory,
          season,
          throughWeek: week,
        });
      const scoringRecord =
        buildFinalizedWeeklyScoringRecord({
          players: league.players,
          picks: effectivePicks,
          nflGames: snapshot.nflGames,
          season,
          week,
          pickerClickerWeekState,
        });

      if (!scoringRecord) {
        return;
      }

      addFinalizedWeeklyScoringRecord(scoringRecord);
      return;
    }

    if (
      hydratedCloudKey !== cloudKey ||
      cloudRecordIdsRef.current.has(
        scoringRecordId,
      ) ||
      !access.canManageLeague ||
      !accountLink ||
      linkedSeason !== season ||
      publishingRecordIdsRef.current.has(
        scoringRecordId,
      )
    ) {
      return;
    }

    const client = supabaseClient;

    if (!client) {
      return;
    }

    publishingRecordIdsRef.current.add(
      scoringRecordId,
    );

    void (async () => {
      try {
        await synchronizeCloudLeagueGames(
          client,
          accountLink.leagueId,
          snapshot.nflGames,
        );

        const [
          cloudPlayers,
          cloudAssignment,
          cloudPickIntents,
        ] = await Promise.all([
          loadCloudLeagueRoster(
            client,
            accountLink.leagueId,
          ),
          loadCloudPickerClickerWeekAssignment(
            client,
            accountLink.leagueId,
            season,
            week,
          ),
          loadCloudWeeklyScoringPickIntents(
            client,
            accountLink.leagueId,
            week,
          ),
        ]);

        if (!cloudAssignment) {
          throw new Error(
            "The cloud Picker Clicker assignment is not ready for this week.",
          );
        }

        const cloudScoringState =
          buildCloudWeeklyScoringState({
            players: cloudPlayers,
            intents: cloudPickIntents,
            assignment: cloudAssignment,
            weekGames: snapshot.weekGames,
            appliedAt: getValidTimestamp(
              snapshot.syncedAt,
            ),
          });
        const cloudPickerClickerHistory = {
          [cloudScoringState.weekState.id]:
            cloudScoringState.weekState,
        };
        const effectiveCloudPicks =
          buildEffectiveHeadToHeadPicks({
            picks: cloudScoringState.picks,
            pickerClickerHistory:
              cloudPickerClickerHistory,
            season,
            throughWeek: week,
          });
        const scoringRecord =
          buildFinalizedWeeklyScoringRecord({
            players: cloudPlayers,
            picks: effectiveCloudPicks,
            nflGames: snapshot.nflGames,
            season,
            week,
            pickerClickerWeekState:
              cloudScoringState.weekState,
          });

        if (!scoringRecord) {
          throw new Error(
            "The completed NFL week did not produce a scoring record.",
          );
        }

        const publishedRecord =
          await publishCloudWeeklyScoringRecord(
            client,
            accountLink.leagueId,
            scoringRecord,
          );

        cloudRecordIdsRef.current.add(
          publishedRecord.record.id,
        );
        latestStateRef.current.upsertPickerClickerWeekState(
          cloudScoringState.weekState,
        );
        latestStateRef.current.addFinalizedWeeklyScoringRecord(
          publishedRecord.record,
        );
      } catch (error) {
        console.error(
          "Cloud weekly scoring publication failed.",
          error,
        );

        if (retryTimerRef.current === null) {
          retryTimerRef.current = window.setTimeout(
            () => {
              retryTimerRef.current = null;
              setRetryVersion(
                (currentVersion) =>
                  currentVersion + 1,
              );
            },
            CLOUD_SCORING_POLL_INTERVAL_MS,
          );
        }
      } finally {
        publishingRecordIdsRef.current.delete(
          scoringRecordId,
        );
      }
    })();
  }, [
    access.canManageLeague,
    accountLink,
    addFinalizedWeeklyScoringRecord,
    cloudKey,
    gameResults,
    hydratedCloudKey,
    league.currentWeek,
    league.players,
    linkedSeason,
    pickerClickerHistory,
    picks,
    retryVersion,
    scoringHistory,
    season,
    setGameResults,
    snapshot,
    week,
  ]);

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    },
    [],
  );

  return null;
}

export default WeeklyScoringSync;
