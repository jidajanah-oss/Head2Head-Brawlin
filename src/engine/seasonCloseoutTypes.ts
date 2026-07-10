import type { Game } from "../types/game";
import type { Player } from "../types/player";
import type { ObscureStatCoinFlipHistory } from "./obscureStatCoinFlipTypes";
import type {
  PayoutLedgerReconciliation,
} from "./payoutLedgerPlan";
import type {
  PayoutLedgerSeasonState,
  PayoutLedgerSummary,
} from "./payoutLedgerTypes";
import type { PickerClickerHistory } from "./pickerClickerTypes";
import type { PlayoffSeasonState } from "./playoffResultsTypes";
import type {
  SeasonAwardCoinFlipHistory,
  SeasonAwardResults,
} from "./seasonAwardTypes";
import type { WeeklyScoringHistory } from "./weeklyScoringTypes";

export type SeasonCloseoutMode =
  | "normal"
  | "override";

export type SeasonCloseoutStatus =
  | "closed"
  | "closed-with-override";

export type SeasonCloseoutLockedArea =
  | "scoring"
  | "playoffs"
  | "season-awards"
  | "payout-ledger";

export type SeasonCloseoutCheckCode =
  | "week-18-finalized"
  | "season-awards-resolved"
  | "playoffs-complete"
  | "payout-plan-reconciled"
  | "no-ledger-review"
  | "buy-ins-paid"
  | "payouts-paid"
  | "reserve-balanced";

export type SeasonCloseoutCheck = {
  code: SeasonCloseoutCheckCode;
  label: string;
  passed: boolean;
  detail: string;
};

export type SeasonCloseoutFinancialSnapshot = {
  plannedPayoutsCents: number;
  recognizedOfficialPayoutsCents: number;
  adjustmentPayoutsCents: number;
  adjustmentCollectionsCents: number;
  collectedCents: number;
  paidPayoutsCents: number;
  currentBalanceCents: number;
  expectedFinalBalanceCents: number;
  plannedReserveCents: number;
};

export type SeasonCloseoutEvaluation = {
  season: number;
  evaluatedAt: string;
  confirmationPhrase: string;
  canCloseNormally: boolean;
  checks: SeasonCloseoutCheck[];
  unresolvedChecks: SeasonCloseoutCheck[];
  financials: SeasonCloseoutFinancialSnapshot;
};

export type SeasonCloseoutEvaluationInput = {
  season: number;
  scoringHistory: WeeklyScoringHistory;
  seasonAwards: SeasonAwardResults;
  playoffSeason: PlayoffSeasonState | null;
  payoutLedger: PayoutLedgerSeasonState;
  evaluatedAt?: string;
};

export type SeasonCloseoutLeagueSnapshot = {
  settings: {
    leagueName: string;
    season: string;
    maxPlayers: number;
    pickLockMinutesBeforeKickoff: number;
  };
  players: Player[];
  currentWeek: number;
  games: Game[];
  seasonStatus:
    | "preseason"
    | "active"
    | "complete";
  pickStatus: "open" | "locked";
};

export type SeasonCloseoutDataSnapshot = {
  league: SeasonCloseoutLeagueSnapshot;
  picks: Record<
    string,
    Record<string, string>
  >;
  activePlayerId: string;
  gameResults: Record<string, string>;
  scoringHistory: WeeklyScoringHistory;
  pickerClickerHistory: PickerClickerHistory;
  obscureStatCoinFlipHistory: ObscureStatCoinFlipHistory;
  playoffSeason: PlayoffSeasonState | null;
  seasonAwards: SeasonAwardResults;
  seasonAwardCoinFlipHistory: SeasonAwardCoinFlipHistory;
  payoutLedger: PayoutLedgerSeasonState;
};

export type CreateSeasonCloseoutArchiveInput =
  SeasonCloseoutEvaluationInput & {
    mode: SeasonCloseoutMode;
    confirmationText: string;
    overrideReason?: string;
    snapshot: SeasonCloseoutDataSnapshot;
    closedAt?: string;
  };

export type SeasonCloseoutArchive = {
  id: string;
  season: number;
  status: SeasonCloseoutStatus;
  closedAt: string;
  closedBy: "commissioner";
  confirmationPhrase: string;
  overrideReason: string | null;
  unresolvedChecks: SeasonCloseoutCheck[];
  checks: SeasonCloseoutCheck[];
  financials: SeasonCloseoutFinancialSnapshot;
  lockScope: SeasonCloseoutLockedArea[];
  snapshot: SeasonCloseoutDataSnapshot;
  payoutSummary: PayoutLedgerSummary;
  payoutReconciliation: PayoutLedgerReconciliation;
};

export type SeasonCloseoutArchiveHistory =
  Record<string, SeasonCloseoutArchive>;
