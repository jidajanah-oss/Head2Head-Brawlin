export const FIRST_REGULAR_SEASON_WEEK = 1;
export const LAST_REGULAR_SEASON_WEEK = 18;

export type WeekControlState = {
  currentWeek: number;
  previousWeek: number;
  nextWeek: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  progressPercent: number;
};

export function clampRegularSeasonWeek(
  week: number,
): number {
  if (!Number.isFinite(week)) {
    return FIRST_REGULAR_SEASON_WEEK;
  }

  const normalizedWeek = Math.trunc(week);

  return Math.min(
    LAST_REGULAR_SEASON_WEEK,
    Math.max(
      FIRST_REGULAR_SEASON_WEEK,
      normalizedWeek,
    ),
  );
}

export function isValidRegularSeasonWeek(
  week: number,
): boolean {
  return (
    Number.isInteger(week) &&
    week >= FIRST_REGULAR_SEASON_WEEK &&
    week <= LAST_REGULAR_SEASON_WEEK
  );
}

export function getPreviousRegularSeasonWeek(
  currentWeek: number,
): number {
  return clampRegularSeasonWeek(
    currentWeek - 1,
  );
}

export function getNextRegularSeasonWeek(
  currentWeek: number,
): number {
  return clampRegularSeasonWeek(
    currentWeek + 1,
  );
}

export function getWeekControlState(
  currentWeek: number,
): WeekControlState {
  const normalizedWeek =
    clampRegularSeasonWeek(currentWeek);

  const completedWeekCount =
    normalizedWeek -
    FIRST_REGULAR_SEASON_WEEK;

  const totalWeekTransitions =
    LAST_REGULAR_SEASON_WEEK -
    FIRST_REGULAR_SEASON_WEEK;

  const progressPercent =
    totalWeekTransitions > 0
      ? Math.round(
          (completedWeekCount /
            totalWeekTransitions) *
            100,
        )
      : 100;

  return {
    currentWeek: normalizedWeek,
    previousWeek:
      getPreviousRegularSeasonWeek(
        normalizedWeek,
      ),
    nextWeek:
      getNextRegularSeasonWeek(
        normalizedWeek,
      ),
    canGoPrevious:
      normalizedWeek >
      FIRST_REGULAR_SEASON_WEEK,
    canGoNext:
      normalizedWeek <
      LAST_REGULAR_SEASON_WEEK,
    progressPercent,
  };
}