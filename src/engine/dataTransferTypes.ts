export type LeagueDataTransferStorageSnapshot = {
  league: string;
  seasonCloseoutArchives: string | null;
  seasonAwardCoinFlips: string | null;
};

export type LeagueDataTransferSource = {
  origin: string;
  pathname: string;
};

export type LeagueDataTransferSummary = {
  leagueName: string;
  season: number | null;
  currentWeek: number | null;
  playerCount: number;
  archiveCount: number;
  seasonAwardCoinFlipCount: number;
};

export type LeagueDataTransferBackup = {
  format: "head2head-brawlin-steel-backup";
  formatVersion: 1;
  exportedAt: string;
  source: LeagueDataTransferSource;
  storage: LeagueDataTransferStorageSnapshot;
  summary: LeagueDataTransferSummary;
  checksum: string;
};

export type LeagueDataTransferIssueCode =
  | "empty-file"
  | "file-too-large"
  | "invalid-json"
  | "invalid-format"
  | "unsupported-version"
  | "invalid-export-date"
  | "invalid-source"
  | "missing-league-data"
  | "invalid-league-data"
  | "invalid-archive-data"
  | "invalid-season-award-data"
  | "invalid-summary"
  | "checksum-mismatch";

export type LeagueDataTransferValidationIssue = {
  code: LeagueDataTransferIssueCode;
  message: string;
};

export type LeagueDataTransferValidationSuccess = {
  ok: true;
  backup: LeagueDataTransferBackup;
  issues: [];
};

export type LeagueDataTransferValidationFailure = {
  ok: false;
  backup: null;
  issues: LeagueDataTransferValidationIssue[];
};

export type LeagueDataTransferValidationResult =
  | LeagueDataTransferValidationSuccess
  | LeagueDataTransferValidationFailure;

export type LeagueDataTransferApplyResult = {
  restoredStorageKeys: number;
  removedStorageKeys: number;
  reloadRequired: true;
};
