import type { Player } from "../types/player";
import type { HeadToHeadPicks } from "./h2hEngine";
import { PickLockEngine } from "./pickLock/PickLockEngine";
import type { WeekGame } from "./weekManager/WeekGameManager";
import {
  getPickerClickerAssignmentId,
  getPickerClickerFallbackPickId,
  getPickerClickerWeekId,
  type EffectivePlayerPick,
  type PickerClickerAssignment,
  type PickerClickerFallbackPick,
  type PickerClickerHistory,
  type PickerClickerWeekFallbacks,
  type PickerClickerWeekState,
} from "./pickerClickerTypes";

type AssignPickerClickerSourceParams = {
  players: Player[];
  history: PickerClickerHistory;
  season: number;
  week: number;
  assignedAt?: string;
  random?: () => number;
};

type EnsurePickerClickerWeekStateParams =
  AssignPickerClickerSourceParams;

type ApplyPickerClickerFallbacksParams = {
  players: Player[];
  picks: HeadToHeadPicks;
  games: WeekGame[];
  weekState: PickerClickerWeekState;
  appliedAt?: string;
};

type BuildEffectiveHeadToHeadPicksParams = {
  picks: HeadToHeadPicks;
  pickerClickerHistory: PickerClickerHistory;
  season: number;
  throughWeek?: number;
};

function normalizeTeam(team: string) {
  return team.trim().toUpperCase();
}

function getActivePlayers(players: Player[]) {
  return players.filter(
    (player) => player.status === "active"
  );
}

function getSeasonAssignments(
  history: PickerClickerHistory,
  season: number
) {
  return Object.values(history)
    .filter(
      (weekState) =>
        weekState.season === season
    )
    .map((weekState) => weekState.assignment)
    .sort(
      (assignmentA, assignmentB) =>
        assignmentA.week - assignmentB.week
    );
}

function getSafeRandomIndex(
  itemCount: number,
  random: () => number
) {
  if (itemCount <= 1) {
    return 0;
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  const boundedValue = Math.min(
    Math.max(randomValue, 0),
    0.9999999999999999
  );

  return Math.floor(boundedValue * itemCount);
}

function cloneFallbackPicks(
  fallbackPicks: PickerClickerWeekFallbacks
): PickerClickerWeekFallbacks {
  return Object.entries(fallbackPicks).reduce<
    PickerClickerWeekFallbacks
  >((clonedFallbacks, [playerId, playerFallbacks]) => {
    clonedFallbacks[playerId] = {
      ...playerFallbacks,
    };

    return clonedFallbacks;
  }, {});
}

function getLockedWeekGames(
  games: WeekGame[],
  week: number
) {
  return games.filter(
    (game) =>
      game.week === week &&
      PickLockEngine.isPickLocked(game)
  );
}

function getSourcePick(
  picks: HeadToHeadPicks,
  sourcePlayerId: string,
  gameId: string
) {
  const sourcePick =
    picks[sourcePlayerId]?.[gameId];

  if (!sourcePick) {
    return null;
  }

  return normalizeTeam(sourcePick);
}

function createFallbackPick(params: {
  season: number;
  week: number;
  gameId: string;
  playerId: string;
  sourcePlayerId: string;
  sourceTeam: string | null;
  appliedAt: string;
}): PickerClickerFallbackPick {
  return {
    id: getPickerClickerFallbackPickId(
      params.season,
      params.week,
      params.playerId,
      params.gameId
    ),

    season: params.season,
    week: params.week,
    gameId: params.gameId,

    playerId: params.playerId,
    sourcePlayerId: params.sourcePlayerId,

    team: params.sourceTeam,

    status: params.sourceTeam
      ? "copied"
      : "no-source-pick",

    appliedAt: params.appliedAt,
  };
}

export function getPickerClickerWeekState(
  history: PickerClickerHistory,
  season: number,
  week: number
) {
  return (
    history[getPickerClickerWeekId(season, week)] ??
    null
  );
}

export function assignPickerClickerSource({
  players,
  history,
  season,
  week,
  assignedAt,
  random = Math.random,
}: AssignPickerClickerSourceParams): PickerClickerAssignment | null {
  const existingWeekState =
    getPickerClickerWeekState(
      history,
      season,
      week
    );

  if (existingWeekState) {
    return existingWeekState.assignment;
  }

  const activePlayers = getActivePlayers(players);

  if (activePlayers.length === 0) {
    return null;
  }

  const seasonAssignments =
    getSeasonAssignments(history, season);

  const latestCycleNumber =
    seasonAssignments.reduce(
      (highestCycle, assignment) =>
        Math.max(
          highestCycle,
          assignment.cycleNumber
        ),
      1
    );

  let cycleNumber = latestCycleNumber;

  const usedPlayerIds = new Set(
    seasonAssignments
      .filter(
        (assignment) =>
          assignment.cycleNumber === cycleNumber
      )
      .map(
        (assignment) =>
          assignment.sourcePlayerId
      )
  );

  let eligiblePlayers = activePlayers.filter(
    (player) => !usedPlayerIds.has(player.id)
  );

  if (eligiblePlayers.length === 0) {
    cycleNumber += 1;
    eligiblePlayers = [...activePlayers];
  }

  const selectedPlayer =
    eligiblePlayers[
      getSafeRandomIndex(
        eligiblePlayers.length,
        random
      )
    ];

  if (!selectedPlayer) {
    return null;
  }

  return {
    id: getPickerClickerAssignmentId(
      season,
      week
    ),

    season,
    week,

    sourcePlayerId: selectedPlayer.id,
    sourcePlayerName: selectedPlayer.name,
    sourceNFLTeam: selectedPlayer.nflTeam,

    cycleNumber,
    assignedAt:
      assignedAt ?? new Date().toISOString(),
  };
}

export function createPickerClickerWeekState(
  assignment: PickerClickerAssignment
): PickerClickerWeekState {
  return {
    id: getPickerClickerWeekId(
      assignment.season,
      assignment.week
    ),

    season: assignment.season,
    week: assignment.week,

    assignment,

    fallbackPicks: {},
    ineligiblePlayerIds: [],
    lockedGameIds: [],

    updatedAt: assignment.assignedAt,
  };
}

export function ensurePickerClickerWeekState({
  players,
  history,
  season,
  week,
  assignedAt,
  random,
}: EnsurePickerClickerWeekStateParams): PickerClickerWeekState | null {
  const existingWeekState =
    getPickerClickerWeekState(
      history,
      season,
      week
    );

  if (existingWeekState) {
    return existingWeekState;
  }

  const assignment = assignPickerClickerSource({
    players,
    history,
    season,
    week,
    assignedAt,
    random,
  });

  if (!assignment) {
    return null;
  }

  return createPickerClickerWeekState(
    assignment
  );
}

export function applyPickerClickerFallbacks({
  players,
  picks,
  games,
  weekState,
  appliedAt,
}: ApplyPickerClickerFallbacksParams): PickerClickerWeekState {
  const activePlayers = getActivePlayers(players);

  const lockedGames = getLockedWeekGames(
    games,
    weekState.week
  );

  if (
    activePlayers.length === 0 ||
    lockedGames.length === 0
  ) {
    return weekState;
  }

  const timestamp =
    appliedAt ?? new Date().toISOString();

  const nextFallbackPicks =
    cloneFallbackPicks(
      weekState.fallbackPicks
    );

  const nextIneligiblePlayerIds = new Set(
    weekState.ineligiblePlayerIds
  );

  const nextLockedGameIds = new Set(
    weekState.lockedGameIds
  );

  let changed = false;

  for (const game of lockedGames) {
    if (!nextLockedGameIds.has(game.id)) {
      nextLockedGameIds.add(game.id);
      changed = true;
    }

    const sourceTeam = getSourcePick(
      picks,
      weekState.assignment.sourcePlayerId,
      game.id
    );

    for (const player of activePlayers) {
      const manualPick =
        picks[player.id]?.[game.id];

      if (manualPick) {
        continue;
      }

      if (
        !nextIneligiblePlayerIds.has(player.id)
      ) {
        nextIneligiblePlayerIds.add(player.id);
        changed = true;
      }

      const existingFallback =
        nextFallbackPicks[player.id]?.[
          game.id
        ];

      if (existingFallback) {
        continue;
      }

      const playerFallbacks =
        nextFallbackPicks[player.id] ?? {};

      nextFallbackPicks[player.id] = {
        ...playerFallbacks,

        [game.id]: createFallbackPick({
          season: weekState.season,
          week: weekState.week,
          gameId: game.id,
          playerId: player.id,

          sourcePlayerId:
            weekState.assignment
              .sourcePlayerId,

          sourceTeam,
          appliedAt: timestamp,
        }),
      };

      changed = true;
    }
  }

  if (!changed) {
    return weekState;
  }

  return {
    ...weekState,

    fallbackPicks: nextFallbackPicks,

    ineligiblePlayerIds: Array.from(
      nextIneligiblePlayerIds
    ),

    lockedGameIds: Array.from(
      nextLockedGameIds
    ),

    updatedAt: timestamp,
  };
}

export function upsertPickerClickerWeekState(
  history: PickerClickerHistory,
  weekState: PickerClickerWeekState
): PickerClickerHistory {
  if (history[weekState.id] === weekState) {
    return history;
  }

  return {
    ...history,
    [weekState.id]: weekState,
  };
}

export function getEffectivePlayerPick(params: {
  playerId: string;
  gameId: string;
  picks: HeadToHeadPicks;
  weekState: PickerClickerWeekState | null;
}): EffectivePlayerPick {
  const manualPick =
    params.picks[params.playerId]?.[
      params.gameId
    ];

  const weeklyPrizeEligible =
    !params.weekState?.ineligiblePlayerIds.includes(
      params.playerId
    );

  if (manualPick) {
    return {
      playerId: params.playerId,
      gameId: params.gameId,

      team: normalizeTeam(manualPick),
      source: "manual",

      sourcePlayerId: null,
      weeklyPrizeEligible,
    };
  }

  const fallback =
    params.weekState?.fallbackPicks[
      params.playerId
    ]?.[params.gameId];

  if (
    fallback?.status === "copied" &&
    fallback.team
  ) {
    return {
      playerId: params.playerId,
      gameId: params.gameId,

      team: normalizeTeam(fallback.team),
      source: "picker-clicker",

      sourcePlayerId:
        fallback.sourcePlayerId,

      weeklyPrizeEligible: false,
    };
  }

  return {
    playerId: params.playerId,
    gameId: params.gameId,

    team: null,
    source: "missing",

    sourcePlayerId:
      fallback?.sourcePlayerId ?? null,

    weeklyPrizeEligible,
  };
}

export function buildEffectiveHeadToHeadPicks({
  picks,
  pickerClickerHistory,
  season,
  throughWeek,
}: BuildEffectiveHeadToHeadPicksParams): HeadToHeadPicks {
  const effectivePicks =
    Object.entries(picks).reduce<
      HeadToHeadPicks
    >((clonedPicks, [playerId, playerPicks]) => {
      clonedPicks[playerId] = {
        ...playerPicks,
      };

      return clonedPicks;
    }, {});

  const applicableWeekStates =
    Object.values(pickerClickerHistory)
      .filter(
        (weekState) =>
          weekState.season === season &&
          (throughWeek === undefined ||
            weekState.week <= throughWeek)
      )
      .sort(
        (weekStateA, weekStateB) =>
          weekStateA.week -
          weekStateB.week
      );

  for (const weekState of applicableWeekStates) {
    for (const [
      playerId,
      playerFallbacks,
    ] of Object.entries(
      weekState.fallbackPicks
    )) {
      for (const fallback of Object.values(
        playerFallbacks
      )) {
        if (
          fallback.status !== "copied" ||
          !fallback.team
        ) {
          continue;
        }

        const currentPlayerPicks =
          effectivePicks[playerId] ?? {};

        if (currentPlayerPicks[fallback.gameId]) {
          continue;
        }

        effectivePicks[playerId] = {
          ...currentPlayerPicks,

          [fallback.gameId]:
            normalizeTeam(fallback.team),
        };
      }
    }
  }

  return effectivePicks;
}

export function isPlayerWeeklyPrizeEligible(
  playerId: string,
  weekState: PickerClickerWeekState | null
) {
  if (!weekState) {
    return true;
  }

  return !weekState.ineligiblePlayerIds.includes(
    playerId
  );
}

export function getPlayerPickerClickerFallbackCount(
  playerId: string,
  weekState: PickerClickerWeekState | null
) {
  if (!weekState) {
    return 0;
  }

  return Object.keys(
    weekState.fallbackPicks[playerId] ?? {}
  ).length;
}