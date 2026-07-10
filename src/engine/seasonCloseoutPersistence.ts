import {
  getSeasonCloseoutArchiveId,
} from "./seasonCloseoutEngine";
import type {
  SeasonCloseoutArchive,
  SeasonCloseoutArchiveHistory,
  SeasonCloseoutCheck,
  SeasonCloseoutLockedArea,
  SeasonCloseoutStatus,
} from "./seasonCloseoutTypes";

const STORAGE_KEY =
  "head2head-brawlin-steel.season-closeout-archives.v1";

const SCHEMA_VERSION = 1;

type StoredSeasonCloseoutSnapshot = {
  schemaVersion: number;
  savedAt: string;
  archives: SeasonCloseoutArchiveHistory;
};

function isBrowserStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function sanitizePositiveInteger(
  value: unknown,
): number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  )
    ? value
    : 0;
}

function sanitizeStatus(
  value: unknown,
): SeasonCloseoutStatus | null {
  if (
    value === "closed" ||
    value === "closed-with-override"
  ) {
    return value;
  }

  return null;
}

function sanitizeLockedArea(
  value: unknown,
): SeasonCloseoutLockedArea | null {
  if (
    value === "scoring" ||
    value === "playoffs" ||
    value === "season-awards" ||
    value === "payout-ledger"
  ) {
    return value;
  }

  return null;
}

function sanitizeLockScope(
  value: unknown,
): SeasonCloseoutLockedArea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(sanitizeLockedArea)
        .filter(
          (
            area,
          ): area is SeasonCloseoutLockedArea =>
            Boolean(area),
        ),
    ),
  );
}

function sanitizeCheck(
  value: unknown,
): SeasonCloseoutCheck | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = sanitizeString(
    value.code,
  ) as SeasonCloseoutCheck["code"];

  const validCodes =
    new Set<SeasonCloseoutCheck["code"]>([
      "week-18-finalized",
      "season-awards-resolved",
      "playoffs-complete",
      "payout-plan-reconciled",
      "no-ledger-review",
      "buy-ins-paid",
      "payouts-paid",
      "reserve-balanced",
    ]);

  if (!validCodes.has(code)) {
    return null;
  }

  return {
    code,
    label: sanitizeString(value.label),
    passed: value.passed === true,
    detail: sanitizeString(value.detail),
  };
}

function sanitizeChecks(
  value: unknown,
): SeasonCloseoutCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(sanitizeCheck)
    .filter(
      (
        check,
      ): check is SeasonCloseoutCheck =>
        Boolean(check),
    );
}

function cloneValue<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function sanitizeArchive(
  value: unknown,
): SeasonCloseoutArchive | null {
  if (!isRecord(value)) {
    return null;
  }

  const season =
    sanitizePositiveInteger(value.season);

  const status = sanitizeStatus(
    value.status,
  );

  const closedAt =
    sanitizeString(value.closedAt).trim();

  const confirmationPhrase =
    sanitizeString(
      value.confirmationPhrase,
    ).trim();

  if (
    season <= 0 ||
    !status ||
    !closedAt ||
    !confirmationPhrase ||
    value.closedBy !== "commissioner" ||
    !isRecord(value.financials) ||
    !isRecord(value.snapshot) ||
    !isRecord(value.payoutSummary) ||
    !isRecord(value.payoutReconciliation)
  ) {
    return null;
  }

  const lockScope =
    sanitizeLockScope(value.lockScope);

  if (lockScope.length === 0) {
    return null;
  }

  const id =
    getSeasonCloseoutArchiveId(season);

  return {
    ...(cloneValue(
      value,
    ) as unknown as SeasonCloseoutArchive),
    id,
    season,
    status,
    closedAt,
    closedBy: "commissioner",
    confirmationPhrase,
    overrideReason:
      typeof value.overrideReason ===
      "string"
        ? value.overrideReason
        : null,
    unresolvedChecks:
      sanitizeChecks(
        value.unresolvedChecks,
      ),
    checks: sanitizeChecks(value.checks),
    lockScope,
  };
}

export function loadPersistedSeasonCloseoutHistory():
  SeasonCloseoutArchiveHistory {
  if (!isBrowserStorageAvailable()) {
    return {};
  }

  try {
    const rawSnapshot =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!rawSnapshot) {
      return {};
    }

    const parsedSnapshot: unknown =
      JSON.parse(rawSnapshot);

    if (!isRecord(parsedSnapshot)) {
      return {};
    }

    const archiveSource = isRecord(
      parsedSnapshot.archives,
    )
      ? parsedSnapshot.archives
      : parsedSnapshot;

    return Object.values(
      archiveSource,
    ).reduce<SeasonCloseoutArchiveHistory>(
      (history, archiveValue) => {
        const archive =
          sanitizeArchive(archiveValue);

        if (archive) {
          history[archive.id] =
            archive;
        }

        return history;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function savePersistedSeasonCloseoutHistory(
  history: SeasonCloseoutArchiveHistory,
): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    const snapshot:
      StoredSeasonCloseoutSnapshot = {
        schemaVersion: SCHEMA_VERSION,
        savedAt:
          new Date().toISOString(),
        archives: history,
      };

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(snapshot),
    );

    return true;
  } catch {
    return false;
  }
}
