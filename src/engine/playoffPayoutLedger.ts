import {
  createPayoutLedgerEntry,
  PAYOUT_LEDGER_AMOUNTS_CENTS,
} from "./payoutLedgerEngine";
import type {
  PayoutLedgerCategory,
  PayoutLedgerEntry,
  PayoutLedgerSeasonState,
} from "./payoutLedgerTypes";
import type {
  PlayoffMatchupRecord,
  PlayoffParticipantSnapshot,
  PlayoffSeasonState,
} from "./playoffResultsTypes";

export type PlayoffPayoutSyncAction =
  | { type: "none" }
  | {
      type: "upsert";
      entry: PayoutLedgerEntry;
    }
  | {
      type: "remove";
      entryId: string;
    };

type PlayoffPayoutRole =
  | "winner"
  | "loser";

type DesiredPlayoffPayout = {
  entry: PayoutLedgerEntry;
};

const PLAYOFF_SOURCE_PREFIX =
  "playoff-result:";

const STALE_PAID_REVIEW_NOTE =
  "This paid playoff payout no longer matches a finalized playoff result. Verify the previous payment before clearing review.";

function getTimestamp(
  timestamp?: string,
): string {
  return (
    timestamp?.trim() ||
    new Date().toISOString()
  );
}

function appendNote(
  currentNote: string,
  message: string,
): string {
  const normalizedNote =
    currentNote.trim();

  if (
    normalizedNote.includes(message)
  ) {
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
    currentEntry.season ===
      nextEntry.season &&
    currentEntry.playerId ===
      nextEntry.playerId &&
    currentEntry.playerName ===
      nextEntry.playerName &&
    currentEntry.nflTeam ===
      nextEntry.nflTeam &&
    currentEntry.direction ===
      nextEntry.direction &&
    currentEntry.category ===
      nextEntry.category &&
    currentEntry.origin ===
      nextEntry.origin &&
    currentEntry.amountCents ===
      nextEntry.amountCents &&
    currentEntry.status ===
      nextEntry.status &&
    currentEntry.sourceKey ===
      nextEntry.sourceKey &&
    currentEntry.sourceLabel ===
      nextEntry.sourceLabel &&
    currentEntry.note ===
      nextEntry.note &&
    currentEntry.createdAt ===
      nextEntry.createdAt &&
    currentEntry.paidAt ===
      nextEntry.paidAt &&
    currentEntry.needsReview ===
      nextEntry.needsReview
  );
}

function getParticipantById(
  playoffSeason: PlayoffSeasonState,
  playerId: string | null,
): PlayoffParticipantSnapshot | null {
  if (!playerId) {
    return null;
  }

  return (
    [
      ...playoffSeason.seeds.AFC,
      ...playoffSeason.seeds.NFC,
    ].find(
      (participant) =>
        participant.playerId === playerId,
    ) ?? null
  );
}

function getPlayoffPayoutSourceKey(
  matchup: PlayoffMatchupRecord,
  role: PlayoffPayoutRole,
): string {
  return `${PLAYOFF_SOURCE_PREFIX}${matchup.id}:${role}`;
}

export function getPlayoffPayoutEntryId(
  matchup: PlayoffMatchupRecord,
  role: PlayoffPayoutRole,
): string {
  return `${matchup.season}:playoff-payout:${matchup.id}:${role}`;
}

function getRecipientChangedReviewNote(
  existingEntry: PayoutLedgerEntry,
): string {
  const previousTeam =
    existingEntry.nflTeam.trim() ||
    "No NFL team";

  return (
    "This paid playoff payout changed after the bracket result was edited. " +
    `Previous recipient: ${existingEntry.playerName} (${previousTeam}). ` +
    "Verify the payment and correct the ledger before clearing review."
  );
}

function createDesiredEntry(
  matchup: PlayoffMatchupRecord,
  participant: PlayoffParticipantSnapshot,
  role: PlayoffPayoutRole,
  category: PayoutLedgerCategory,
  amountCents: number,
  sourceLabel: string,
  timestamp: string,
): PayoutLedgerEntry {
  return createPayoutLedgerEntry(
    {
      id: getPlayoffPayoutEntryId(
        matchup,
        role,
      ),
      season: matchup.season,
      playerId: participant.playerId,
      playerName: participant.playerName,
      nflTeam: participant.nflTeam,
      direction: "payout",
      category,
      origin: "automatic",
      amountCents,
      sourceKey:
        getPlayoffPayoutSourceKey(
          matchup,
          role,
        ),
      sourceLabel,
      note: "",
    },
    timestamp,
  );
}

function addLoserPayout(
  desiredEntries: Map<
    string,
    DesiredPlayoffPayout
  >,
  playoffSeason: PlayoffSeasonState,
  matchup: PlayoffMatchupRecord,
  category: PayoutLedgerCategory,
  amountCents: number,
  label: string,
  timestamp: string,
): void {
  const loser = getParticipantById(
    playoffSeason,
    matchup.loserId,
  );

  if (!loser) {
    return;
  }

  const entry = createDesiredEntry(
    matchup,
    loser,
    "loser",
    category,
    amountCents,
    label,
    timestamp,
  );

  desiredEntries.set(entry.id, {
    entry,
  });
}

function addWinnerPayout(
  desiredEntries: Map<
    string,
    DesiredPlayoffPayout
  >,
  playoffSeason: PlayoffSeasonState,
  matchup: PlayoffMatchupRecord,
  category: PayoutLedgerCategory,
  amountCents: number,
  label: string,
  timestamp: string,
): void {
  const winner = getParticipantById(
    playoffSeason,
    matchup.winnerId,
  );

  if (!winner) {
    return;
  }

  const entry = createDesiredEntry(
    matchup,
    winner,
    "winner",
    category,
    amountCents,
    label,
    timestamp,
  );

  desiredEntries.set(entry.id, {
    entry,
  });
}

function buildDesiredPlayoffPayouts(
  playoffSeason: PlayoffSeasonState,
  timestamp: string,
): Map<string, DesiredPlayoffPayout> {
  const desiredEntries = new Map<
    string,
    DesiredPlayoffPayout
  >();

  Object.values(
    playoffSeason.matchups,
  )
    .filter(
      (matchup) =>
        matchup.status === "final" &&
        Boolean(matchup.winnerId) &&
        Boolean(matchup.loserId),
    )
    .sort((matchupA, matchupB) =>
      matchupA.id.localeCompare(
        matchupB.id,
      ),
    )
    .forEach((matchup) => {
      if (matchup.round === "wildcard") {
        addLoserPayout(
          desiredEntries,
          playoffSeason,
          matchup,
          "wild-card-loser",
          PAYOUT_LEDGER_AMOUNTS_CENTS.wildCardLoser,
          `${matchup.conference} Wild Card loser — ${matchup.matchupLabel}`,
          timestamp,
        );
        return;
      }

      if (
        matchup.round === "divisional"
      ) {
        addLoserPayout(
          desiredEntries,
          playoffSeason,
          matchup,
          "divisional-loser",
          PAYOUT_LEDGER_AMOUNTS_CENTS.divisionalLoser,
          `${matchup.conference} Divisional loser — ${matchup.matchupLabel}`,
          timestamp,
        );
        return;
      }

      if (
        matchup.round ===
        "conference-championship"
      ) {
        addLoserPayout(
          desiredEntries,
          playoffSeason,
          matchup,
          "conference-loser",
          PAYOUT_LEDGER_AMOUNTS_CENTS.conferenceLoser,
          `${matchup.conference} Championship loser`,
          timestamp,
        );

        if (matchup.conference === "AFC") {
          addWinnerPayout(
            desiredEntries,
            playoffSeason,
            matchup,
            "afc-winner",
            PAYOUT_LEDGER_AMOUNTS_CENTS.afcWinner,
            "AFC Champion",
            timestamp,
          );
        }

        if (matchup.conference === "NFC") {
          addWinnerPayout(
            desiredEntries,
            playoffSeason,
            matchup,
            "nfc-winner",
            PAYOUT_LEDGER_AMOUNTS_CENTS.nfcWinner,
            "NFC Champion",
            timestamp,
          );
        }

        return;
      }

      if (
        matchup.round === "super-bowl"
      ) {
        addLoserPayout(
          desiredEntries,
          playoffSeason,
          matchup,
          "super-bowl-loser",
          PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlLoser,
          "Super Bowl runner-up",
          timestamp,
        );

        addWinnerPayout(
          desiredEntries,
          playoffSeason,
          matchup,
          "super-bowl-winner",
          PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlWinner,
          "Super Bowl champion",
          timestamp,
        );
      }
    });

  return desiredEntries;
}

function isAutomaticPlayoffEntry(
  entry: PayoutLedgerEntry,
): boolean {
  return (
    entry.origin === "automatic" &&
    entry.direction === "payout" &&
    entry.sourceKey.startsWith(
      PLAYOFF_SOURCE_PREFIX,
    )
  );
}

function hasEquivalentManualEntry(
  ledger: PayoutLedgerSeasonState,
  desiredEntry: PayoutLedgerEntry,
): boolean {
  return Object.values(
    ledger.entries,
  ).some(
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
): PlayoffPayoutSyncAction {
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

  if (
    entriesMatch(
      entry,
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

export function getNextPlayoffPayoutSyncAction(
  ledger: PayoutLedgerSeasonState,
  playoffSeason: PlayoffSeasonState,
  timestamp?: string,
): PlayoffPayoutSyncAction {
  if (
    ledger.season !==
    playoffSeason.season
  ) {
    return { type: "none" };
  }

  const resolvedTimestamp =
    getTimestamp(timestamp);

  const desiredEntries =
    buildDesiredPlayoffPayouts(
      playoffSeason,
      resolvedTimestamp,
    );

  const automaticEntries =
    Object.values(ledger.entries)
      .filter(isAutomaticPlayoffEntry)
      .sort((entryA, entryB) =>
        entryA.id.localeCompare(entryB.id),
      );

  const staleEntry =
    automaticEntries.find(
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
    ).sort((desiredA, desiredB) =>
      desiredA.entry.id.localeCompare(
        desiredB.entry.id,
      ),
    );

  for (const desired of desiredEntriesInOrder) {
    const desiredEntry = desired.entry;
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
      !isAutomaticPlayoffEntry(
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
