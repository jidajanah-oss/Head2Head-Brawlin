import type {
  ObscureStatAwardResult,
} from "./obscureStatAwardTypes";
import {
  createPayoutLedgerEntry,
} from "./payoutLedgerEngine";
import type {
  PayoutLedgerEntry,
  PayoutLedgerSeasonState,
} from "./payoutLedgerTypes";

export type ObscureStatPayoutSyncAction =
  | { type: "none" }
  | {
      type: "upsert";
      entry: PayoutLedgerEntry;
    }
  | {
      type: "remove";
      entryId: string;
    };

const UNRESOLVED_PAID_REVIEW_NOTE =
  "This award is no longer resolved after being marked paid. Verify the previous payment before clearing review.";

function assertPositiveWeek(week: number): void {
  if (
    !Number.isInteger(week) ||
    week <= 0
  ) {
    throw new Error(
      "Obscure-stat payout week must be a positive integer.",
    );
  }
}

function appendNote(
  currentNote: string,
  message: string,
): string {
  const normalizedNote = currentNote.trim();

  if (normalizedNote.includes(message)) {
    return normalizedNote;
  }

  return normalizedNote
    ? `${normalizedNote}\n${message}`
    : message;
}

function entriesMatch(
  currentEntry: PayoutLedgerEntry,
  nextEntry: PayoutLedgerEntry,
): boolean {
  return (
    currentEntry.id === nextEntry.id &&
    currentEntry.season === nextEntry.season &&
    currentEntry.playerId === nextEntry.playerId &&
    currentEntry.playerName === nextEntry.playerName &&
    currentEntry.nflTeam === nextEntry.nflTeam &&
    currentEntry.direction === nextEntry.direction &&
    currentEntry.category === nextEntry.category &&
    currentEntry.origin === nextEntry.origin &&
    currentEntry.amountCents === nextEntry.amountCents &&
    currentEntry.status === nextEntry.status &&
    currentEntry.sourceKey === nextEntry.sourceKey &&
    currentEntry.sourceLabel === nextEntry.sourceLabel &&
    currentEntry.note === nextEntry.note &&
    currentEntry.createdAt === nextEntry.createdAt &&
    currentEntry.paidAt === nextEntry.paidAt &&
    currentEntry.needsReview === nextEntry.needsReview
  );
}

function getWinnerChangedReviewNote(
  existingEntry: PayoutLedgerEntry,
): string {
  const previousTeam =
    existingEntry.nflTeam.trim() ||
    "No NFL team";

  return (
    "This paid award changed after resolution. " +
    `Previous recipient: ${existingEntry.playerName} (${previousTeam}). ` +
    "Verify the payment and correct the ledger before clearing review."
  );
}

function isDefinitivelyUnresolved(
  result: ObscureStatAwardResult,
): boolean {
  return (
    result.status === "coin-flip-required" ||
    result.status === "no-award"
  );
}

export function getObscureStatPayoutEntryId(
  season: number,
  week: number,
): string {
  if (
    !Number.isInteger(season) ||
    season <= 0
  ) {
    throw new Error(
      "Obscure-stat payout season must be a positive integer.",
    );
  }

  assertPositiveWeek(week);

  return `${season}:obscure-stat-award:week-${week}`;
}

export function getObscureStatPayoutSyncAction(
  ledger: PayoutLedgerSeasonState,
  result: ObscureStatAwardResult,
  timestamp?: string,
): ObscureStatPayoutSyncAction {
  if (ledger.season !== result.season) {
    return { type: "none" };
  }

  const entryId =
    getObscureStatPayoutEntryId(
      result.season,
      result.week,
    );

  const existingEntry =
    ledger.entries[entryId];

  if (
    result.status === "resolved" &&
    result.winner &&
    result.rule.status === "active"
  ) {
    const amountCents = Math.round(
      result.rule.payoutDollars * 100,
    );

    if (amountCents <= 0) {
      return { type: "none" };
    }

    const sourceLabel =
      `Week ${result.week}: ${result.rule.label}`;

    if (!existingEntry) {
      return {
        type: "upsert",
        entry: createPayoutLedgerEntry(
          {
            id: entryId,
            season: result.season,
            playerId:
              result.winner.playerId,
            playerName:
              result.winner.playerName,
            nflTeam:
              result.winner.nflTeam,
            direction: "payout",
            category:
              "obscure-stat-award",
            origin: "automatic",
            amountCents,
            sourceKey: result.id,
            sourceLabel,
            note: "",
          },
          timestamp,
        ),
      };
    }

    if (
      existingEntry.category !==
        "obscure-stat-award" ||
      existingEntry.origin !== "automatic"
    ) {
      return { type: "none" };
    }

    const recipientChanged =
      existingEntry.playerId !==
        result.winner.playerId ||
      existingEntry.playerName !==
        result.winner.playerName ||
      existingEntry.nflTeam !==
        result.winner.nflTeam;

    const amountChanged =
      existingEntry.amountCents !==
      amountCents;

    const paidEntryChanged =
      existingEntry.status === "paid" &&
      (recipientChanged || amountChanged);

    const nextEntry: PayoutLedgerEntry = {
      ...existingEntry,
      season: result.season,
      playerId: result.winner.playerId,
      playerName:
        result.winner.playerName,
      nflTeam: result.winner.nflTeam,
      direction: "payout",
      category: "obscure-stat-award",
      origin: "automatic",
      amountCents,
      sourceKey: result.id,
      sourceLabel,
      note: paidEntryChanged
        ? appendNote(
            existingEntry.note,
            getWinnerChangedReviewNote(
              existingEntry,
            ),
          )
        : existingEntry.note,
      needsReview:
        existingEntry.needsReview ||
        paidEntryChanged,
    };

    if (
      entriesMatch(
        existingEntry,
        nextEntry,
      )
    ) {
      return { type: "none" };
    }

    return {
      type: "upsert",
      entry: nextEntry,
    };
  }

  if (
    !existingEntry ||
    !isDefinitivelyUnresolved(result)
  ) {
    return { type: "none" };
  }

  if (existingEntry.status === "unpaid") {
    return {
      type: "remove",
      entryId,
    };
  }

  const reviewedEntry: PayoutLedgerEntry = {
    ...existingEntry,
    note: appendNote(
      existingEntry.note,
      UNRESOLVED_PAID_REVIEW_NOTE,
    ),
    needsReview: true,
  };

  if (
    entriesMatch(
      existingEntry,
      reviewedEntry,
    )
  ) {
    return { type: "none" };
  }

  return {
    type: "upsert",
    entry: reviewedEntry,
  };
}
