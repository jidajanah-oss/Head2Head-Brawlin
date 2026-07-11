import type { Player } from "../types/player";
import type {
  PayoutLedgerCategory,
  PayoutLedgerDirection,
  PayoutLedgerEntry,
  PayoutLedgerEntryDraft,
  PayoutLedgerEntryStatus,
  PayoutLedgerPlayerSnapshot,
  PayoutLedgerSeasonState,
  PayoutLedgerSummary,
} from "./payoutLedgerTypes";

export const PAYOUT_LEDGER_AMOUNTS_CENTS = {
  playerBuyIn: 2_500,
  obscureStatAward: 500,
  divisionGroupTotal: 4_800,
  divisionPlayerShare: 1_200,
  afcWinner: 2_000,
  nfcWinner: 2_000,
  wildCardLoser: 2_000,
  divisionalLoser: 4_000,
  conferenceLoser: 6_000,
  superBowlLoser: 8_000,
  superBowlWinner: 16_000,
  biggestWinner: 1_500,
  biggestLoser: 100,
  lastToLose: 1_000,
} as const;

const BUY_IN_CATEGORY: PayoutLedgerCategory =
  "player-buy-in";

const BUY_IN_DIRECTION: PayoutLedgerDirection =
  "collection";

function getTimestamp(timestamp?: string): string {
  return (
    timestamp?.trim() ||
    new Date().toISOString()
  );
}

function normalizeIdPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

function assertPositiveSeason(season: number): void {
  if (
    !Number.isInteger(season) ||
    season <= 0
  ) {
    throw new Error(
      "Payout ledger season must be a positive integer.",
    );
  }
}

function assertPositiveAmount(
  amountCents: number,
): void {
  if (
    !Number.isInteger(amountCents) ||
    amountCents <= 0
  ) {
    throw new Error(
      "Payout ledger amount must be a positive whole number of cents.",
    );
  }
}

function buildPlayerSnapshot(
  player: Player,
  capturedAt: string,
): PayoutLedgerPlayerSnapshot {
  return {
    playerId: player.id,
    playerName: player.name,
    nflTeam: player.nflTeam,
    status: player.status,
    role: player.role,
    capturedAt,
  };
}

function createBuyInEntry(
  season: number,
  player: Player,
  createdAt: string,
): PayoutLedgerEntry {
  return createPayoutLedgerEntry(
    {
      season,
      playerId: player.id,
      playerName: player.name,
      nflTeam: player.nflTeam,
      direction: BUY_IN_DIRECTION,
      category: BUY_IN_CATEGORY,
      origin: "automatic",
      amountCents:
        PAYOUT_LEDGER_AMOUNTS_CENTS.playerBuyIn,
      sourceKey: `season-${season}-buy-in`,
      sourceLabel:
        `$25 season ${season} player buy-in`,
      note: "",
    },
    createdAt,
  );
}

export function getPayoutLedgerSeasonId(
  season: number,
): string {
  assertPositiveSeason(season);

  return `${season}-payout-ledger`;
}

export function getPayoutLedgerEntryId(
  season: number,
  category: PayoutLedgerCategory,
  sourceKey: string,
  playerId: string,
): string {
  assertPositiveSeason(season);

  return [
    season,
    normalizeIdPart(category),
    normalizeIdPart(sourceKey),
    normalizeIdPart(playerId),
  ].join(":");
}

export function createPayoutLedgerEntry(
  draft: PayoutLedgerEntryDraft,
  timestamp?: string,
): PayoutLedgerEntry {
  assertPositiveSeason(draft.season);
  assertPositiveAmount(draft.amountCents);

  const createdAt = getTimestamp(timestamp);
  const status = draft.status ?? "unpaid";

  const paidAt =
    status === "paid"
      ? draft.paidAt?.trim() || createdAt
      : null;

  return {
    ...draft,
    id:
      draft.id?.trim() ||
      getPayoutLedgerEntryId(
        draft.season,
        draft.category,
        draft.sourceKey,
        draft.playerId,
      ),
    playerId: draft.playerId.trim(),
    playerName: draft.playerName.trim(),
    nflTeam: draft.nflTeam.trim(),
    sourceKey: draft.sourceKey.trim(),
    sourceLabel: draft.sourceLabel.trim(),
    note: draft.note.trim(),
    status,
    createdAt,
    updatedAt: createdAt,
    paidAt,
    needsReview:
      draft.needsReview ?? false,
  };
}

export function initializePayoutLedgerSeason(
  season: number,
  players: Player[],
  initializedAt?: string,
): PayoutLedgerSeasonState {
  assertPositiveSeason(season);

  const timestamp =
    getTimestamp(initializedAt);

  const activePlayers = players.filter(
    (player) => player.status === "active",
  );

  const roster = activePlayers.map(
    (player) =>
      buildPlayerSnapshot(
        player,
        timestamp,
      ),
  );

  const entries = activePlayers.reduce<
    Record<string, PayoutLedgerEntry>
  >((nextEntries, player) => {
    const entry = createBuyInEntry(
      season,
      player,
      timestamp,
    );

    nextEntries[entry.id] = entry;

    return nextEntries;
  }, {});

  return {
    id: getPayoutLedgerSeasonId(season),
    season,
    initializedAt: timestamp,
    updatedAt: timestamp,
    roster,
    entries,
  };
}

export function synchronizePayoutLedgerRosterAndBuyIns(
  ledger: PayoutLedgerSeasonState,
  players: Player[],
  updatedAt?: string,
): PayoutLedgerSeasonState {
  assertPositiveSeason(ledger.season);

  const timestamp =
    getTimestamp(updatedAt);

  const existingPlayerIds = new Set(
    ledger.roster.map(
      (player) => player.playerId,
    ),
  );

  const nextRoster = [...ledger.roster];
  const nextEntries = {
    ...ledger.entries,
  };

  let changed = false;

  players
    .filter(
      (player) =>
        player.status === "active",
    )
    .forEach((player) => {
      if (
        !existingPlayerIds.has(player.id)
      ) {
        nextRoster.push(
          buildPlayerSnapshot(
            player,
            timestamp,
          ),
        );

        existingPlayerIds.add(player.id);
        changed = true;
      }

      const buyInEntry =
        createBuyInEntry(
          ledger.season,
          player,
          timestamp,
        );

      if (
        !nextEntries[buyInEntry.id]
      ) {
        nextEntries[buyInEntry.id] =
          buyInEntry;

        changed = true;
      }
    });

  if (!changed) {
    return ledger;
  }

  return {
    ...ledger,
    roster: nextRoster,
    entries: nextEntries,
    updatedAt: timestamp,
  };
}

export function upsertPayoutLedgerEntry(
  ledger: PayoutLedgerSeasonState,
  entry: PayoutLedgerEntry,
  updatedAt?: string,
): PayoutLedgerSeasonState {
  if (
    entry.season !== ledger.season
  ) {
    throw new Error(
      "Payout ledger entry season does not match the ledger season.",
    );
  }

  const existingEntry =
    ledger.entries[entry.id];

  if (existingEntry === entry) {
    return ledger;
  }

  const timestamp =
    getTimestamp(updatedAt);

  return {
    ...ledger,
    updatedAt: timestamp,
    entries: {
      ...ledger.entries,
      [entry.id]: {
        ...entry,
        updatedAt: timestamp,
      },
    },
  };
}

export function removePayoutLedgerEntry(
  ledger: PayoutLedgerSeasonState,
  entryId: string,
  updatedAt?: string,
): PayoutLedgerSeasonState {
  const normalizedEntryId =
    entryId.trim();

  if (
    !normalizedEntryId ||
    !ledger.entries[normalizedEntryId]
  ) {
    return ledger;
  }

  const nextEntries = {
    ...ledger.entries,
  };

  delete nextEntries[
    normalizedEntryId
  ];

  return {
    ...ledger,
    entries: nextEntries,
    updatedAt:
      getTimestamp(updatedAt),
  };
}

export function setPayoutLedgerEntryStatus(
  ledger: PayoutLedgerSeasonState,
  entryId: string,
  status: PayoutLedgerEntryStatus,
  updatedAt?: string,
): PayoutLedgerSeasonState {
  const entry =
    ledger.entries[entryId];

  if (!entry) {
    return ledger;
  }

  const timestamp =
    getTimestamp(updatedAt);

  const paidAt =
    status === "paid"
      ? entry.paidAt ?? timestamp
      : null;

  if (
    entry.status === status &&
    entry.paidAt === paidAt
  ) {
    return ledger;
  }

  return {
    ...ledger,
    updatedAt: timestamp,
    entries: {
      ...ledger.entries,
      [entry.id]: {
        ...entry,
        status,
        paidAt,
        updatedAt: timestamp,
      },
    },
  };
}

export function setPayoutLedgerEntryReviewStatus(
  ledger: PayoutLedgerSeasonState,
  entryId: string,
  needsReview: boolean,
  updatedAt?: string,
): PayoutLedgerSeasonState {
  const entry =
    ledger.entries[entryId];

  if (
    !entry ||
    entry.needsReview === needsReview
  ) {
    return ledger;
  }

  const timestamp =
    getTimestamp(updatedAt);

  return {
    ...ledger,
    updatedAt: timestamp,
    entries: {
      ...ledger.entries,
      [entry.id]: {
        ...entry,
        needsReview,
        updatedAt: timestamp,
      },
    },
  };
}

export function buildPayoutLedgerSummary(
  ledger: PayoutLedgerSeasonState,
): PayoutLedgerSummary {
  const entries =
    Object.values(ledger.entries);

  const expectedCollectionsCents =
    entries
      .filter(
        (entry) =>
          entry.direction ===
          "collection",
      )
      .reduce(
        (total, entry) =>
          total + entry.amountCents,
        0,
      );

  const collectedCents = entries
    .filter(
      (entry) =>
        entry.direction ===
          "collection" &&
        entry.status === "paid",
    )
    .reduce(
      (total, entry) =>
        total + entry.amountCents,
      0,
    );

  const recognizedPayoutsCents =
    entries
      .filter(
        (entry) =>
          entry.direction ===
          "payout",
      )
      .reduce(
        (total, entry) =>
          total + entry.amountCents,
        0,
      );

  const paidPayoutsCents = entries
    .filter(
      (entry) =>
        entry.direction ===
          "payout" &&
        entry.status === "paid",
    )
    .reduce(
      (total, entry) =>
        total + entry.amountCents,
      0,
    );

  const paidEntryCount =
    entries.filter(
      (entry) =>
        entry.status === "paid",
    ).length;

  return {
    entryCount: entries.length,
    paidEntryCount,
    unpaidEntryCount:
      entries.length -
      paidEntryCount,
    reviewEntryCount:
      entries.filter(
        (entry) =>
          entry.needsReview,
      ).length,
    expectedCollectionsCents,
    collectedCents,
    outstandingCollectionsCents:
      expectedCollectionsCents -
      collectedCents,
    recognizedPayoutsCents,
    paidPayoutsCents,
    outstandingPayoutsCents:
      recognizedPayoutsCents -
      paidPayoutsCents,
    currentBalanceCents:
      collectedCents -
      paidPayoutsCents,
    projectedBalanceCents:
      expectedCollectionsCents -
      recognizedPayoutsCents,
  };
}
