import {
  PAYOUT_LEDGER_AMOUNTS_CENTS,
} from "./payoutLedgerEngine";
import type {
  PayoutLedgerCategory,
  PayoutLedgerSeasonState,
} from "./payoutLedgerTypes";

export type PayoutLedgerPlanCategory = Exclude<
  PayoutLedgerCategory,
  "player-buy-in" | "adjustment"
>;

export type PayoutLedgerPlanItem = {
  category: PayoutLedgerPlanCategory;
  label: string;
  expectedCount: number;
  amountCents: number;
  expectedTotalCents: number;
};

export type PayoutLedgerPlanLine =
  PayoutLedgerPlanItem & {
    actualCount: number;
    actualTotalCents: number;
    remainingCount: number;
    countDifference: number;
    amountDifferenceCents: number;
    status: "complete" | "missing" | "over" | "mismatch";
  };

export type PayoutLedgerReconciliation = {
  lines: PayoutLedgerPlanLine[];
  plannedPayoutsCents: number;
  recognizedOfficialPayoutsCents: number;
  adjustmentPayoutsCents: number;
  adjustmentCollectionsCents: number;
  fullLeagueBuyInsCents: number;
  plannedReserveCents: number;
  completeLineCount: number;
  issueLineCount: number;
};

export const PAYOUT_LEDGER_FULL_LEAGUE_PLAYER_COUNT = 32;

export const PAYOUT_LEDGER_PLAN: PayoutLedgerPlanItem[] = [
  {
    category: "obscure-stat-award",
    label: "Obscure-Stat Awards",
    expectedCount: 9,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.obscureStatAward,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.obscureStatAward * 9,
  },
  {
    category: "division-group-payout",
    label: "Division Group Shares",
    expectedCount: 4,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionPlayerShare,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionGroupTotal,
  },
  {
    category: "afc-winner",
    label: "AFC Winner",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.afcWinner,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.afcWinner,
  },
  {
    category: "nfc-winner",
    label: "NFC Winner",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.nfcWinner,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.nfcWinner,
  },
  {
    category: "wild-card-loser",
    label: "Wild Card Losers",
    expectedCount: 6,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.wildCardLoser,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.wildCardLoser * 6,
  },
  {
    category: "divisional-loser",
    label: "Divisional Losers",
    expectedCount: 4,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionalLoser,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionalLoser * 4,
  },
  {
    category: "conference-loser",
    label: "Conference Losers",
    expectedCount: 2,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.conferenceLoser,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.conferenceLoser * 2,
  },
  {
    category: "super-bowl-loser",
    label: "Super Bowl Runner-Up",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlLoser,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlLoser,
  },
  {
    category: "super-bowl-winner",
    label: "Super Bowl Champion",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlWinner,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlWinner,
  },
  {
    category: "biggest-winner",
    label: "Biggest Winner",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestWinner,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestWinner,
  },
  {
    category: "biggest-loser",
    label: "Biggest Loser",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestLoser,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestLoser,
  },
  {
    category: "last-to-lose",
    label: "Last to Lose",
    expectedCount: 1,
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.lastToLose,
    expectedTotalCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.lastToLose,
  },
];

export const PAYOUT_LEDGER_PLANNED_PAYOUTS_CENTS =
  PAYOUT_LEDGER_PLAN.reduce(
    (total, item) => total + item.expectedTotalCents,
    0,
  );

export const PAYOUT_LEDGER_FULL_LEAGUE_BUY_INS_CENTS =
  PAYOUT_LEDGER_FULL_LEAGUE_PLAYER_COUNT *
  PAYOUT_LEDGER_AMOUNTS_CENTS.playerBuyIn;

export const PAYOUT_LEDGER_PLANNED_RESERVE_CENTS =
  PAYOUT_LEDGER_FULL_LEAGUE_BUY_INS_CENTS -
  PAYOUT_LEDGER_PLANNED_PAYOUTS_CENTS;

function getPlanLineStatus(
  actualCount: number,
  expectedCount: number,
  actualTotalCents: number,
  expectedTotalCents: number,
): PayoutLedgerPlanLine["status"] {
  if (
    actualCount === expectedCount &&
    actualTotalCents === expectedTotalCents
  ) {
    return "complete";
  }

  if (
    actualCount > expectedCount ||
    actualTotalCents > expectedTotalCents
  ) {
    return "over";
  }

  if (
    actualCount === expectedCount ||
    actualTotalCents === expectedTotalCents
  ) {
    return "mismatch";
  }

  return "missing";
}

export function buildPayoutLedgerReconciliation(
  ledger: PayoutLedgerSeasonState,
): PayoutLedgerReconciliation {
  const entries = Object.values(ledger.entries);

  const lines = PAYOUT_LEDGER_PLAN.map((item) => {
    const categoryEntries = entries.filter(
      (entry) =>
        entry.direction === "payout" &&
        entry.category === item.category,
    );

    const actualCount = categoryEntries.length;
    const actualTotalCents = categoryEntries.reduce(
      (total, entry) => total + entry.amountCents,
      0,
    );

    return {
      ...item,
      actualCount,
      actualTotalCents,
      remainingCount: Math.max(
        item.expectedCount - actualCount,
        0,
      ),
      countDifference:
        actualCount - item.expectedCount,
      amountDifferenceCents:
        actualTotalCents - item.expectedTotalCents,
      status: getPlanLineStatus(
        actualCount,
        item.expectedCount,
        actualTotalCents,
        item.expectedTotalCents,
      ),
    };
  });

  const adjustmentPayoutsCents = entries
    .filter(
      (entry) =>
        entry.category === "adjustment" &&
        entry.direction === "payout",
    )
    .reduce(
      (total, entry) => total + entry.amountCents,
      0,
    );

  const adjustmentCollectionsCents = entries
    .filter(
      (entry) =>
        entry.category === "adjustment" &&
        entry.direction === "collection",
    )
    .reduce(
      (total, entry) => total + entry.amountCents,
      0,
    );

  const recognizedOfficialPayoutsCents = lines.reduce(
    (total, line) => total + line.actualTotalCents,
    0,
  );

  const completeLineCount = lines.filter(
    (line) => line.status === "complete",
  ).length;

  return {
    lines,
    plannedPayoutsCents:
      PAYOUT_LEDGER_PLANNED_PAYOUTS_CENTS,
    recognizedOfficialPayoutsCents,
    adjustmentPayoutsCents,
    adjustmentCollectionsCents,
    fullLeagueBuyInsCents:
      PAYOUT_LEDGER_FULL_LEAGUE_BUY_INS_CENTS,
    plannedReserveCents:
      PAYOUT_LEDGER_PLANNED_RESERVE_CENTS,
    completeLineCount,
    issueLineCount: lines.length - completeLineCount,
  };
}

export function getPayoutLedgerCategoryRemainingSlots(
  ledger: PayoutLedgerSeasonState,
  category: PayoutLedgerCategory,
): number | null {
  if (
    category === "adjustment" ||
    category === "player-buy-in"
  ) {
    return null;
  }

  const planItem = PAYOUT_LEDGER_PLAN.find(
    (item) => item.category === category,
  );

  if (!planItem) {
    return null;
  }

  const actualCount = Object.values(ledger.entries).filter(
    (entry) =>
      entry.direction === "payout" &&
      entry.category === category,
  ).length;

  return Math.max(
    planItem.expectedCount - actualCount,
    0,
  );
}
