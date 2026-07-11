export type ObscureStatMetric =
  | "yards-per-play"
  | "opponent-yards-per-play"
  | "first-downs-per-play"
  | "opponent-third-down-plays"
  | "punts-per-play"
  | "opponent-yards-per-pass-attempt"
  | "rushing-yards-per-play"
  | "opponent-yards-per-rushing-attempt"
  | "average-time-of-possession";

export type ObscureStatDirection =
  | "highest"
  | "lowest";

export type ObscureStatWeekStatus =
  | "active"
  | "no-award";

export type ObscureStatValueUnit =
  | "ratio"
  | "plays"
  | "seconds";

export type ObscureStatRule = {
  week: number;
  status: ObscureStatWeekStatus;
  metric: ObscureStatMetric | null;
  label: string;
  direction: ObscureStatDirection | null;
  payoutDollars: number;
  valueUnit: ObscureStatValueUnit | null;
  displayDecimals: number;
};

export type ObscureStatTieBreaker =
  | "weekly-correct-picks"
  | "league-points"
  | "assigned-nfl-team-win"
  | "offline-coin-flip";

export const OBSCURE_STAT_TIEBREAK_ORDER:
  readonly ObscureStatTieBreaker[] = [
  "weekly-correct-picks",
  "league-points",
  "assigned-nfl-team-win",
  "offline-coin-flip",
] as const;