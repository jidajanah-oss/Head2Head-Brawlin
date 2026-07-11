import type {
  LeagueDataTransferApplyResult,
  LeagueDataTransferBackup,
  LeagueDataTransferIssueCode,
  LeagueDataTransferSource,
  LeagueDataTransferStorageSnapshot,
  LeagueDataTransferSummary,
  LeagueDataTransferValidationIssue,
  LeagueDataTransferValidationResult,
} from "./dataTransferTypes";

export const LEAGUE_DATA_TRANSFER_FORMAT =
  "head2head-brawlin-steel-backup" as const;

export const LEAGUE_DATA_TRANSFER_VERSION = 1 as const;

export const LEAGUE_DATA_TRANSFER_STORAGE_KEYS = {
  league: "head2head-brawlin-steel.league.v1",
  seasonCloseoutArchives:
    "head2head-brawlin-steel.season-closeout-archives.v1",
  seasonAwardCoinFlips:
    "head2head-brawlin-steel.season-award-coin-flips.v1",
} as const;

const MAX_BACKUP_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isPositiveInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isNullablePositiveInteger(
  value: unknown,
): value is number | null {
  return value === null || isPositiveInteger(value);
}

function createIssue(
  code: LeagueDataTransferIssueCode,
  message: string,
): LeagueDataTransferValidationIssue {
  return { code, message };
}

function parseJsonRecord(
  rawValue: string,
): Record<string, unknown> | null {
  try {
    const parsedValue: unknown =
      JSON.parse(rawValue);

    return isRecord(parsedValue)
      ? parsedValue
      : null;
  } catch {
    return null;
  }
}

function getObjectCount(
  value: unknown,
): number {
  return isRecord(value)
    ? Object.keys(value).length
    : 0;
}

function getLeagueSummary(
  rawLeagueSnapshot: string,
  rawArchiveSnapshot: string | null,
  rawSeasonAwardSnapshot: string | null,
): LeagueDataTransferSummary {
  const leagueSnapshot =
    parseJsonRecord(rawLeagueSnapshot);

  const league = isRecord(
    leagueSnapshot?.league,
  )
    ? leagueSnapshot.league
    : {};

  const players = Array.isArray(
    league.players,
  )
    ? league.players
    : [];

  const season = isPositiveInteger(
    league.season,
  )
    ? league.season
    : null;

  const currentWeek = isPositiveInteger(
    league.currentWeek,
  )
    ? league.currentWeek
    : null;

  const archiveSnapshot =
    rawArchiveSnapshot
      ? parseJsonRecord(
          rawArchiveSnapshot,
        )
      : null;

  const archiveSource = isRecord(
    archiveSnapshot?.archives,
  )
    ? archiveSnapshot.archives
    : archiveSnapshot;

  const seasonAwardHistory =
    rawSeasonAwardSnapshot
      ? parseJsonRecord(
          rawSeasonAwardSnapshot,
        )
      : null;

  return {
    leagueName:
      typeof league.name === "string" &&
      league.name.trim()
        ? league.name.trim()
        : "Head2Head Brawlin'",
    season,
    currentWeek,
    playerCount: players.length,
    archiveCount:
      getObjectCount(archiveSource),
    seasonAwardCoinFlipCount:
      getObjectCount(seasonAwardHistory),
  };
}

function getDefaultSource(): LeagueDataTransferSource {
  if (typeof window === "undefined") {
    return {
      origin: "unknown",
      pathname: "/",
    };
  }

  return {
    origin: window.location.origin,
    pathname: window.location.pathname,
  };
}

function getDefaultStorage(): Storage {
  if (
    typeof window === "undefined" ||
    !window.localStorage
  ) {
    throw new Error(
      "Browser storage is unavailable. The league backup cannot be created or restored.",
    );
  }

  return window.localStorage;
}

function createChecksumPayload(
  backup: Omit<
    LeagueDataTransferBackup,
    "checksum"
  >,
): string {
  return JSON.stringify({
    format: backup.format,
    formatVersion: backup.formatVersion,
    exportedAt: backup.exportedAt,
    source: {
      origin: backup.source.origin,
      pathname: backup.source.pathname,
    },
    storage: {
      league: backup.storage.league,
      seasonCloseoutArchives:
        backup.storage
          .seasonCloseoutArchives,
      seasonAwardCoinFlips:
        backup.storage
          .seasonAwardCoinFlips,
    },
    summary: {
      leagueName: backup.summary.leagueName,
      season: backup.summary.season,
      currentWeek:
        backup.summary.currentWeek,
      playerCount:
        backup.summary.playerCount,
      archiveCount:
        backup.summary.archiveCount,
      seasonAwardCoinFlipCount:
        backup.summary
          .seasonAwardCoinFlipCount,
    },
  });
}

function calculateChecksum(
  value: string,
): string {
  let hash = 0x811c9dc5;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a-${(
    hash >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

function getBackupChecksum(
  backup: Omit<
    LeagueDataTransferBackup,
    "checksum"
  >,
): string {
  return calculateChecksum(
    createChecksumPayload(backup),
  );
}

function isValidLeagueSnapshot(
  rawValue: string,
): boolean {
  const snapshot = parseJsonRecord(rawValue);

  if (!snapshot) {
    return false;
  }

  return (
    isPositiveInteger(
      snapshot.schemaVersion,
    ) &&
    isNonEmptyString(snapshot.savedAt) &&
    isRecord(snapshot.league) &&
    isRecord(snapshot.picks) &&
    typeof snapshot.activePlayerId ===
      "string" &&
    isRecord(snapshot.gameResults) &&
    isRecord(snapshot.scoringHistory) &&
    isRecord(snapshot.pickerClickerHistory) &&
    isRecord(
      snapshot.obscureStatCoinFlipHistory,
    ) &&
    isRecord(snapshot.payoutLedgerHistory) &&
    isRecord(snapshot.playoffResultsHistory)
  );
}

function isValidArchiveSnapshot(
  rawValue: string | null,
): boolean {
  if (rawValue === null) {
    return true;
  }

  const snapshot = parseJsonRecord(rawValue);

  if (!snapshot) {
    return false;
  }

  if (isRecord(snapshot.archives)) {
    return (
      isPositiveInteger(
        snapshot.schemaVersion,
      ) &&
      isNonEmptyString(snapshot.savedAt)
    );
  }

  return true;
}

function isValidSeasonAwardSnapshot(
  rawValue: string | null,
): boolean {
  return (
    rawValue === null ||
    parseJsonRecord(rawValue) !== null
  );
}

function isValidSummary(
  value: unknown,
): value is LeagueDataTransferSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.leagueName) &&
    isNullablePositiveInteger(value.season) &&
    isNullablePositiveInteger(
      value.currentWeek,
    ) &&
    typeof value.playerCount === "number" &&
    Number.isInteger(value.playerCount) &&
    value.playerCount >= 0 &&
    typeof value.archiveCount === "number" &&
    Number.isInteger(value.archiveCount) &&
    value.archiveCount >= 0 &&
    typeof value.seasonAwardCoinFlipCount ===
      "number" &&
    Number.isInteger(
      value.seasonAwardCoinFlipCount,
    ) &&
    value.seasonAwardCoinFlipCount >= 0
  );
}

function buildValidatedBackup(
  value: Record<string, unknown>,
): LeagueDataTransferBackup | null {
  if (
    value.format !==
      LEAGUE_DATA_TRANSFER_FORMAT ||
    value.formatVersion !==
      LEAGUE_DATA_TRANSFER_VERSION ||
    !isNonEmptyString(value.exportedAt) ||
    !isRecord(value.source) ||
    !isNonEmptyString(value.source.origin) ||
    typeof value.source.pathname !==
      "string" ||
    !isRecord(value.storage) ||
    !isNonEmptyString(value.storage.league) ||
    !isNullableString(
      value.storage
        .seasonCloseoutArchives,
    ) ||
    !isNullableString(
      value.storage.seasonAwardCoinFlips,
    ) ||
    !isValidSummary(value.summary) ||
    !isNonEmptyString(value.checksum)
  ) {
    return null;
  }

  return {
    format: LEAGUE_DATA_TRANSFER_FORMAT,
    formatVersion:
      LEAGUE_DATA_TRANSFER_VERSION,
    exportedAt: value.exportedAt,
    source: {
      origin: value.source.origin,
      pathname: value.source.pathname,
    },
    storage: {
      league: value.storage.league,
      seasonCloseoutArchives:
        value.storage
          .seasonCloseoutArchives,
      seasonAwardCoinFlips:
        value.storage
          .seasonAwardCoinFlips,
    },
    summary: value.summary,
    checksum: value.checksum,
  };
}

export function createLeagueDataTransferBackup(
  storage: Storage = getDefaultStorage(),
  source: LeagueDataTransferSource =
    getDefaultSource(),
  exportedAt = new Date().toISOString(),
): LeagueDataTransferBackup {
  const leagueSnapshot = storage.getItem(
    LEAGUE_DATA_TRANSFER_STORAGE_KEYS.league,
  );

  if (!leagueSnapshot) {
    throw new Error(
      "No saved league data was found in this browser.",
    );
  }

  if (!isValidLeagueSnapshot(leagueSnapshot)) {
    throw new Error(
      "The saved league data is incomplete or damaged and cannot be exported safely.",
    );
  }

  const storageSnapshot:
    LeagueDataTransferStorageSnapshot = {
      league: leagueSnapshot,
      seasonCloseoutArchives:
        storage.getItem(
          LEAGUE_DATA_TRANSFER_STORAGE_KEYS
            .seasonCloseoutArchives,
        ),
      seasonAwardCoinFlips:
        storage.getItem(
          LEAGUE_DATA_TRANSFER_STORAGE_KEYS
            .seasonAwardCoinFlips,
        ),
    };

  if (
    !isValidArchiveSnapshot(
      storageSnapshot
        .seasonCloseoutArchives,
    )
  ) {
    throw new Error(
      "The saved season archive data is damaged and cannot be exported safely.",
    );
  }

  if (
    !isValidSeasonAwardSnapshot(
      storageSnapshot
        .seasonAwardCoinFlips,
    )
  ) {
    throw new Error(
      "The saved season-award coin-flip data is damaged and cannot be exported safely.",
    );
  }

  const backupWithoutChecksum = {
    format: LEAGUE_DATA_TRANSFER_FORMAT,
    formatVersion:
      LEAGUE_DATA_TRANSFER_VERSION,
    exportedAt,
    source,
    storage: storageSnapshot,
    summary: getLeagueSummary(
      storageSnapshot.league,
      storageSnapshot
        .seasonCloseoutArchives,
      storageSnapshot
        .seasonAwardCoinFlips,
    ),
  } satisfies Omit<
    LeagueDataTransferBackup,
    "checksum"
  >;

  return {
    ...backupWithoutChecksum,
    checksum: getBackupChecksum(
      backupWithoutChecksum,
    ),
  };
}

export function serializeLeagueDataTransferBackup(
  backup: LeagueDataTransferBackup,
): string {
  return JSON.stringify(backup, null, 2);
}

export function validateLeagueDataTransferText(
  fileText: string,
): LeagueDataTransferValidationResult {
  const issues:
    LeagueDataTransferValidationIssue[] = [];

  if (!fileText.trim()) {
    return {
      ok: false,
      backup: null,
      issues: [
        createIssue(
          "empty-file",
          "The selected backup file is empty.",
        ),
      ],
    };
  }

  if (
    new Blob([fileText]).size >
    MAX_BACKUP_FILE_SIZE_BYTES
  ) {
    return {
      ok: false,
      backup: null,
      issues: [
        createIssue(
          "file-too-large",
          "The selected backup file is larger than 20 MB.",
        ),
      ],
    };
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(fileText);
  } catch {
    return {
      ok: false,
      backup: null,
      issues: [
        createIssue(
          "invalid-json",
          "The selected file is not valid JSON.",
        ),
      ],
    };
  }

  if (!isRecord(parsedValue)) {
    return {
      ok: false,
      backup: null,
      issues: [
        createIssue(
          "invalid-format",
          "The selected file is not a Head2Head Brawlin' backup.",
        ),
      ],
    };
  }

  if (
    parsedValue.format !==
    LEAGUE_DATA_TRANSFER_FORMAT
  ) {
    issues.push(
      createIssue(
        "invalid-format",
        "The selected file is not a Head2Head Brawlin' Steel Edition backup.",
      ),
    );
  }

  if (
    parsedValue.formatVersion !==
    LEAGUE_DATA_TRANSFER_VERSION
  ) {
    issues.push(
      createIssue(
        "unsupported-version",
        "This backup version is not supported by the current app.",
      ),
    );
  }

  if (
    !isNonEmptyString(
      parsedValue.exportedAt,
    ) ||
    Number.isNaN(
      Date.parse(
        String(parsedValue.exportedAt),
      ),
    )
  ) {
    issues.push(
      createIssue(
        "invalid-export-date",
        "The backup does not contain a valid export date.",
      ),
    );
  }

  if (
    !isRecord(parsedValue.source) ||
    !isNonEmptyString(
      parsedValue.source.origin,
    ) ||
    typeof parsedValue.source.pathname !==
      "string"
  ) {
    issues.push(
      createIssue(
        "invalid-source",
        "The backup source information is invalid.",
      ),
    );
  }

  if (
    !isRecord(parsedValue.storage) ||
    !isNonEmptyString(
      parsedValue.storage.league,
    )
  ) {
    issues.push(
      createIssue(
        "missing-league-data",
        "The backup does not contain an active league snapshot.",
      ),
    );
  } else if (
    !isValidLeagueSnapshot(
      parsedValue.storage.league,
    )
  ) {
    issues.push(
      createIssue(
        "invalid-league-data",
        "The active league snapshot is incomplete or damaged.",
      ),
    );
  }

  if (
    isRecord(parsedValue.storage) &&
    (!isNullableString(
      parsedValue.storage
        .seasonCloseoutArchives,
    ) ||
      !isValidArchiveSnapshot(
        typeof parsedValue.storage
          .seasonCloseoutArchives ===
          "string"
          ? parsedValue.storage
              .seasonCloseoutArchives
          : null,
      ))
  ) {
    issues.push(
      createIssue(
        "invalid-archive-data",
        "The season archive snapshot is invalid.",
      ),
    );
  }

  if (
    isRecord(parsedValue.storage) &&
    (!isNullableString(
      parsedValue.storage
        .seasonAwardCoinFlips,
    ) ||
      !isValidSeasonAwardSnapshot(
        typeof parsedValue.storage
          .seasonAwardCoinFlips ===
          "string"
          ? parsedValue.storage
              .seasonAwardCoinFlips
          : null,
      ))
  ) {
    issues.push(
      createIssue(
        "invalid-season-award-data",
        "The season-award coin-flip snapshot is invalid.",
      ),
    );
  }

  if (!isValidSummary(parsedValue.summary)) {
    issues.push(
      createIssue(
        "invalid-summary",
        "The backup summary is invalid.",
      ),
    );
  }

  const backup =
    buildValidatedBackup(parsedValue);

  if (backup) {
    const {
      checksum: _checksum,
      ...backupWithoutChecksum
    } = backup;

    const expectedChecksum =
      getBackupChecksum(
        backupWithoutChecksum,
      );

    if (
      backup.checksum !== expectedChecksum
    ) {
      issues.push(
        createIssue(
          "checksum-mismatch",
          "The backup checksum does not match. The file may have been edited or damaged.",
        ),
      );
    }
  }

  if (issues.length > 0 || !backup) {
    return {
      ok: false,
      backup: null,
      issues:
        issues.length > 0
          ? issues
          : [
              createIssue(
                "invalid-format",
                "The backup file structure is invalid.",
              ),
            ],
    };
  }

  return {
    ok: true,
    backup,
    issues: [],
  };
}

export function applyLeagueDataTransferBackup(
  backup: LeagueDataTransferBackup,
  storage: Storage = getDefaultStorage(),
): LeagueDataTransferApplyResult {
  const validation =
    validateLeagueDataTransferText(
      serializeLeagueDataTransferBackup(
        backup,
      ),
    );

  if (!validation.ok) {
    throw new Error(
      validation.issues
        .map((issue) => issue.message)
        .join(" "),
    );
  }

  const keys =
    LEAGUE_DATA_TRANSFER_STORAGE_KEYS;

  const previousValues = {
    league: storage.getItem(keys.league),
    seasonCloseoutArchives:
      storage.getItem(
        keys.seasonCloseoutArchives,
      ),
    seasonAwardCoinFlips:
      storage.getItem(
        keys.seasonAwardCoinFlips,
      ),
  };

  let restoredStorageKeys = 0;
  let removedStorageKeys = 0;

  try {
    storage.setItem(
      keys.league,
      backup.storage.league,
    );
    restoredStorageKeys += 1;

    const optionalEntries = [
      {
        key: keys.seasonCloseoutArchives,
        value:
          backup.storage
            .seasonCloseoutArchives,
      },
      {
        key: keys.seasonAwardCoinFlips,
        value:
          backup.storage
            .seasonAwardCoinFlips,
      },
    ];

    optionalEntries.forEach(
      ({ key, value }) => {
        if (value === null) {
          storage.removeItem(key);
          removedStorageKeys += 1;
          return;
        }

        storage.setItem(key, value);
        restoredStorageKeys += 1;
      },
    );

    if (
      storage.getItem(keys.league) !==
      backup.storage.league
    ) {
      throw new Error(
        "The imported league data could not be verified after writing to browser storage.",
      );
    }
  } catch (error) {
    const rollbackEntries = [
      {
        key: keys.league,
        value: previousValues.league,
      },
      {
        key: keys.seasonCloseoutArchives,
        value:
          previousValues
            .seasonCloseoutArchives,
      },
      {
        key: keys.seasonAwardCoinFlips,
        value:
          previousValues
            .seasonAwardCoinFlips,
      },
    ];

    rollbackEntries.forEach(
      ({ key, value }) => {
        if (value === null) {
          storage.removeItem(key);
        } else {
          storage.setItem(key, value);
        }
      },
    );

    throw error;
  }

  return {
    restoredStorageKeys,
    removedStorageKeys,
    reloadRequired: true,
  };
}

export function getLeagueDataTransferFilename(
  backup: LeagueDataTransferBackup,
): string {
  const safeLeagueName =
    backup.summary.leagueName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "head2head-brawlin";

  const seasonLabel =
    backup.summary.season
      ? `-${backup.summary.season}`
      : "";

  const dateLabel = backup.exportedAt
    .slice(0, 10)
    .replace(/[^0-9-]/g, "");

  return `${safeLeagueName}${seasonLabel}-backup-${dateLabel}.h2h.json`;
}

export function downloadLeagueDataTransferBackup(
  backup: LeagueDataTransferBackup,
): void {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    throw new Error(
      "File downloads are unavailable in this environment.",
    );
  }

  const fileText =
    serializeLeagueDataTransferBackup(
      backup,
    );

  const fileBlob = new Blob(
    [fileText],
    { type: "application/json" },
  );

  const fileUrl = URL.createObjectURL(
    fileBlob,
  );

  const link = document.createElement("a");
  link.href = fileUrl;
  link.download =
    getLeagueDataTransferFilename(
      backup,
    );
  link.rel = "noopener";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(fileUrl);
}
