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
  getPickerClickerWeekId,
  getPlayerSelectedPickerClickerPickId,
} from "../../engine/pickerClickerTypes";
import type {
  PickerClickerWeekSelections,
  PickerClickerWeekState,
  PlayerSelectedPickerClickerPick,
} from "../../engine/pickerClickerTypes";
import type { NFLGame } from "../../engine/nfl/NFLTypes";
import type { WeekGame } from "../../engine/weekManager/WeekGameManager";
import {
  loadCloudLeagueGames,
  synchronizeCloudLeagueGames,
} from "../../services/cloudLeagueGameService";
import {
  clearCloudPlayerPickIntent,
  loadCloudPlayerPickIntents,
  saveCloudManualPickIntent,
  saveCloudPickerClickerIntent,
} from "../../services/cloudPlayerPickService";
import type { CloudPlayerPickIntent } from "../../services/cloudPlayerPickService";
import { supabaseClient } from "../../services/supabaseClient";

const CLOUD_SYNC_INTERVAL_MS = 15_000;
const NONE_SIGNATURE = "none";

type ManualLocalIntent = {
  choice: "manual";
  selectedTeam: string;
  submittedAt: string | null;
};

type PickerClickerLocalIntent = {
  choice: "picker-clicker";
  sourcePlayerId: string;
  submittedAt: string;
};

type LocalIntent =
  | ManualLocalIntent
  | PickerClickerLocalIntent;

type LocalIntentMap = Record<
  string,
  LocalIntent | null
>;

type SignatureMap = Record<string, string>;

type HydrationTarget = {
  syncKey: string;
  signatures: SignatureMap;
};

type LeaguePicks = Record<
  string,
  Record<string, string> | undefined
>;

function normalizeTeam(team: string): string {
  return team.trim().toUpperCase();
}

function getIntentSignature(
  intent: LocalIntent | null,
): string {
  if (!intent) {
    return NONE_SIGNATURE;
  }

  if (intent.choice === "manual") {
    return `manual:${intent.selectedTeam}`;
  }

  return `picker-clicker:${intent.sourcePlayerId}`;
}

function getInvalidCloudSignature(
  intent: CloudPlayerPickIntent,
): string {
  return [
    "invalid",
    intent.choice,
    intent.selectedTeam ?? "",
    intent.pickerClickerSourcePlayerId ?? "",
    intent.updatedAt,
  ].join(":");
}

function getSignatureMap(
  intents: LocalIntentMap,
  games: WeekGame[],
): SignatureMap {
  return Object.fromEntries(
    games.map((game) => [
      game.id,
      getIntentSignature(intents[game.id] ?? null),
    ]),
  );
}

function signatureMapsMatch(
  left: SignatureMap,
  right: SignatureMap,
  games: WeekGame[],
): boolean {
  return games.every(
    (game) =>
      (left[game.id] ?? NONE_SIGNATURE) ===
      (right[game.id] ?? NONE_SIGNATURE),
  );
}

function getManualIntent(
  team: string | undefined,
  game: WeekGame,
): ManualLocalIntent | null {
  const selectedTeam = normalizeTeam(team ?? "");
  const awayTeam = normalizeTeam(game.awayTeam);
  const homeTeam = normalizeTeam(game.homeTeam);

  if (
    selectedTeam !== awayTeam &&
    selectedTeam !== homeTeam
  ) {
    return null;
  }

  return {
    choice: "manual",
    selectedTeam,
    submittedAt: null,
  };
}

function readLocalIntentMap(params: {
  picks: LeaguePicks;
  weekState: PickerClickerWeekState;
  playerId: string;
  games: WeekGame[];
}): LocalIntentMap {
  const playerPicks = params.picks[params.playerId] ?? {};
  const selectedPickerClickerPicks =
    params.weekState.playerSelectedPicks?.[
      params.playerId
    ] ?? {};
  const sourcePlayerId =
    params.weekState.assignment.sourcePlayerId;

  return Object.fromEntries(
    params.games.map((game) => {
      const selectedPickerClickerPick =
        selectedPickerClickerPicks[game.id];

      if (
        selectedPickerClickerPick &&
        sourcePlayerId !== params.playerId
      ) {
        return [
          game.id,
          {
            choice: "picker-clicker",
            sourcePlayerId,
            submittedAt:
              selectedPickerClickerPick.selectedAt,
          } satisfies PickerClickerLocalIntent,
        ];
      }

      return [
        game.id,
        getManualIntent(
          playerPicks[game.id],
          game,
        ),
      ];
    }),
  );
}

function mapCloudIntent(params: {
  intent: CloudPlayerPickIntent;
  game: WeekGame;
  week: number;
  playerId: string;
  assignmentSourcePlayerId: string;
}): LocalIntent | null {
  const {
    intent,
    game,
    week,
    playerId,
    assignmentSourcePlayerId,
  } = params;

  if (
    intent.gameId !== game.id ||
    intent.week !== week ||
    intent.playerId !== playerId
  ) {
    return null;
  }

  if (intent.choice === "manual") {
    const selectedTeam = normalizeTeam(
      intent.selectedTeam ?? "",
    );
    const awayTeam = normalizeTeam(game.awayTeam);
    const homeTeam = normalizeTeam(game.homeTeam);

    if (
      selectedTeam !== awayTeam &&
      selectedTeam !== homeTeam
    ) {
      return null;
    }

    return {
      choice: "manual",
      selectedTeam,
      submittedAt: intent.submittedAt,
    };
  }

  if (
    assignmentSourcePlayerId === playerId ||
    intent.pickerClickerSourcePlayerId !==
      assignmentSourcePlayerId
  ) {
    return null;
  }

  return {
    choice: "picker-clicker",
    sourcePlayerId: assignmentSourcePlayerId,
    submittedAt:
      intent.submittedAt ?? intent.updatedAt,
  };
}

function buildPlayerSelectedPicks(params: {
  weekState: PickerClickerWeekState;
  playerId: string;
  games: WeekGame[];
  intents: LocalIntentMap;
}): PickerClickerWeekSelections {
  const nextSelections: PickerClickerWeekSelections = {
    ...params.weekState.playerSelectedPicks,
  };
  const nextPlayerSelections = {
    ...nextSelections[params.playerId],
  };

  for (const game of params.games) {
    const intent = params.intents[game.id] ?? null;

    if (intent?.choice === "picker-clicker") {
      const selectedPick: PlayerSelectedPickerClickerPick = {
        id: getPlayerSelectedPickerClickerPickId(
          params.weekState.season,
          params.weekState.week,
          params.playerId,
          game.id,
        ),
        season: params.weekState.season,
        week: params.weekState.week,
        gameId: game.id,
        playerId: params.playerId,
        selectedAt: intent.submittedAt,
      };

      nextPlayerSelections[game.id] = selectedPick;
    } else {
      delete nextPlayerSelections[game.id];
    }
  }

  if (Object.keys(nextPlayerSelections).length > 0) {
    nextSelections[params.playerId] = nextPlayerSelections;
  } else {
    delete nextSelections[params.playerId];
  }

  return nextSelections;
}

function pickerClickerSelectionsMatch(
  left: PickerClickerWeekSelections | undefined,
  right: PickerClickerWeekSelections,
  playerId: string,
  games: WeekGame[],
): boolean {
  const leftPlayerSelections = left?.[playerId] ?? {};
  const rightPlayerSelections = right[playerId] ?? {};

  return games.every((game) => {
    const leftPick = leftPlayerSelections[game.id];
    const rightPick = rightPlayerSelections[game.id];

    if (!leftPick && !rightPick) {
      return true;
    }

    return (
      leftPick?.id === rightPick?.id &&
      leftPick?.selectedAt === rightPick?.selectedAt
    );
  });
}

function applyLocalIntentMap(params: {
  currentIntents: LocalIntentMap;
  desiredIntents: LocalIntentMap;
  weekState: PickerClickerWeekState;
  playerId: string;
  games: WeekGame[];
  setPick: (
    playerId: string,
    gameId: string,
    team: string,
  ) => void;
  upsertWeekState: (
    weekState: PickerClickerWeekState,
  ) => void;
}): boolean {
  let changed = false;

  for (const game of params.games) {
    const currentIntent =
      params.currentIntents[game.id] ?? null;
    const desiredIntent =
      params.desiredIntents[game.id] ?? null;

    if (
      getIntentSignature(currentIntent) ===
      getIntentSignature(desiredIntent)
    ) {
      continue;
    }

    params.setPick(
      params.playerId,
      game.id,
      desiredIntent?.choice === "manual"
        ? desiredIntent.selectedTeam
        : "",
    );
    changed = true;
  }

  const nextPlayerSelectedPicks =
    buildPlayerSelectedPicks({
      weekState: params.weekState,
      playerId: params.playerId,
      games: params.games,
      intents: params.desiredIntents,
    });

  if (
    !pickerClickerSelectionsMatch(
      params.weekState.playerSelectedPicks,
      nextPlayerSelectedPicks,
      params.playerId,
      params.games,
    )
  ) {
    params.upsertWeekState({
      ...params.weekState,
      playerSelectedPicks: nextPlayerSelectedPicks,
      updatedAt: new Date().toISOString(),
    });
    changed = true;
  }

  return changed;
}

function cloudGamesCoverSnapshot(
  cloudGames: Awaited<
    ReturnType<typeof loadCloudLeagueGames>
  >,
  nflGames: NFLGame[],
): boolean {
  const cloudGamesById = new Map(
    cloudGames.map((game) => [game.gameId, game]),
  );

  return nflGames.every((nflGame) => {
    const cloudGame = cloudGamesById.get(nflGame.id);

    return (
      cloudGame?.season === nflGame.season &&
      cloudGame.week === nflGame.week &&
      cloudGame.awayTeam ===
        normalizeTeam(nflGame.awayTeam.abbreviation) &&
      cloudGame.homeTeam ===
        normalizeTeam(nflGame.homeTeam.abbreviation)
    );
  });
}

function isLockedCloudWriteError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(
      "locked or the signed-in account does not own the pick",
    )
  );
}

export default function CloudPlayerPickIntentSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();
  const {
    league,
    picks,
    setPick,
    pickerClickerHistory,
    upsertPickerClickerWeekState,
  } = useLeague();
  const {
    season,
    week,
    snapshot,
  } = useNFL();
  const [readyVersion, setReadyVersion] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const baselineRef = useRef<SignatureMap>({});
  const readySyncKeyRef = useRef<string | null>(null);
  const gamesReadySyncKeyRef = useRef<string | null>(null);
  const hydrationTargetRef =
    useRef<HydrationTarget | null>(null);
  const inFlightGameIdsRef = useRef(new Set<string>());
  const forceRemoteGameIdsRef = useRef(new Set<string>());
  const activeSyncKeyRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef({
    picks,
    pickerClickerHistory,
    setPick,
    upsertPickerClickerWeekState,
  });

  latestStateRef.current = {
    picks,
    pickerClickerHistory,
    setPick,
    upsertPickerClickerWeekState,
  };

  const weekStateId = useMemo(
    () => getPickerClickerWeekId(season, week),
    [season, week],
  );
  const weekState =
    pickerClickerHistory[weekStateId];
  const gameFingerprint = useMemo(() => {
    if (!snapshot) {
      return "";
    }

    return snapshot.nflGames
      .map((game) =>
        [
          game.id,
          game.season,
          game.week,
          game.awayTeam.abbreviation,
          game.homeTeam.abbreviation,
          game.kickoff,
        ].join("~"),
      )
      .sort()
      .join("|");
  }, [snapshot]);
  const syncKey = useMemo(() => {
    if (
      !accountLink ||
      !snapshot ||
      !weekState ||
      snapshot.season !== season ||
      snapshot.week !== week ||
      week !== league.currentWeek ||
      accountLink.season !== season ||
      snapshot.nflGames.length === 0 ||
      snapshot.weekGames.length === 0
    ) {
      return null;
    }

    return [
      accountLink.userId,
      accountLink.leagueId,
      accountLink.playerId,
      season,
      week,
      weekState.assignment.sourcePlayerId,
      gameFingerprint,
    ].join(":");
  }, [
    accountLink,
    gameFingerprint,
    league.currentWeek,
    season,
    snapshot,
    week,
    weekState,
  ]);

  useEffect(() => {
    activeSyncKeyRef.current = syncKey;
    baselineRef.current = {};
    readySyncKeyRef.current = null;
    gamesReadySyncKeyRef.current = null;
    hydrationTargetRef.current = null;
    inFlightGameIdsRef.current.clear();
    forceRemoteGameIdsRef.current.clear();

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setReadyVersion((currentVersion) =>
      currentVersion + 1,
    );
  }, [syncKey]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      !syncKey ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked ||
      !snapshot ||
      !weekState
    ) {
      return;
    }

    let canceled = false;
    let running = false;
    let intervalId: number | null = null;
    const nflGames = snapshot.nflGames;
    const weekGames = snapshot.weekGames;
    const playerId = accountLink.playerId;
    const leagueId = accountLink.leagueId;
    const assignmentSourcePlayerId =
      weekState.assignment.sourcePlayerId;

    const reconcileCloudState = async () => {
      if (running || canceled) {
        return;
      }

      running = true;
      const stateAtStart = latestStateRef.current;
      const weekStateAtStart =
        stateAtStart.pickerClickerHistory[
          weekStateId
        ];

      if (!weekStateAtStart) {
        running = false;
        return;
      }

      const localAtStart = readLocalIntentMap({
        picks: stateAtStart.picks,
        weekState: weekStateAtStart,
        playerId,
        games: weekGames,
      });

      try {
        const cloudGames = access.canManageLeague
          ? await synchronizeCloudLeagueGames(
              client,
              leagueId,
              nflGames,
            )
          : await loadCloudLeagueGames(
              client,
              leagueId,
              season,
              week,
            );

        if (
          canceled ||
          activeSyncKeyRef.current !== syncKey
        ) {
          return;
        }

        if (
          !cloudGamesCoverSnapshot(
            cloudGames,
            nflGames,
          )
        ) {
          gamesReadySyncKeyRef.current = null;
          return;
        }

        gamesReadySyncKeyRef.current = syncKey;

        const cloudIntents =
          await loadCloudPlayerPickIntents(
            client,
            leagueId,
            playerId,
            week,
          );

        if (
          canceled ||
          activeSyncKeyRef.current !== syncKey
        ) {
          return;
        }

        const latestState = latestStateRef.current;
        const latestWeekState =
          latestState.pickerClickerHistory[
            weekStateId
          ];

        if (!latestWeekState) {
          return;
        }

        const localLatest = readLocalIntentMap({
          picks: latestState.picks,
          weekState: latestWeekState,
          playerId,
          games: weekGames,
        });
        const cloudIntentsByGameId = new Map(
          cloudIntents.map((intent) => [
            intent.gameId,
            intent,
          ]),
        );
        const wasReady =
          readySyncKeyRef.current === syncKey;
        const previousBaseline = {
          ...baselineRef.current,
        };
        const nextBaseline: SignatureMap = {};
        const desiredIntents: LocalIntentMap = {};

        for (const game of weekGames) {
          const cloudIntent =
            cloudIntentsByGameId.get(game.id) ?? null;
          const mappedCloudIntent = cloudIntent
            ? mapCloudIntent({
                intent: cloudIntent,
                game,
                week,
                playerId,
                assignmentSourcePlayerId,
              })
            : null;
          const remoteSignature = cloudIntent
            ? mappedCloudIntent
              ? getIntentSignature(mappedCloudIntent)
              : getInvalidCloudSignature(cloudIntent)
            : NONE_SIGNATURE;
          const startIntent =
            localAtStart[game.id] ?? null;
          const latestIntent =
            localLatest[game.id] ?? null;
          const startSignature =
            getIntentSignature(startIntent);
          const latestSignature =
            getIntentSignature(latestIntent);
          const previousSignature =
            previousBaseline[game.id] ??
            NONE_SIGNATURE;
          const changedDuringLoad =
            startSignature !== latestSignature;
          const locallyDirty =
            wasReady &&
            latestSignature !== previousSignature;
          const forceRemote =
            forceRemoteGameIdsRef.current.has(
              game.id,
            );

          if (forceRemote) {
            desiredIntents[game.id] =
              mappedCloudIntent;
            nextBaseline[game.id] =
              remoteSignature;
            forceRemoteGameIdsRef.current.delete(
              game.id,
            );
          } else if (!wasReady) {
            desiredIntents[game.id] =
              changedDuringLoad
                ? latestIntent
                : mappedCloudIntent ?? latestIntent;
            nextBaseline[game.id] =
              remoteSignature;
          } else if (
            locallyDirty ||
            changedDuringLoad
          ) {
            desiredIntents[game.id] =
              latestIntent;
            nextBaseline[game.id] =
              previousSignature;
          } else if (
            cloudIntent &&
            !mappedCloudIntent
          ) {
            desiredIntents[game.id] =
              latestIntent;
            nextBaseline[game.id] =
              remoteSignature;
          } else {
            desiredIntents[game.id] =
              mappedCloudIntent;
            nextBaseline[game.id] =
              remoteSignature;
          }
        }

        baselineRef.current = nextBaseline;

        const changed = applyLocalIntentMap({
          currentIntents: localLatest,
          desiredIntents,
          weekState: latestWeekState,
          playerId,
          games: weekGames,
          setPick: latestState.setPick,
          upsertWeekState:
            latestState.upsertPickerClickerWeekState,
        });

        if (changed) {
          readySyncKeyRef.current = null;
          hydrationTargetRef.current = {
            syncKey,
            signatures: getSignatureMap(
              desiredIntents,
              weekGames,
            ),
          };
        } else {
          hydrationTargetRef.current = null;
          readySyncKeyRef.current = syncKey;
          setReadyVersion((currentVersion) =>
            currentVersion + 1,
          );
        }
      } catch {
        gamesReadySyncKeyRef.current = null;
      } finally {
        running = false;
      }
    };

    void reconcileCloudState();
    intervalId = window.setInterval(() => {
      void reconcileCloudState();
    }, CLOUD_SYNC_INTERVAL_MS);

    return () => {
      canceled = true;

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    access.canManageLeague,
    access.isLinked,
    accountLink,
    season,
    snapshot,
    status,
    syncKey,
    week,
    weekState,
    weekStateId,
  ]);

  useEffect(() => {
    const target = hydrationTargetRef.current;

    if (
      !target ||
      !syncKey ||
      target.syncKey !== syncKey ||
      !accountLink ||
      !snapshot
    ) {
      return;
    }

    const latestWeekState =
      pickerClickerHistory[weekStateId];

    if (!latestWeekState) {
      return;
    }

    const currentIntents = readLocalIntentMap({
      picks,
      weekState: latestWeekState,
      playerId: accountLink.playerId,
      games: snapshot.weekGames,
    });
    const currentSignatures = getSignatureMap(
      currentIntents,
      snapshot.weekGames,
    );

    if (
      !signatureMapsMatch(
        currentSignatures,
        target.signatures,
        snapshot.weekGames,
      )
    ) {
      return;
    }

    hydrationTargetRef.current = null;
    readySyncKeyRef.current = syncKey;
    setReadyVersion((currentVersion) =>
      currentVersion + 1,
    );
  }, [
    accountLink,
    pickerClickerHistory,
    picks,
    snapshot,
    syncKey,
    weekStateId,
  ]);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      !syncKey ||
      readySyncKeyRef.current !== syncKey ||
      gamesReadySyncKeyRef.current !== syncKey ||
      status !== "signed-in-linked" ||
      !accountLink ||
      !access.isLinked ||
      !snapshot
    ) {
      return;
    }

    const latestWeekState =
      pickerClickerHistory[weekStateId];

    if (!latestWeekState) {
      return;
    }

    const playerId = accountLink.playerId;
    const leagueId = accountLink.leagueId;
    const currentIntents = readLocalIntentMap({
      picks,
      weekState: latestWeekState,
      playerId,
      games: snapshot.weekGames,
    });

    const scheduleRetry = () => {
      if (retryTimerRef.current !== null) {
        return;
      }

      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setRetryVersion((currentVersion) =>
          currentVersion + 1,
        );
      }, CLOUD_SYNC_INTERVAL_MS);
    };

    for (const game of snapshot.weekGames) {
      const intent = currentIntents[game.id] ?? null;
      const signature = getIntentSignature(intent);
      const baselineSignature =
        baselineRef.current[game.id] ??
        NONE_SIGNATURE;

      if (
        signature === baselineSignature ||
        inFlightGameIdsRef.current.has(game.id)
      ) {
        continue;
      }

      inFlightGameIdsRef.current.add(game.id);

      void (async () => {
        let saved = false;

        try {
          if (!intent) {
            await clearCloudPlayerPickIntent(
              client,
              {
                leagueId,
                playerId,
                gameId: game.id,
              },
            );
          } else if (intent.choice === "manual") {
            await saveCloudManualPickIntent(
              client,
              {
                leagueId,
                playerId,
                gameId: game.id,
                selectedTeam: intent.selectedTeam,
                submittedAt: intent.submittedAt,
              },
            );
          } else {
            await saveCloudPickerClickerIntent(
              client,
              {
                leagueId,
                playerId,
                gameId: game.id,
                sourcePlayerId:
                  intent.sourcePlayerId,
                submittedAt: intent.submittedAt,
              },
            );
          }

          saved = true;

          if (
            activeSyncKeyRef.current === syncKey
          ) {
            baselineRef.current = {
              ...baselineRef.current,
              [game.id]: signature,
            };
          }
        } catch (error) {
          if (
            activeSyncKeyRef.current === syncKey &&
            isLockedCloudWriteError(error)
          ) {
            forceRemoteGameIdsRef.current.add(
              game.id,
            );
            readySyncKeyRef.current = null;
            setReadyVersion((currentVersion) =>
              currentVersion + 1,
            );
          } else {
            scheduleRetry();
          }
        } finally {
          inFlightGameIdsRef.current.delete(
            game.id,
          );

          if (
            saved &&
            activeSyncKeyRef.current === syncKey
          ) {
            setRetryVersion((currentVersion) =>
              currentVersion + 1,
            );
          }
        }
      })();
    }
  }, [
    access.isLinked,
    accountLink,
    pickerClickerHistory,
    picks,
    readyVersion,
    retryVersion,
    snapshot,
    status,
    syncKey,
    weekStateId,
  ]);

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(
          retryTimerRef.current,
        );
      }
    },
    [],
  );

  return null;
}
