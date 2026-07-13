import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import {
  createPickerClickerWeekState,
  ensurePickerClickerWeekState,
} from "../../engine/pickerClickerEngine";
import {
  getPickerClickerAssignmentId,
  getPickerClickerWeekId,
} from "../../engine/pickerClickerTypes";
import type {
  PickerClickerAssignment,
  PickerClickerHistory,
  PickerClickerWeekSelections,
  PickerClickerWeekState,
} from "../../engine/pickerClickerTypes";
import { loadCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
import {
  createCloudPickerClickerWeekAssignment,
  loadCloudPickerClickerWeekAssignments,
} from "../../services/cloudPickerClickerAssignmentService";
import type { CloudPickerClickerWeekAssignment } from "../../services/cloudPickerClickerAssignmentService";
import { supabaseClient } from "../../services/supabaseClient";
import type { Player } from "../../types/player";

const MISSING_ASSIGNMENT_RETRY_DELAY_MS = 15_000;

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

  return Number.isInteger(parsedSeason) && parsedSeason > 0
    ? parsedSeason
    : new Date().getFullYear();
}

function mapCloudAssignment(
  cloudAssignment: CloudPickerClickerWeekAssignment,
): PickerClickerAssignment {
  return {
    id: getPickerClickerAssignmentId(
      cloudAssignment.season,
      cloudAssignment.week,
    ),
    season: cloudAssignment.season,
    week: cloudAssignment.week,
    sourcePlayerId: cloudAssignment.sourcePlayerId,
    sourcePlayerName: cloudAssignment.sourcePlayerName,
    sourceNFLTeam: cloudAssignment.sourceNFLTeam,
    cycleNumber: cloudAssignment.cycleNumber,
    assignedAt: cloudAssignment.assignedAt,
  };
}

function assignmentsMatch(
  left: PickerClickerAssignment,
  right: PickerClickerAssignment,
): boolean {
  return (
    left.id === right.id &&
    left.season === right.season &&
    left.week === right.week &&
    left.sourcePlayerId === right.sourcePlayerId &&
    left.sourcePlayerName === right.sourcePlayerName &&
    left.sourceNFLTeam === right.sourceNFLTeam &&
    left.cycleNumber === right.cycleNumber &&
    left.assignedAt === right.assignedAt
  );
}

function getLatestTimestamp(
  leftTimestamp: string,
  rightTimestamp: string,
): string {
  const leftTime = Date.parse(leftTimestamp);
  const rightTime = Date.parse(rightTimestamp);

  if (Number.isNaN(leftTime)) {
    return rightTimestamp;
  }

  if (Number.isNaN(rightTime)) {
    return leftTimestamp;
  }

  return leftTime >= rightTime
    ? leftTimestamp
    : rightTimestamp;
}

function removeSourcePlayerSelections(
  selections: PickerClickerWeekSelections | undefined,
  sourcePlayerId: string,
): PickerClickerWeekSelections | undefined {
  if (!selections?.[sourcePlayerId]) {
    return selections;
  }

  const nextSelections = {
    ...selections,
  };
  delete nextSelections[sourcePlayerId];

  return nextSelections;
}

function reconcileCloudWeekState(
  existingWeekState: PickerClickerWeekState | undefined,
  cloudAssignment: CloudPickerClickerWeekAssignment,
): PickerClickerWeekState {
  const assignment = mapCloudAssignment(cloudAssignment);

  if (!existingWeekState) {
    return createPickerClickerWeekState(assignment);
  }

  const nextPlayerSelectedPicks =
    removeSourcePlayerSelections(
      existingWeekState.playerSelectedPicks,
      assignment.sourcePlayerId,
    );
  const sourceChanged =
    existingWeekState.assignment.sourcePlayerId !==
    assignment.sourcePlayerId;

  if (
    assignmentsMatch(
      existingWeekState.assignment,
      assignment,
    ) &&
    nextPlayerSelectedPicks ===
      existingWeekState.playerSelectedPicks
  ) {
    return existingWeekState;
  }

  return {
    ...existingWeekState,
    id: getPickerClickerWeekId(
      assignment.season,
      assignment.week,
    ),
    season: assignment.season,
    week: assignment.week,
    assignment,
    fallbackPicks: sourceChanged
      ? {}
      : existingWeekState.fallbackPicks,
    playerSelectedPicks: nextPlayerSelectedPicks,
    updatedAt: getLatestTimestamp(
      existingWeekState.updatedAt,
      assignment.assignedAt,
    ),
  };
}

function hydrateCloudAssignments(
  history: PickerClickerHistory,
  cloudAssignments: CloudPickerClickerWeekAssignment[],
): {
  history: PickerClickerHistory;
  changedWeekStates: PickerClickerWeekState[];
} {
  let nextHistory = history;
  const changedWeekStates: PickerClickerWeekState[] = [];

  for (const cloudAssignment of cloudAssignments) {
    const weekId = getPickerClickerWeekId(
      cloudAssignment.season,
      cloudAssignment.week,
    );
    const existingWeekState = nextHistory[weekId];
    const reconciledWeekState = reconcileCloudWeekState(
      existingWeekState,
      cloudAssignment,
    );

    if (reconciledWeekState === existingWeekState) {
      continue;
    }

    nextHistory = {
      ...nextHistory,
      [weekId]: reconciledWeekState,
    };
    changedWeekStates.push(reconciledWeekState);
  }

  return {
    history: nextHistory,
    changedWeekStates,
  };
}

function buildCloudAssignmentHistory(
  cloudAssignments: CloudPickerClickerWeekAssignment[],
): PickerClickerHistory {
  return cloudAssignments.reduce<PickerClickerHistory>(
    (history, cloudAssignment) => {
      const assignment = mapCloudAssignment(
        cloudAssignment,
      );
      const weekState =
        createPickerClickerWeekState(assignment);

      history[weekState.id] = weekState;
      return history;
    },
    {},
  );
}

function getCurrentCloudCycle(
  cloudAssignments: CloudPickerClickerWeekAssignment[],
  activePlayers: Player[],
): {
  cycleNumber: number;
  usedSourcePlayerIds: Set<string>;
} {
  const latestCycleNumber = cloudAssignments.reduce(
    (highestCycle, assignment) =>
      Math.max(highestCycle, assignment.cycleNumber),
    1,
  );
  const usedSourcePlayerIds = new Set(
    cloudAssignments
      .filter(
        (assignment) =>
          assignment.cycleNumber === latestCycleNumber,
      )
      .map((assignment) => assignment.sourcePlayerId),
  );
  const hasEligiblePlayer = activePlayers.some(
    (player) =>
      !usedSourcePlayerIds.has(player.id),
  );

  if (hasEligiblePlayer) {
    return {
      cycleNumber: latestCycleNumber,
      usedSourcePlayerIds,
    };
  }

  return {
    cycleNumber: latestCycleNumber + 1,
    usedSourcePlayerIds: new Set<string>(),
  };
}

function getValidAssignedAt(
  assignedAt: string,
): string | undefined {
  return Number.isNaN(Date.parse(assignedAt))
    ? undefined
    : assignedAt;
}

function getAssignmentCreationCandidate(params: {
  cloudAssignments: CloudPickerClickerWeekAssignment[];
  cloudPlayers: Player[];
  localHistory: PickerClickerHistory;
  season: number;
  week: number;
}): {
  sourcePlayerId: string;
  cycleNumber: number;
  assignedAt?: string;
} | null {
  const activePlayers = params.cloudPlayers.filter(
    (player) => player.status === "active",
  );

  if (activePlayers.length === 0) {
    return null;
  }

  const cloudCycle = getCurrentCloudCycle(
    params.cloudAssignments,
    activePlayers,
  );
  const weekId = getPickerClickerWeekId(
    params.season,
    params.week,
  );
  const localWeekState = params.localHistory[weekId];
  const localSourcePlayer = localWeekState
    ? activePlayers.find(
        (player) =>
          player.id ===
            localWeekState.assignment.sourcePlayerId &&
          !cloudCycle.usedSourcePlayerIds.has(player.id),
      )
    : undefined;

  if (localSourcePlayer && localWeekState) {
    const assignedAt = getValidAssignedAt(
      localWeekState.assignment.assignedAt,
    );

    return {
      sourcePlayerId: localSourcePlayer.id,
      cycleNumber: cloudCycle.cycleNumber,
      ...(assignedAt ? { assignedAt } : {}),
    };
  }

  const cloudHistory = buildCloudAssignmentHistory(
    params.cloudAssignments,
  );
  const generatedWeekState =
    ensurePickerClickerWeekState({
      players: params.cloudPlayers,
      history: cloudHistory,
      season: params.season,
      week: params.week,
    });

  if (!generatedWeekState) {
    return null;
  }

  return {
    sourcePlayerId:
      generatedWeekState.assignment.sourcePlayerId,
    cycleNumber:
      generatedWeekState.assignment.cycleNumber,
    assignedAt:
      generatedWeekState.assignment.assignedAt,
  };
}

export default function CloudPickerClickerAssignmentSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();
  const {
    league,
    pickerClickerHistory,
    upsertPickerClickerWeekState,
  } = useLeague();
  const [retryVersion, setRetryVersion] = useState(0);
  const lastCompletedSyncKey = useRef<string | null>(null);
  const historyRef = useRef(pickerClickerHistory);
  const upsertWeekStateRef = useRef(
    upsertPickerClickerWeekState,
  );

  historyRef.current = pickerClickerHistory;
  upsertWeekStateRef.current =
    upsertPickerClickerWeekState;

  const sessionKey = useMemo(() => {
    if (!accountLink) {
      return null;
    }

    return [
      accountLink.userId,
      accountLink.leagueId,
      accountLink.playerId,
      accountLink.role,
    ].join(":");
  }, [accountLink]);

  const season = useMemo(
    () =>
      getLeagueSeason(
        league.settings.season,
        accountLink?.season,
      ),
    [accountLink?.season, league.settings.season],
  );
  const syncKey = useMemo(() => {
    if (!sessionKey) {
      return null;
    }

    return [
      sessionKey,
      season,
      league.currentWeek,
    ].join(":");
  }, [league.currentWeek, season, sessionKey]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked ||
      !sessionKey ||
      !syncKey
    ) {
      lastCompletedSyncKey.current = null;
      return;
    }

    if (lastCompletedSyncKey.current === syncKey) {
      return;
    }

    let canceled = false;
    let retryTimerId: number | null = null;

    const scheduleRetry = () => {
      if (canceled || retryTimerId !== null) {
        return;
      }

      retryTimerId = window.setTimeout(() => {
        setRetryVersion((currentVersion) =>
          currentVersion + 1,
        );
      }, MISSING_ASSIGNMENT_RETRY_DELAY_MS);
    };

    const synchronizeAssignments = async () => {
      try {
        const cloudAssignments =
          await loadCloudPickerClickerWeekAssignments(
            client,
            accountLink.leagueId,
            season,
          );

        if (canceled) {
          return;
        }

        const hydratedAssignments =
          hydrateCloudAssignments(
            historyRef.current,
            cloudAssignments,
          );

        for (const weekState of
          hydratedAssignments.changedWeekStates) {
          upsertWeekStateRef.current(weekState);
        }

        const currentCloudAssignment =
          cloudAssignments.find(
            (assignment) =>
              assignment.week === league.currentWeek,
          ) ?? null;

        if (currentCloudAssignment) {
          lastCompletedSyncKey.current = syncKey;
          return;
        }

        if (!access.canManageLeague) {
          scheduleRetry();
          return;
        }

        const cloudPlayers = await loadCloudLeagueRoster(
          client,
          accountLink.leagueId,
        );

        if (canceled) {
          return;
        }

        const linkedPlayerExists = cloudPlayers.some(
          (player) =>
            player.id === accountLink.playerId,
        );

        if (!linkedPlayerExists) {
          throw new Error(
            "The linked commissioner is missing from the cloud roster.",
          );
        }

        const latestHydratedHistory =
          hydrateCloudAssignments(
            historyRef.current,
            cloudAssignments,
          ).history;
        const creationCandidate =
          getAssignmentCreationCandidate({
            cloudAssignments,
            cloudPlayers,
            localHistory: latestHydratedHistory,
            season,
            week: league.currentWeek,
          });

        if (!creationCandidate) {
          scheduleRetry();
          return;
        }

        const creationResult =
          await createCloudPickerClickerWeekAssignment(
            client,
            {
              leagueId: accountLink.leagueId,
              season,
              week: league.currentWeek,
              sourcePlayerId:
                creationCandidate.sourcePlayerId,
              cycleNumber:
                creationCandidate.cycleNumber,
              ...(creationCandidate.assignedAt
                ? {
                    assignedAt:
                      creationCandidate.assignedAt,
                  }
                : {}),
            },
          );

        if (canceled) {
          return;
        }

        const currentWeekId = getPickerClickerWeekId(
          season,
          league.currentWeek,
        );
        const latestExistingWeekState =
          historyRef.current[currentWeekId] ??
          latestHydratedHistory[currentWeekId];
        const reconciledCurrentWeekState =
          reconcileCloudWeekState(
            latestExistingWeekState,
            creationResult.assignment,
          );

        if (
          reconciledCurrentWeekState !==
          latestExistingWeekState
        ) {
          upsertWeekStateRef.current(
            reconciledCurrentWeekState,
          );
        }

        lastCompletedSyncKey.current = syncKey;
      } catch (error) {
        if (!canceled) {
          console.error(
            "Cloud Picker Clicker assignment synchronization failed.",
            error,
          );
          scheduleRetry();
        }
      }
    };

    void synchronizeAssignments();

    return () => {
      canceled = true;

      if (retryTimerId !== null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [
    access.canManageLeague,
    access.isLinked,
    accountLink,
    league.currentWeek,
    retryVersion,
    season,
    sessionKey,
    status,
    syncKey,
  ]);

  return null;
}
