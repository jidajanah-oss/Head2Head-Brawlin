import type {
  ObscureStatDirection,
  ObscureStatMetric,
  ObscureStatRule,
  ObscureStatValueUnit,
} from "./obscureStatTypes";

const FIRST_REGULAR_SEASON_WEEK = 1;
const LAST_REGULAR_SEASON_WEEK = 18;
const OBSCURE_STAT_PAYOUT_DOLLARS = 5;

type ActiveRuleOptions = {
  week: number;
  metric: ObscureStatMetric;
  label: string;
  direction: ObscureStatDirection;
  valueUnit: ObscureStatValueUnit;
  displayDecimals: number;
};

function createActiveRule({
  week,
  metric,
  label,
  direction,
  valueUnit,
  displayDecimals,
}: ActiveRuleOptions): ObscureStatRule {
  return {
    week,
    status: "active",
    metric,
    label,
    direction,
    payoutDollars:
      OBSCURE_STAT_PAYOUT_DOLLARS,
    valueUnit,
    displayDecimals,
  };
}

function createNoAwardRule(
  week: number,
): ObscureStatRule {
  return {
    week,
    status: "no-award",
    metric: null,
    label: "No Obscure Stat Award",
    direction: null,
    payoutDollars: 0,
    valueUnit: null,
    displayDecimals: 0,
  };
}

export const OBSCURE_STAT_RULES:
  readonly ObscureStatRule[] = [
  createActiveRule({
    week: 1,
    metric: "yards-per-play",
    label: "Yards per Play",
    direction: "highest",
    valueUnit: "ratio",
    displayDecimals: 2,
  }),

  createActiveRule({
    week: 2,
    metric: "opponent-yards-per-play",
    label: "Opponent Yards per Play",
    direction: "lowest",
    valueUnit: "ratio",
    displayDecimals: 2,
  }),

  createActiveRule({
    week: 3,
    metric: "first-downs-per-play",
    label: "First Downs per Play",
    direction: "highest",
    valueUnit: "ratio",
    displayDecimals: 3,
  }),

  createActiveRule({
    week: 4,
    metric: "opponent-third-down-plays",
    label: "Opponent Total Third-Down Plays",
    direction: "lowest",
    valueUnit: "plays",
    displayDecimals: 0,
  }),

  createNoAwardRule(5),
  createNoAwardRule(6),
  createNoAwardRule(7),
  createNoAwardRule(8),
  createNoAwardRule(9),
  createNoAwardRule(10),
  createNoAwardRule(11),

  createActiveRule({
    week: 12,
    metric: "punts-per-play",
    label: "Punts per Play",
    direction: "lowest",
    valueUnit: "ratio",
    displayDecimals: 3,
  }),

  createNoAwardRule(13),
  createNoAwardRule(14),

  createActiveRule({
    week: 15,
    metric:
      "opponent-yards-per-pass-attempt",
    label:
      "Opponent Yards per Pass Attempt",
    direction: "lowest",
    valueUnit: "ratio",
    displayDecimals: 2,
  }),

  createActiveRule({
    week: 16,
    metric: "rushing-yards-per-play",
    label: "Rushing Yards per Play",
    direction: "highest",
    valueUnit: "ratio",
    displayDecimals: 2,
  }),

  createActiveRule({
    week: 17,
    metric:
      "opponent-yards-per-rushing-attempt",
    label:
      "Opponent Yards per Rushing Attempt",
    direction: "lowest",
    valueUnit: "ratio",
    displayDecimals: 2,
  }),

  createActiveRule({
    week: 18,
    metric:
      "average-time-of-possession",
    label: "Average Time of Possession",
    direction: "highest",
    valueUnit: "seconds",
    displayDecimals: 0,
  }),
];

export function getObscureStatRule(
  week: number,
): ObscureStatRule {
  if (
    !Number.isInteger(week) ||
    week < FIRST_REGULAR_SEASON_WEEK ||
    week > LAST_REGULAR_SEASON_WEEK
  ) {
    return createNoAwardRule(week);
  }

  return (
    OBSCURE_STAT_RULES.find(
      (rule) => rule.week === week,
    ) ?? createNoAwardRule(week)
  );
}

export function isObscureStatAwardWeek(
  week: number,
): boolean {
  return (
    getObscureStatRule(week).status ===
    "active"
  );
}

export function getActiveObscureStatRules():
  readonly ObscureStatRule[] {
  return OBSCURE_STAT_RULES.filter(
    (rule) => rule.status === "active",
  );
}