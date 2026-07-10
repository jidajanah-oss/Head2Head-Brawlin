export type PickerClickerFallbackStatus =
  | "copied"
  | "no-source-pick";

export type PickerClickerAssignment = {
  id: string;
  season: number;
  week: number;

  sourcePlayerId: string;
  sourcePlayerName: string;
  sourceNFLTeam: string;

  cycleNumber: number;
  assignedAt: string;
};

export type PickerClickerFallbackPick = {
  id: string;
  season: number;
  week: number;
  gameId: string;

  playerId: string;
  sourcePlayerId: string;

  team: string | null;
  status: PickerClickerFallbackStatus;

  appliedAt: string;
};

export type PickerClickerPlayerFallbacks = Record<
  string,
  PickerClickerFallbackPick
>;

export type PickerClickerWeekFallbacks = Record<
  string,
  PickerClickerPlayerFallbacks
>;

export type PickerClickerWeekState = {
  id: string;
  season: number;
  week: number;

  assignment: PickerClickerAssignment;

  fallbackPicks: PickerClickerWeekFallbacks;
  ineligiblePlayerIds: string[];
  lockedGameIds: string[];

  updatedAt: string;
};

export type PickerClickerHistory = Record<
  string,
  PickerClickerWeekState
>;

export type EffectivePickSource =
  | "manual"
  | "picker-clicker"
  | "missing";

export type EffectivePlayerPick = {
  playerId: string;
  gameId: string;

  team: string | null;
  source: EffectivePickSource;

  sourcePlayerId: string | null;
  weeklyPrizeEligible: boolean;
};

export function getPickerClickerWeekId(
  season: number,
  week: number
) {
  return `${season}-week-${week}`;
}

export function getPickerClickerAssignmentId(
  season: number,
  week: number
) {
  return `${getPickerClickerWeekId(
    season,
    week
  )}-assignment`;
}

export function getPickerClickerFallbackPickId(
  season: number,
  week: number,
  playerId: string,
  gameId: string
) {
  return `${getPickerClickerWeekId(
    season,
    week
  )}-${playerId}-${gameId}`;
}