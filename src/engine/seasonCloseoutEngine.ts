import {
  buildPayoutLedgerSummary,
} from "./payoutLedgerEngine";
import {
  buildPayoutLedgerReconciliation,
} from "./payoutLedgerPlan";
import {
  SEASON_AWARD_CATEGORIES,
} from "./seasonAwardEngine";
import type {
  CreateSeasonCloseoutArchiveInput,
  SeasonCloseoutArchive,
  SeasonCloseoutArchiveHistory,
  SeasonCloseoutCheck,
  SeasonCloseoutEvaluation,
  SeasonCloseoutEvaluationInput,
  SeasonCloseoutLockedArea,
} from "./seasonCloseoutTypes";

export const SEASON_CLOSEOUT_LOCK_SCOPE:
  SeasonCloseoutLockedArea[] = [
    "scoring",
    "playoffs",
    "season-awards",
    "payout-ledger",
  ];

function getTimestamp(
  timestamp?: string,
): string {
  return (
    timestamp?.trim() ||
    new Date().toISOString()
  );
}

function assertPositiveSeason(
  season: number,
): void {
  if (
    !Number.isInteger(season) ||
    season <= 0
  ) {
    throw new Error(
      "Season closeout requires a positive integer season.",
    );
  }
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function buildCheck(
  code: SeasonCloseoutCheck["code"],
  label: string,
  passed: boolean,
  detail: string,
): SeasonCloseoutCheck {
  return {
    code,
    label,
    passed,
    detail,
  };
}

export function getSeasonCloseoutArchiveId(
  season: number,
): string {
  assertPositiveSeason(season);

  return `${season}-season-closeout`;
}

export function getSeasonCloseoutConfirmationPhrase(
  season: number,
): string {
  assertPositiveSeason(season);

  return `CLOSE ${season}`;
}

export function buildSeasonCloseoutEvaluation(
  input: SeasonCloseoutEvaluationInput,
): SeasonCloseoutEvaluation {
  assertPositiveSeason(input.season);

  if (
    input.payoutLedger.season !==
    input.season
  ) {
    throw new Error(
      "Payout ledger season does not match the season being closed.",
    );
  }

  if (
    input.playoffSeason &&
    input.playoffSeason.season !==
      input.season
  ) {
    throw new Error(
      "Playoff season does not match the season being closed.",
    );
  }

  const evaluatedAt = getTimestamp(
    input.evaluatedAt,
  );

  const scoringRecords = Object.values(
    input.scoringHistory,
  ).filter(
    (record) =>
      record.season === input.season,
  );

  const week18Finalized =
    scoringRecords.some(
      (record) => record.week === 18,
    );

  const unresolvedAwardNames =
    SEASON_AWARD_CATEGORIES.filter(
      (category) => {
        const result =
          input.seasonAwards[category];

        return !(
          result.season === input.season &&
          result.isSeasonFinal &&
          result.status === "resolved" &&
          Boolean(result.winner)
        );
      },
    ).map(
      (category) =>
        input.seasonAwards[category].title,
    );

  const awardsResolved =
    unresolvedAwardNames.length === 0;

  const playoffsComplete = Boolean(
    input.playoffSeason &&
      input.playoffSeason.status ===
        "complete" &&
      input.playoffSeason.championId,
  );

  const summary = buildPayoutLedgerSummary(
    input.payoutLedger,
  );

  const reconciliation =
    buildPayoutLedgerReconciliation(
      input.payoutLedger,
    );

  const entries = Object.values(
    input.payoutLedger.entries,
  );

  const buyInEntries = entries.filter(
    (entry) =>
      entry.direction === "collection" &&
      entry.category === "player-buy-in",
  );

  const unpaidBuyIns = buyInEntries.filter(
    (entry) => entry.status !== "paid",
  );

  const payoutEntries = entries.filter(
    (entry) => entry.direction === "payout",
  );

  const unpaidPayouts = payoutEntries.filter(
    (entry) => entry.status !== "paid",
  );

  const expectedFinalBalanceCents =
    reconciliation.plannedReserveCents +
    reconciliation.adjustmentCollectionsCents -
    reconciliation.adjustmentPayoutsCents;

  const checks: SeasonCloseoutCheck[] = [
    buildCheck(
      "week-18-finalized",
      "Week 18 scoring finalized",
      week18Finalized,
      week18Finalized
        ? "A finalized Week 18 scoring record is present."
        : "Week 18 scoring has not been finalized.",
    ),
    buildCheck(
      "season-awards-resolved",
      "Season awards resolved",
      awardsResolved,
      awardsResolved
        ? "Biggest Winner, Biggest Loser, and Last to Lose are resolved."
        : `Unresolved awards: ${unresolvedAwardNames.join(
            ", ",
          )}.`,
    ),
    buildCheck(
      "playoffs-complete",
      "Playoff bracket complete",
      playoffsComplete,
      playoffsComplete
        ? "The playoff bracket is complete and a champion is recorded."
        : "The playoff bracket is incomplete or has no champion.",
    ),
    buildCheck(
      "payout-plan-reconciled",
      "Official payout plan reconciled",
      reconciliation.issueLineCount === 0,
      reconciliation.issueLineCount === 0
        ? "Every official payout category matches the season prize plan."
        : `${reconciliation.issueLineCount} payout-plan categor${
            reconciliation.issueLineCount === 1
              ? "y has"
              : "ies have"
          } unresolved differences.`,
    ),
    buildCheck(
      "no-ledger-review",
      "No ledger review flags",
      summary.reviewEntryCount === 0,
      summary.reviewEntryCount === 0
        ? "No payout-ledger entries require commissioner review."
        : `${summary.reviewEntryCount} ledger entr${
            summary.reviewEntryCount === 1
              ? "y requires"
              : "ies require"
          } commissioner review.`,
    ),
    buildCheck(
      "buy-ins-paid",
      "All player buy-ins paid",
      buyInEntries.length > 0 &&
        unpaidBuyIns.length === 0,
      buyInEntries.length === 0
        ? "No player buy-in entries exist."
        : unpaidBuyIns.length === 0
          ? `All ${buyInEntries.length} player buy-ins are marked paid.`
          : `${unpaidBuyIns.length} of ${buyInEntries.length} player buy-ins remain unpaid.`,
    ),
    buildCheck(
      "payouts-paid",
      "All recognized payouts paid",
      payoutEntries.length > 0 &&
        unpaidPayouts.length === 0,
      payoutEntries.length === 0
        ? "No payout entries exist."
        : unpaidPayouts.length === 0
          ? `All ${payoutEntries.length} recognized payouts are marked paid.`
          : `${unpaidPayouts.length} of ${payoutEntries.length} recognized payouts remain unpaid.`,
    ),
    buildCheck(
      "reserve-balanced",
      "Final balance matches planned reserve",
      summary.currentBalanceCents ===
        expectedFinalBalanceCents,
      summary.currentBalanceCents ===
      expectedFinalBalanceCents
        ? "The final cash balance matches the planned reserve after adjustments."
        : `Current balance is ${summary.currentBalanceCents} cents; expected ${expectedFinalBalanceCents} cents after adjustments.`,
    ),
  ];

  const unresolvedChecks = checks.filter(
    (check) => !check.passed,
  );

  return {
    season: input.season,
    evaluatedAt,
    confirmationPhrase:
      getSeasonCloseoutConfirmationPhrase(
        input.season,
      ),
    canCloseNormally:
      unresolvedChecks.length === 0,
    checks,
    unresolvedChecks,
    financials: {
      plannedPayoutsCents:
        reconciliation.plannedPayoutsCents,
      recognizedOfficialPayoutsCents:
        reconciliation.recognizedOfficialPayoutsCents,
      adjustmentPayoutsCents:
        reconciliation.adjustmentPayoutsCents,
      adjustmentCollectionsCents:
        reconciliation.adjustmentCollectionsCents,
      collectedCents: summary.collectedCents,
      paidPayoutsCents:
        summary.paidPayoutsCents,
      currentBalanceCents:
        summary.currentBalanceCents,
      expectedFinalBalanceCents,
      plannedReserveCents:
        reconciliation.plannedReserveCents,
    },
  };
}

export function createSeasonCloseoutArchive(
  input: CreateSeasonCloseoutArchiveInput,
): SeasonCloseoutArchive {
  const closedAt = getTimestamp(
    input.closedAt,
  );

  const evaluation =
    buildSeasonCloseoutEvaluation({
      season: input.season,
      scoringHistory:
        input.scoringHistory,
      seasonAwards: input.seasonAwards,
      playoffSeason: input.playoffSeason,
      payoutLedger: input.payoutLedger,
      evaluatedAt: closedAt,
    });

  const confirmationText =
    input.confirmationText.trim();

  if (
    confirmationText !==
    evaluation.confirmationPhrase
  ) {
    throw new Error(
      `Type ${evaluation.confirmationPhrase} exactly to close the season.`,
    );
  }

  if (
    input.mode === "normal" &&
    !evaluation.canCloseNormally
  ) {
    throw new Error(
      "Normal season closeout is blocked until every required check passes.",
    );
  }

  const overrideReason =
    input.overrideReason?.trim() ?? "";

  if (
    input.mode === "override" &&
    !overrideReason
  ) {
    throw new Error(
      "A written commissioner reason is required for override closeout.",
    );
  }

  const payoutSummary =
    buildPayoutLedgerSummary(
      input.payoutLedger,
    );

  const payoutReconciliation =
    buildPayoutLedgerReconciliation(
      input.payoutLedger,
    );

  return {
    id: getSeasonCloseoutArchiveId(
      input.season,
    ),
    season: input.season,
    status:
      input.mode === "override"
        ? "closed-with-override"
        : "closed",
    closedAt,
    closedBy: "commissioner",
    confirmationPhrase:
      evaluation.confirmationPhrase,
    overrideReason:
      input.mode === "override"
        ? overrideReason
        : null,
    unresolvedChecks: cloneSnapshot(
      evaluation.unresolvedChecks,
    ),
    checks: cloneSnapshot(
      evaluation.checks,
    ),
    financials: cloneSnapshot(
      evaluation.financials,
    ),
    lockScope: [
      ...SEASON_CLOSEOUT_LOCK_SCOPE,
    ],
    snapshot: cloneSnapshot(
      input.snapshot,
    ),
    payoutSummary: cloneSnapshot(
      payoutSummary,
    ),
    payoutReconciliation: cloneSnapshot(
      payoutReconciliation,
    ),
  };
}

export function isSeasonClosed(
  history: SeasonCloseoutArchiveHistory,
  season: number,
): boolean {
  return Boolean(
    history[
      getSeasonCloseoutArchiveId(season)
    ],
  );
}

export function assertSeasonMutationAllowed(
  history: SeasonCloseoutArchiveHistory,
  season: number,
  area: SeasonCloseoutLockedArea,
): void {
  const archive =
    history[
      getSeasonCloseoutArchiveId(season)
    ];

  if (
    archive &&
    archive.lockScope.includes(area)
  ) {
    throw new Error(
      `Season ${season} is closed. ${area} records are locked.`,
    );
  }
}
