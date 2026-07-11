import {
  createPayoutLedgerEntry,
  PAYOUT_LEDGER_AMOUNTS_CENTS,
} from "./payoutLedgerEngine";
import type {
  PayoutLedgerEntry,
  PayoutLedgerSeasonState,
} from "./payoutLedgerTypes";
import {
  SEASON_AWARD_CATEGORIES,
} from "./seasonAwardEngine";
import type {
  SeasonAwardCategory,
  SeasonAwardResult,
  SeasonAwardResults,
} from "./seasonAwardTypes";

export type SeasonAwardPayoutSyncAction =
  | { type: "none" }
  | {
      type: "upsert";
      entry: PayoutLedgerEntry;
    }
  | {
      type: "remove";
      entryId: string;
    };

const SEASON_AWARD_SOURCE_PREFIX =
  "season-award:";

const STALE_PAID_REVIEW_NOTE =
  "This paid season-award payout no longer matches a finalized season result. Verify the previous payment before clearing review.";

const CATEGORY_AMOUNTS_CENTS: Record<
  SeasonAwardCategory,
  number
> = {
  "biggest-winner":
    PAYOUT_LEDGER_AMOUNTS_CENTS.biggestWinner,
  "biggest-loser":
    PAYOUT_LEDGER_AMOUNTS_CENTS.biggestLoser,
  "last-to-lose":
    PAYOUT_LEDGER_AMOUNTS_CENTS.lastToLose,
};

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

function isFinalResolvedResult(
  result: SeasonAwardResult,
): boolean {
  return (
    result.isSeasonFinal &&
    result.status === "resolved" &&
    Boolean(result.winner)
  );
}

function getRecipientChangedReviewNote(
  existingEntry: PayoutLedgerEntry,
): string {
  const previousTeam =
    existingEntry.nflTeam.trim() ||
    "No NFL team";

  return (
    "This paid season-award payout changed after the official season result was edited. " +
    `Previous recipient: ${existingEntry.playerName} (${previousTeam}). ` +
    "Verify the payment and correct the ledger before clearing review."
  );
}

function getSeasonAwardSourceKey(
  result: SeasonAwardResult,
): string {
  return `${SEASON_AWARD_SOURCE_PREFIX}${result.id}`;
}

export function getSeasonAwardPayoutEntryId(
  season: number,
  category: SeasonAwardCategory,
): string {
  if (
    !Number.isInteger(season) ||
    season <= 0
  ) {
    throw new Error(
      "Season-award payout season must be a positive integer.",
    );
  }

  return `${season}:season-award-payout:${category}`;
}

function createDesiredEntry(
  result: SeasonAwardResult,
  timestamp?: string,
): PayoutLedgerEntry | null {
  if (
    !isFinalResolvedResult(result) ||
    !result.winner
  ) {
    return null;
  }

  return createPayoutLedgerEntry(
    {
      id: getSeasonAwardPayoutEntryId(
        result.season,
        result.category,
      ),
      season: result.season,
      playerId: result.winner.playerId,
      playerName: result.winner.playerName,
      nflTeam: result.winner.nflTeam,
      direction: "payout",
      category: result.category,
      origin: "automatic",
      amountCents:
        CATEGORY_AMOUNTS_CENTS[
          result.category
        ],
      sourceKey:
        getSeasonAwardSourceKey(result),
      sourceLabel: `${result.title} — ${result.season} regular season`,
      note: "",
    },
    timestamp,
  );
}

function isAutomaticSeasonAwardEntry(
  entry: PayoutLedgerEntry,
): boolean {
  return (
    entry.origin === "automatic" &&
    entry.direction === "payout" &&
    entry.sourceKey.startsWith(
      SEASON_AWARD_SOURCE_PREFIX,
    )
  );
}

function hasEquivalentManualEntry(
  ledger: PayoutLedgerSeasonState,
  desiredEntry: PayoutLedgerEntry,
): boolean {
  return Object.values(ledger.entries).some(
    (entry) =>
      entry.origin === "manual" &&
      entry.direction === "payout" &&
      entry.category ===
        desiredEntry.category &&
      entry.playerId ===
        desiredEntry.playerId &&
      entry.amountCents ===
        desiredEntry.amountCents,
  );
}

function buildUpdatedEntry(
  existingEntry: PayoutLedgerEntry,
  desiredEntry: PayoutLedgerEntry,
): PayoutLedgerEntry {
  const recipientChanged =
    existingEntry.playerId !==
      desiredEntry.playerId ||
    existingEntry.playerName !==
      desiredEntry.playerName ||
    existingEntry.nflTeam !==
      desiredEntry.nflTeam;

  const amountChanged =
    existingEntry.amountCents !==
    desiredEntry.amountCents;

  const paidEntryChanged =
    existingEntry.status === "paid" &&
    (recipientChanged || amountChanged);

  return {
    ...existingEntry,
    season: desiredEntry.season,
    playerId: desiredEntry.playerId,
    playerName: desiredEntry.playerName,
    nflTeam: desiredEntry.nflTeam,
    direction: "payout",
    category: desiredEntry.category,
    origin: "automatic",
    amountCents:
      desiredEntry.amountCents,
    sourceKey: desiredEntry.sourceKey,
    sourceLabel:
      desiredEntry.sourceLabel,
    note: paidEntryChanged
      ? appendNote(
          existingEntry.note,
          getRecipientChangedReviewNote(
            existingEntry,
          ),
        )
      : existingEntry.note,
    needsReview:
      existingEntry.needsReview ||
      paidEntryChanged,
  };
}

function getStaleEntryAction(
  entry: PayoutLedgerEntry,
): SeasonAwardPayoutSyncAction {
  if (entry.status === "unpaid") {
    return {
      type: "remove",
      entryId: entry.id,
    };
  }

  const reviewedEntry: PayoutLedgerEntry = {
    ...entry,
    note: appendNote(
      entry.note,
      STALE_PAID_REVIEW_NOTE,
    ),
    needsReview: true,
  };

  if (entriesMatch(entry, reviewedEntry)) {
    return { type: "none" };
  }

  return {
    type: "upsert",
    entry: reviewedEntry,
  };
}

export function getNextSeasonAwardPayoutSyncAction(
  ledger: PayoutLedgerSeasonState,
  results: SeasonAwardResults,
  timestamp?: string,
): SeasonAwardPayoutSyncAction {
  const resultSeasons = new Set(
    SEASON_AWARD_CATEGORIES.map(
      (category) =>
        results[category].season,
    ),
  );

  if (
    resultSeasons.size !== 1 ||
    !resultSeasons.has(ledger.season)
  ) {
    return { type: "none" };
  }

  const desiredEntries =
    SEASON_AWARD_CATEGORIES.reduce<
      Map<string, PayoutLedgerEntry>
    >((entryMap, category) => {
      const desiredEntry =
        createDesiredEntry(
          results[category],
          timestamp,
        );

      if (desiredEntry) {
        entryMap.set(
          desiredEntry.id,
          desiredEntry,
        );
      }

      return entryMap;
    }, new Map());

  const staleEntry = Object.values(
    ledger.entries,
  )
    .filter(isAutomaticSeasonAwardEntry)
    .sort((entryA, entryB) =>
      entryA.id.localeCompare(entryB.id),
    )
    .find(
      (entry) =>
        !desiredEntries.has(entry.id),
    );

  if (staleEntry) {
    return getStaleEntryAction(
      staleEntry,
    );
  }

  const desiredEntriesInOrder =
    Array.from(
      desiredEntries.values(),
    ).sort((entryA, entryB) =>
      entryA.id.localeCompare(entryB.id),
    );

  for (const desiredEntry of desiredEntriesInOrder) {
    const existingEntry =
      ledger.entries[desiredEntry.id];

    if (!existingEntry) {
      if (
        hasEquivalentManualEntry(
          ledger,
          desiredEntry,
        )
      ) {
        continue;
      }

      return {
        type: "upsert",
        entry: desiredEntry,
      };
    }

    if (
      !isAutomaticSeasonAwardEntry(
        existingEntry,
      )
    ) {
      continue;
    }

    const updatedEntry =
      buildUpdatedEntry(
        existingEntry,
        desiredEntry,
      );

    if (
      !entriesMatch(
        existingEntry,
        updatedEntry,
      )
    ) {
      return {
        type: "upsert",
        entry: updatedEntry,
      };
    }
  }

  return { type: "none" };
}
