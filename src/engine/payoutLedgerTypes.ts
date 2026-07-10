import type {
  PlayerRole,
  PlayerStatus,
} from "../types/player";

export type PayoutLedgerDirection =
  | "collection"
  | "payout";

export type PayoutLedgerEntryStatus =
  | "unpaid"
  | "paid";

export type PayoutLedgerEntryOrigin =
  | "automatic"
  | "manual";

export type PayoutLedgerCategory =
  | "player-buy-in"
  | "obscure-stat-award"
  | "division-group-payout"
  | "afc-winner"
  | "nfc-winner"
  | "wild-card-loser"
  | "divisional-loser"
  | "conference-loser"
  | "super-bowl-loser"
  | "super-bowl-winner"
  | "biggest-winner"
  | "biggest-loser"
  | "last-to-lose"
  | "adjustment";

export type PayoutLedgerPlayerSnapshot = {
  playerId: string;
  playerName: string;
  nflTeam: string;
  status: PlayerStatus;
  role: PlayerRole;
  capturedAt: string;
};

export type PayoutLedgerEntry = {
  id: string;
  season: number;
  playerId: string;
  playerName: string;
  nflTeam: string;
  direction: PayoutLedgerDirection;
  category: PayoutLedgerCategory;
  origin: PayoutLedgerEntryOrigin;
  amountCents: number;
  status: PayoutLedgerEntryStatus;
  sourceKey: string;
  sourceLabel: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  needsReview: boolean;
};

export type PayoutLedgerEntryDraft = Omit<
  PayoutLedgerEntry,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "paidAt"
  | "needsReview"
> & {
  id?: string;
  status?: PayoutLedgerEntryStatus;
  paidAt?: string | null;
  needsReview?: boolean;
};

export type PayoutLedgerSeasonState = {
  id: string;
  season: number;
  initializedAt: string;
  updatedAt: string;
  roster: PayoutLedgerPlayerSnapshot[];
  entries: Record<string, PayoutLedgerEntry>;
};

export type PayoutLedgerHistory = Record<
  string,
  PayoutLedgerSeasonState
>;

export type PayoutLedgerSummary = {
  entryCount: number;
  paidEntryCount: number;
  unpaidEntryCount: number;
  reviewEntryCount: number;
  expectedCollectionsCents: number;
  collectedCents: number;
  outstandingCollectionsCents: number;
  recognizedPayoutsCents: number;
  paidPayoutsCents: number;
  outstandingPayoutsCents: number;
  currentBalanceCents: number;
  projectedBalanceCents: number;
};