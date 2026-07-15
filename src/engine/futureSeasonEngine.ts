import type { LeagueState } from "../types/league";
import type {
  PlayerRole,
  PlayerStatus,
} from "../types/player";
import {
  NFL_TEAM_DATA,
} from "./nflTeamOwnership";
import type {
  FutureSeasonPlan,
  FutureSeasonPlayerPlan,
  FutureSeasonRosterDecision,
  FutureSeasonValidationIssue,
  FutureSeasonValidationResult,
} from "./futureSeasonTypes";

export type CreateFutureSeasonPlanInput = {
  league: LeagueState;
  targetSeason?: number;
  createdAt?: string;
};

export type FutureSeasonPlanDetailsUpdate = {
  leagueName?: string;
  targetSeason?: number;
};

export type FutureSeasonPlayerPlanUpdate =
  Partial<
    Pick<
      FutureSeasonPlayerPlan,
      | "playerId"
      | "name"
      | "nflTeam"
      | "email"
      | "customLogo"
      | "role"
      | "status"
      | "rosterDecision"
      | "preservesCloudLink"
    >
  >;

export type FutureSeasonReplacementInput = {
  playerId?: string;
  name: string;
  nflTeam?: string;
  email?: string;
  customLogo?: string;
  role?: PlayerRole;
  status?: PlayerStatus;
};

export type FutureSeasonLeadershipInput = {
  primaryCommissionerSourcePlayerId: string;
  backupCommissionerSourcePlayerId: string;
};

export type FutureSeasonTeamSwapInput = {
  firstSourcePlayerId: string;
  secondSourcePlayerId: string;
};

const REQUIRED_ROSTER_SIZE = NFL_TEAM_DATA.length;

function getTimestamp(
  timestamp?: string,
): string {
  return (
    timestamp?.trim() ||
    new Date().toISOString()
  );
}

function parseSeason(
  value: string | number,
): number {
  const parsedSeason = Number.parseInt(
    String(value),
    10,
  );

  return Number.isInteger(parsedSeason)
    ? parsedSeason
    : 0;
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTeam(value: string): string {
  return value.trim().toUpperCase();
}

function toIdToken(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "player"
  );
}

function isFutureSeasonPlayerActive(
  player: FutureSeasonPlayerPlan,
): boolean {
  return (
    player.status === "active" &&
    player.rosterDecision !== "inactive"
  );
}

function assertPlanEditable(
  plan: FutureSeasonPlan,
): void {
  if (plan.status === "activated") {
    throw new Error(
      "An activated future-season plan cannot be edited.",
    );
  }
}

function getPlayerBySourceIdOrThrow(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
): FutureSeasonPlayerPlan {
  const normalizedSourcePlayerId =
    sourcePlayerId.trim();

  if (!normalizedSourcePlayerId) {
    throw new Error(
      "Select a future-season player first.",
    );
  }

  const player = plan.players.find(
    (candidate) =>
      candidate.sourcePlayerId ===
      normalizedSourcePlayerId,
  );

  if (!player) {
    throw new Error(
      "The selected player is not part of this future-season plan.",
    );
  }

  return player;
}

function getActivePlayerBySourceIdOrThrow(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  inactiveMessage: string,
): FutureSeasonPlayerPlan {
  const player = getPlayerBySourceIdOrThrow(
    plan,
    sourcePlayerId,
  );

  if (!isFutureSeasonPlayerActive(player)) {
    throw new Error(inactiveMessage);
  }

  return player;
}

function buildPlayerPlan(
  player: LeagueState["players"][number],
): FutureSeasonPlayerPlan {
  const isActive = player.status === "active";

  return {
    playerId: player.id,
    sourcePlayerId: player.id,
    name: player.name.trim(),
    nflTeam: normalizeTeam(player.nflTeam),
    ...(player.email?.trim()
      ? {
          email: player.email.trim(),
        }
      : {}),
    ...(player.customLogo?.trim()
      ? {
          customLogo:
            player.customLogo.trim(),
        }
      : {}),
    role: player.role,
    status: player.status,
    rosterDecision: isActive
      ? "returning"
      : "inactive",
    preservesCloudLink: isActive,
  };
}

function touchPlan(
  plan: FutureSeasonPlan,
  updatedAt?: string,
): FutureSeasonPlan {
  return {
    ...plan,
    status: "draft",
    updatedAt: getTimestamp(updatedAt),
  };
}

function replacePlayerInPlan(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  replacement: FutureSeasonPlayerPlan,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  const playerExists = plan.players.some(
    (player) =>
      player.sourcePlayerId ===
      sourcePlayerId,
  );

  if (!playerExists) {
    throw new Error(
      "The selected source player is not part of this future-season plan.",
    );
  }

  return touchPlan(
    {
      ...plan,
      players: plan.players.map((player) =>
        player.sourcePlayerId ===
        sourcePlayerId
          ? replacement
          : player,
      ),
    },
    updatedAt,
  );
}

export function getFutureSeasonPlanId(
  sourceSeason: number,
  targetSeason: number,
): string {
  return `${sourceSeason}-${targetSeason}-future-season-plan`;
}

export function createFutureSeasonPlan(
  input: CreateFutureSeasonPlanInput,
): FutureSeasonPlan {
  const sourceSeason = parseSeason(
    input.league.settings.season,
  );
  const defaultTargetSeason =
    sourceSeason > 0
      ? sourceSeason + 1
      : new Date().getFullYear() + 1;
  const targetSeason =
    input.targetSeason ??
    defaultTargetSeason;
  const createdAt = getTimestamp(
    input.createdAt,
  );

  return {
    id: getFutureSeasonPlanId(
      sourceSeason,
      targetSeason,
    ),
    sourceSeason,
    targetSeason,
    leagueName:
      input.league.settings.leagueName.trim(),
    status: "draft",
    players: input.league.players.map(
      buildPlayerPlan,
    ),
    createdAt,
    updatedAt: createdAt,
  };
}

export function createFutureSeasonReplacementPlayerId(
  sourcePlayerId: string,
  targetSeason: number,
  seed = Date.now().toString(36),
): string {
  return [
    toIdToken(sourcePlayerId),
    "replacement",
    targetSeason,
    toIdToken(seed),
  ].join("-");
}

export function updateFutureSeasonPlanDetails(
  plan: FutureSeasonPlan,
  updates: FutureSeasonPlanDetailsUpdate,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  const nextSourceSeason =
    plan.sourceSeason;
  const nextTargetSeason =
    updates.targetSeason ??
    plan.targetSeason;

  return touchPlan(
    {
      ...plan,
      id: getFutureSeasonPlanId(
        nextSourceSeason,
        nextTargetSeason,
      ),
      leagueName:
        updates.leagueName !== undefined
          ? updates.leagueName.trim()
          : plan.leagueName,
      targetSeason: nextTargetSeason,
    },
    updatedAt,
  );
}

export function updateFutureSeasonPlayerPlan(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  updates: FutureSeasonPlayerPlanUpdate,
  updatedAt?: string,
): FutureSeasonPlan {
  const currentPlayer =
    getPlayerBySourceIdOrThrow(
      plan,
      sourcePlayerId,
    );

  const nextPlayer: FutureSeasonPlayerPlan = {
    ...currentPlayer,
    ...updates,
    name:
      updates.name !== undefined
        ? updates.name.trim()
        : currentPlayer.name,
    nflTeam:
      updates.nflTeam !== undefined
        ? normalizeTeam(updates.nflTeam)
        : currentPlayer.nflTeam,
  };

  return replacePlayerInPlan(
    plan,
    currentPlayer.sourcePlayerId,
    nextPlayer,
    updatedAt,
  );
}

export function markFutureSeasonPlayerReturning(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  updatedAt?: string,
): FutureSeasonPlan {
  const currentPlayer =
    getPlayerBySourceIdOrThrow(
      plan,
      sourcePlayerId,
    );

  return replacePlayerInPlan(
    plan,
    currentPlayer.sourcePlayerId,
    {
      ...currentPlayer,
      playerId:
        currentPlayer.sourcePlayerId,
      status: "active",
      rosterDecision: "returning",
      preservesCloudLink: true,
    },
    updatedAt,
  );
}

export function markFutureSeasonPlayerInactive(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  updatedAt?: string,
): FutureSeasonPlan {
  const currentPlayer =
    getPlayerBySourceIdOrThrow(
      plan,
      sourcePlayerId,
    );

  return replacePlayerInPlan(
    plan,
    currentPlayer.sourcePlayerId,
    {
      ...currentPlayer,
      status: "inactive",
      rosterDecision: "inactive",
      preservesCloudLink: false,
    },
    updatedAt,
  );
}

export function replaceFutureSeasonPlayer(
  plan: FutureSeasonPlan,
  sourcePlayerId: string,
  input: FutureSeasonReplacementInput,
  updatedAt?: string,
): FutureSeasonPlan {
  const currentPlayer =
    getPlayerBySourceIdOrThrow(
      plan,
      sourcePlayerId,
    );
  const replacementId =
    input.playerId?.trim() ||
    createFutureSeasonReplacementPlayerId(
      currentPlayer.sourcePlayerId,
      plan.targetSeason,
    );

  const replacement: FutureSeasonPlayerPlan = {
    playerId: replacementId,
    sourcePlayerId:
      currentPlayer.sourcePlayerId,
    name: input.name.trim(),
    nflTeam: normalizeTeam(
      input.nflTeam ??
        currentPlayer.nflTeam,
    ),
    ...(input.email?.trim()
      ? {
          email: input.email.trim(),
        }
      : {}),
    ...(input.customLogo?.trim()
      ? {
          customLogo:
            input.customLogo.trim(),
        }
      : {}),
    role: "player",
    status: input.status ?? "active",
    rosterDecision: "replacement",
    preservesCloudLink: false,
  };

  return replacePlayerInPlan(
    plan,
    currentPlayer.sourcePlayerId,
    replacement,
    updatedAt,
  );
}

export function setFutureSeasonLeadership(
  plan: FutureSeasonPlan,
  input: FutureSeasonLeadershipInput,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  const primarySourcePlayerId =
    input.primaryCommissionerSourcePlayerId.trim();
  const backupSourcePlayerId =
    input.backupCommissionerSourcePlayerId.trim();

  if (
    !primarySourcePlayerId ||
    !backupSourcePlayerId
  ) {
    throw new Error(
      "Select both a primary commissioner and a backup commissioner.",
    );
  }

  if (
    primarySourcePlayerId ===
    backupSourcePlayerId
  ) {
    throw new Error(
      "The same player cannot be both the primary and backup commissioner.",
    );
  }

  const primaryCommissioner =
    getActivePlayerBySourceIdOrThrow(
      plan,
      primarySourcePlayerId,
      "The selected primary commissioner must be an active future-season owner.",
    );
  const backupCommissioner =
    getActivePlayerBySourceIdOrThrow(
      plan,
      backupSourcePlayerId,
      "The selected backup commissioner must be an active future-season owner.",
    );

  const primaryEmail =
    primaryCommissioner.email
      ?.trim()
      .toLowerCase();
  const backupEmail =
    backupCommissioner.email
      ?.trim()
      .toLowerCase();

  if (
    primaryEmail &&
    backupEmail &&
    primaryEmail === backupEmail
  ) {
    throw new Error(
      "The primary and backup commissioners cannot use the same login email.",
    );
  }

  return touchPlan(
    {
      ...plan,
      players: plan.players.map((player) => {
        let role: PlayerRole = "player";

        if (
          player.sourcePlayerId ===
          primarySourcePlayerId
        ) {
          role = "commissioner";
        } else if (
          player.sourcePlayerId ===
          backupSourcePlayerId
        ) {
          role =
            "backup_commissioner";
        }

        return {
          ...player,
          role,
        };
      }),
    },
    updatedAt,
  );
}

export function swapFutureSeasonPlayerTeams(
  plan: FutureSeasonPlan,
  input: FutureSeasonTeamSwapInput,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  const firstSourcePlayerId =
    input.firstSourcePlayerId.trim();
  const secondSourcePlayerId =
    input.secondSourcePlayerId.trim();

  if (
    !firstSourcePlayerId ||
    !secondSourcePlayerId
  ) {
    throw new Error(
      "Select two active future-season owners to swap franchises.",
    );
  }

  if (
    firstSourcePlayerId ===
    secondSourcePlayerId
  ) {
    throw new Error(
      "Select two different future-season owners to swap franchises.",
    );
  }

  const firstPlayer =
    getActivePlayerBySourceIdOrThrow(
      plan,
      firstSourcePlayerId,
      "The first franchise owner must be active in the future-season plan.",
    );
  const secondPlayer =
    getActivePlayerBySourceIdOrThrow(
      plan,
      secondSourcePlayerId,
      "The second franchise owner must be active in the future-season plan.",
    );

  const firstTeam = normalizeTeam(
    firstPlayer.nflTeam,
  );
  const secondTeam = normalizeTeam(
    secondPlayer.nflTeam,
  );

  if (!firstTeam || !secondTeam) {
    throw new Error(
      "Both selected owners must have an NFL franchise before they can be swapped.",
    );
  }

  return touchPlan(
    {
      ...plan,
      players: plan.players.map((player) => {
        if (
          player.sourcePlayerId ===
          firstSourcePlayerId
        ) {
          return {
            ...player,
            nflTeam: secondTeam,
          };
        }

        if (
          player.sourcePlayerId ===
          secondSourcePlayerId
        ) {
          return {
            ...player,
            nflTeam: firstTeam,
          };
        }

        return player;
      }),
    },
    updatedAt,
  );
}

export function validateFutureSeasonPlan(
  plan: FutureSeasonPlan,
): FutureSeasonValidationResult {
  const issues: FutureSeasonValidationIssue[] = [];

  const addIssue = (
    issue: FutureSeasonValidationIssue,
  ) => {
    issues.push(issue);
  };

  if (
    !Number.isInteger(plan.sourceSeason) ||
    plan.sourceSeason <= 0
  ) {
    addIssue({
      code: "invalid-source-season",
      message:
        "The source season must be a positive whole number.",
    });
  }

  if (
    !Number.isInteger(plan.targetSeason) ||
    plan.targetSeason <= 0
  ) {
    addIssue({
      code: "invalid-target-season",
      message:
        "The target season must be a positive whole number.",
    });
  }

  if (
    Number.isInteger(plan.sourceSeason) &&
    Number.isInteger(plan.targetSeason) &&
    plan.targetSeason <=
      plan.sourceSeason
  ) {
    addIssue({
      code: "target-season-not-later",
      message:
        "The target season must be later than the current season.",
    });
  }

  if (!plan.leagueName.trim()) {
    addIssue({
      code: "missing-league-name",
      message:
        "The future season requires a league name.",
    });
  }

  const activePlayers =
    plan.players.filter(
      isFutureSeasonPlayerActive,
    );

  if (
    plan.players.length !==
      REQUIRED_ROSTER_SIZE ||
    activePlayers.length !==
      REQUIRED_ROSTER_SIZE
  ) {
    addIssue({
      code: "invalid-player-count",
      message: `The future season requires exactly ${REQUIRED_ROSTER_SIZE} active franchise owners.`,
    });
  }

  const playerIdOwners = new Map<
    string,
    string
  >();

  for (const player of plan.players) {
    const normalizedPlayerId =
      normalizeValue(player.playerId);

    if (
      normalizedPlayerId &&
      playerIdOwners.has(
        normalizedPlayerId,
      )
    ) {
      addIssue({
        code: "duplicate-player-id",
        message: `${player.name || "A player"} shares an account ID with another future-season player.`,
        playerId: player.playerId,
      });
    } else if (normalizedPlayerId) {
      playerIdOwners.set(
        normalizedPlayerId,
        player.playerId,
      );
    }
  }

  const playerNameOwners = new Map<
    string,
    string
  >();

  for (const player of activePlayers) {
    const normalizedName =
      normalizeValue(player.name);

    if (
      normalizedName &&
      playerNameOwners.has(normalizedName)
    ) {
      addIssue({
        code: "duplicate-player-name",
        message: `${player.name} appears more than once on the active future-season roster.`,
        playerId: player.playerId,
      });
    } else if (normalizedName) {
      playerNameOwners.set(
        normalizedName,
        player.playerId,
      );
    }
  }

  const teamOwners = new Map<
    string,
    string
  >();

  for (const player of activePlayers) {
    const normalizedTeam = normalizeTeam(
      player.nflTeam,
    );

    if (
      normalizedTeam &&
      teamOwners.has(normalizedTeam)
    ) {
      addIssue({
        code: "duplicate-nfl-team",
        message: `${normalizedTeam} is assigned to more than one active future-season player.`,
        playerId: player.playerId,
      });
    } else if (normalizedTeam) {
      teamOwners.set(
        normalizedTeam,
        player.playerId,
      );
    }
  }

  const recognizedTeams = new Set(
    NFL_TEAM_DATA.map((team) =>
      normalizeTeam(team.abbreviation),
    ),
  );
  const ownsEveryNFLTeam =
    teamOwners.size ===
      recognizedTeams.size &&
    [...recognizedTeams].every((team) =>
      teamOwners.has(team),
    );

  if (!ownsEveryNFLTeam) {
    addIssue({
      code: "invalid-player-count",
      message:
        "The active future-season roster must contain one owner for every recognized NFL franchise.",
    });
  }

  const primaryCommissioners =
    activePlayers.filter(
      (player) =>
        player.role === "commissioner",
    );
  const backupCommissioners =
    activePlayers.filter(
      (player) =>
        player.role ===
        "backup_commissioner",
    );

  if (primaryCommissioners.length === 0) {
    addIssue({
      code: "missing-primary-commissioner",
      message:
        "Select one primary commissioner for the future season.",
    });
  }

  if (primaryCommissioners.length > 1) {
    addIssue({
      code: "multiple-primary-commissioners",
      message:
        "Only one active player may be the primary commissioner.",
    });
  }

  if (backupCommissioners.length === 0) {
    addIssue({
      code: "missing-backup-commissioner",
      message:
        "Select one backup commissioner for the future season.",
    });
  }

  if (backupCommissioners.length > 1) {
    addIssue({
      code: "multiple-backup-commissioners",
      message:
        "Only one active player may be the backup commissioner.",
    });
  }

  const primaryEmail =
    primaryCommissioners[0]?.email
      ?.trim()
      .toLowerCase();
  const backupEmail =
    backupCommissioners[0]?.email
      ?.trim()
      .toLowerCase();

  if (
    primaryEmail &&
    backupEmail &&
    primaryEmail === backupEmail
  ) {
    addIssue({
      code: "same-commissioner-account",
      message:
        "The primary and backup commissioners cannot use the same login email.",
    });
  }

  for (const player of plan.players) {
    if (
      player.status === "inactive" ||
      player.rosterDecision === "inactive"
    ) {
      addIssue({
        code: "inactive-roster-player",
        message: `${player.name || "A player"} is not assigned to the active future-season roster.`,
        playerId: player.playerId,
      });
    }

    const returningLinkMismatch =
      player.rosterDecision ===
        "returning" &&
      (player.playerId !==
        player.sourcePlayerId ||
        !player.preservesCloudLink);
    const replacementLinkMismatch =
      player.rosterDecision ===
        "replacement" &&
      (player.playerId ===
        player.sourcePlayerId ||
        player.preservesCloudLink);

    if (
      returningLinkMismatch ||
      replacementLinkMismatch
    ) {
      addIssue({
        code: "replacement-preserves-cloud-link",
        message:
          player.rosterDecision ===
          "returning"
            ? `${player.name} must keep the existing player ID to preserve the linked cloud account.`
            : `${player.name} must use a new player ID so the previous player's cloud login is not transferred.`,
        playerId: player.playerId,
      });
    }
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

export function markFutureSeasonPlanReady(
  plan: FutureSeasonPlan,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  const validation =
    validateFutureSeasonPlan(plan);

  if (!validation.ready) {
    throw new Error(
      "The future-season plan cannot be marked ready until every validation issue is resolved.",
    );
  }

  return {
    ...plan,
    status: "ready",
    updatedAt: getTimestamp(updatedAt),
  };
}

export function reopenFutureSeasonPlan(
  plan: FutureSeasonPlan,
  updatedAt?: string,
): FutureSeasonPlan {
  assertPlanEditable(plan);

  return {
    ...plan,
    status: "draft",
    updatedAt: getTimestamp(updatedAt),
  };
}

export function getFutureSeasonPlanSummary(
  plan: FutureSeasonPlan,
) {
  const countDecision = (
    decision: FutureSeasonRosterDecision,
  ) =>
    plan.players.filter(
      (player) =>
        player.rosterDecision === decision,
    ).length;
  const validation =
    validateFutureSeasonPlan(plan);

  return {
    totalPlayers: plan.players.length,
    activePlayers: plan.players.filter(
      isFutureSeasonPlayerActive,
    ).length,
    returningPlayers:
      countDecision("returning"),
    replacementPlayers:
      countDecision("replacement"),
    inactivePlayers:
      countDecision("inactive"),
    preservedCloudLinks:
      plan.players.filter(
        (player) =>
          player.preservesCloudLink,
      ).length,
    issueCount: validation.issues.length,
    ready: validation.ready,
  };
}