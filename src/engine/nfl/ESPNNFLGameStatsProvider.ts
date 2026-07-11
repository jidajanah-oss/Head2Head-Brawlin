import type {
  NFLGameStatsProvider,
  NFLGameStatsSnapshot,
  NFLTeamGameStats,
  NFLTeamGameLocation,
} from "./NFLGameStatsTypes";
import type { NFLGameStatus } from "./NFLTypes";

const ESPN_NFL_API_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

const REQUEST_TIMEOUT_MS = 15_000;

const TEAM_ABBREVIATION_ALIASES: Record<
  string,
  string
> = {
  JAC: "JAX",
  WSH: "WAS",
};

type ESPNStatusType = {
  name?: string;
  state?: string;
  completed?: boolean;
  description?: string;
  detail?: string;
  shortDetail?: string;
};

type ESPNStatus = {
  type?: ESPNStatusType;
};

type ESPNTeam = {
  id?: string;
  abbreviation?: string;
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
};

type ESPNCompetitor = {
  homeAway?: NFLTeamGameLocation;
  score?: string | number;
  winner?: boolean;
  team?: ESPNTeam;
};

type ESPNCompetition = {
  status?: ESPNStatus;
  competitors?: ESPNCompetitor[];
};

type ESPNWeekValue =
  | number
  | {
      number?: number;
    };

type ESPNStatistic = {
  name?: string;
  displayValue?: string;
  value?: string | number;
  label?: string;
};

type ESPNBoxscoreTeam = {
  team?: ESPNTeam;
  statistics?: ESPNStatistic[];
  homeAway?: NFLTeamGameLocation;
};

type ESPNPlayerStatAthlete = {
  stats?: string[];
};

type ESPNPlayerStatGroup = {
  name?: string;
  keys?: string[];
  labels?: string[];
  totals?: string[];
  athletes?: ESPNPlayerStatAthlete[];
};

type ESPNBoxscorePlayerTeam = {
  team?: ESPNTeam;
  statistics?: ESPNPlayerStatGroup[];
};

type ESPNSummaryResponse = {
  header?: {
    id?: string;
    season?: {
      year?: number;
    };
    week?: ESPNWeekValue;
    competitions?: ESPNCompetition[];
  };
  boxscore?: {
    teams?: ESPNBoxscoreTeam[];
    players?: ESPNBoxscorePlayerTeam[];
  };
};

type ParsedPair = {
  first: number;
  second: number;
};

function normalizeAbbreviation(
  value: string | undefined,
): string {
  const abbreviation =
    value?.trim().toUpperCase() ?? "";

  return (
    TEAM_ABBREVIATION_ALIASES[
      abbreviation
    ] ?? abbreviation
  );
}

function readFiniteNumber(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value
    .trim()
    .replaceAll(",", "");

  if (
    !normalizedValue ||
    normalizedValue === "-" ||
    normalizedValue === "--"
  ) {
    return null;
  }

  const parsedValue = Number(
    normalizedValue,
  );

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

function readInteger(
  value: unknown,
): number | null {
  const parsedValue =
    readFiniteNumber(value);

  return parsedValue === null
    ? null
    : Math.trunc(parsedValue);
}

function readWeekNumber(
  value: ESPNWeekValue | undefined,
): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value
      : null;
  }

  return readInteger(value?.number);
}

function parsePair(
  value: string | undefined,
): ParsedPair | null {
  if (!value) {
    return null;
  }

  const match = value
    .trim()
    .match(
      /^(-?\d+(?:\.\d+)?)\s*[-/]\s*(-?\d+(?:\.\d+)?)$/,
    );

  if (!match) {
    return null;
  }

  const first = readFiniteNumber(match[1]);
  const second = readFiniteNumber(match[2]);

  if (
    first === null ||
    second === null
  ) {
    return null;
  }

  return {
    first,
    second,
  };
}

function safeDivide(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function mapGameStatus(
  status: ESPNStatus | undefined,
): NFLGameStatus {
  const statusType = status?.type;

  const name =
    statusType?.name?.toUpperCase() ?? "";

  const state =
    statusType?.state?.toLowerCase() ?? "";

  const description = [
    statusType?.description,
    statusType?.detail,
    statusType?.shortDetail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    name.includes("CANCELED") ||
    description.includes("canceled")
  ) {
    return "canceled";
  }

  if (
    name.includes("POSTPONED") ||
    description.includes("postponed")
  ) {
    return "postponed";
  }

  if (
    statusType?.completed === true ||
    name.includes("FINAL") ||
    state === "post"
  ) {
    return "final";
  }

  if (
    name.includes("HALFTIME") ||
    description.includes("halftime")
  ) {
    return "halftime";
  }

  if (
    state === "in" ||
    name.includes("IN_PROGRESS")
  ) {
    return "in_progress";
  }

  if (
    name.includes("PREGAME") ||
    name.includes("WARMUP") ||
    description.includes("pregame")
  ) {
    return "pregame";
  }

  return "scheduled";
}

function findStatistic(
  statistics: ESPNStatistic[] | undefined,
  name: string,
): ESPNStatistic | null {
  const normalizedName =
    name.toLowerCase();

  return (
    statistics?.find(
      (statistic) =>
        statistic.name?.toLowerCase() ===
        normalizedName,
    ) ?? null
  );
}

function readStatisticNumber(
  statistics: ESPNStatistic[] | undefined,
  name: string,
): number | null {
  const statistic = findStatistic(
    statistics,
    name,
  );

  if (!statistic) {
    return null;
  }

  return (
    readFiniteNumber(statistic.value) ??
    readFiniteNumber(
      statistic.displayValue,
    )
  );
}

function readStatisticPair(
  statistics: ESPNStatistic[] | undefined,
  name: string,
): ParsedPair | null {
  const statistic = findStatistic(
    statistics,
    name,
  );

  return parsePair(
    statistic?.displayValue,
  );
}

function readPossessionSeconds(
  statistics: ESPNStatistic[] | undefined,
): number | null {
  const statistic = findStatistic(
    statistics,
    "possessionTime",
  );

  if (!statistic) {
    return null;
  }

  const numericValue = readInteger(
    statistic.value,
  );

  if (numericValue !== null) {
    return numericValue;
  }

  const displayValue =
    statistic.displayValue?.trim();

  if (!displayValue) {
    return null;
  }

  const match = displayValue.match(
    /^(\d+):(\d{1,2})$/,
  );

  if (!match) {
    return null;
  }

  const minutes = readInteger(match[1]);
  const seconds = readInteger(match[2]);

  if (
    minutes === null ||
    seconds === null ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return minutes * 60 + seconds;
}

function teamsMatch(
  teamA: ESPNTeam | undefined,
  teamB: ESPNTeam | undefined,
): boolean {
  if (!teamA || !teamB) {
    return false;
  }

  if (
    teamA.id &&
    teamB.id &&
    teamA.id === teamB.id
  ) {
    return true;
  }

  const abbreviationA =
    normalizeAbbreviation(
      teamA.abbreviation,
    );

  const abbreviationB =
    normalizeAbbreviation(
      teamB.abbreviation,
    );

  return (
    Boolean(abbreviationA) &&
    abbreviationA === abbreviationB
  );
}

function findCompetitor(
  team: ESPNTeam | undefined,
  competitors:
    | ESPNCompetitor[]
    | undefined,
): ESPNCompetitor | null {
  return (
    competitors?.find((competitor) =>
      teamsMatch(
        team,
        competitor.team,
      ),
    ) ?? null
  );
}

function findPlayerStatsForTeam(
  team: ESPNTeam | undefined,
  playerTeams:
    | ESPNBoxscorePlayerTeam[]
    | undefined,
): ESPNBoxscorePlayerTeam | null {
  return (
    playerTeams?.find((playerTeam) =>
      teamsMatch(team, playerTeam.team),
    ) ?? null
  );
}

function getPuntingStatIndex(
  group: ESPNPlayerStatGroup,
): number {
  const preferredKeys = new Set([
    "punts",
    "puntingattempts",
    "puntsattempted",
  ]);

  const matchingIndex =
    group.keys?.findIndex((key) =>
      preferredKeys.has(
        key.trim().toLowerCase(),
      ),
    ) ?? -1;

  return matchingIndex >= 0
    ? matchingIndex
    : 0;
}

function readPunts(
  team: ESPNTeam | undefined,
  playerTeams:
    | ESPNBoxscorePlayerTeam[]
    | undefined,
  isFinal: boolean,
): number | null {
  const playerTeam =
    findPlayerStatsForTeam(
      team,
      playerTeams,
    );

  if (!playerTeam) {
    return null;
  }

  const puntingGroup =
    playerTeam.statistics?.find(
      (group) =>
        group.name?.toLowerCase() ===
        "punting",
    );

  if (!puntingGroup) {
    return isFinal ? 0 : null;
  }

  const statIndex =
    getPuntingStatIndex(puntingGroup);

  const totalPunts = readInteger(
    puntingGroup.totals?.[statIndex],
  );

  if (totalPunts !== null) {
    return totalPunts;
  }

  const athletePunts =
    puntingGroup.athletes
      ?.map((athlete) =>
        readInteger(
          athlete.stats?.[statIndex],
        ),
      )
      .filter(
        (value): value is number =>
          value !== null,
      ) ?? [];

  if (athletePunts.length === 0) {
    return isFinal ? 0 : null;
  }

  return athletePunts.reduce(
    (total, punts) => total + punts,
    0,
  );
}

function resolveTeamIdentity(
  team: ESPNTeam | undefined,
): {
  teamId: string;
  abbreviation: string;
  displayName: string;
} | null {
  const abbreviation =
    normalizeAbbreviation(
      team?.abbreviation,
    );

  const teamId =
    team?.id?.trim() || abbreviation;

  if (!teamId || !abbreviation) {
    return null;
  }

  const displayName =
    team?.displayName?.trim() ||
    team?.shortDisplayName?.trim() ||
    team?.name?.trim() ||
    abbreviation;

  return {
    teamId,
    abbreviation,
    displayName,
  };
}

function mapTeamGameStats(
  boxscoreTeam: ESPNBoxscoreTeam,
  competitor: ESPNCompetitor | null,
  playerTeams:
    | ESPNBoxscorePlayerTeam[]
    | undefined,
  isFinal: boolean,
): NFLTeamGameStats | null {
  const identity = resolveTeamIdentity(
    boxscoreTeam.team,
  );

  const homeAway =
    boxscoreTeam.homeAway ??
    competitor?.homeAway;

  if (!identity || !homeAway) {
    return null;
  }

  const statistics =
    boxscoreTeam.statistics;

  const thirdDown =
    readStatisticPair(
      statistics,
      "thirdDownEff",
    );

  const completionAttempts =
    readStatisticPair(
      statistics,
      "completionAttempts",
    );

  const sacksYardsLost =
    readStatisticPair(
      statistics,
      "sacksYardsLost",
    );

  const totalOffensivePlays =
    readInteger(
      readStatisticNumber(
        statistics,
        "totalOffensivePlays",
      ),
    );

  const totalYards = readInteger(
    readStatisticNumber(
      statistics,
      "totalYards",
    ),
  );

  const netPassingYards = readInteger(
    readStatisticNumber(
      statistics,
      "netPassingYards",
    ),
  );

  const passingAttempts =
    completionAttempts === null
      ? null
      : Math.trunc(
          completionAttempts.second,
        );

  const sacksAllowed =
    sacksYardsLost === null
      ? null
      : Math.trunc(
          sacksYardsLost.first,
        );

  const rushingYards = readInteger(
    readStatisticNumber(
      statistics,
      "rushingYards",
    ),
  );

  const rushingAttempts = readInteger(
    readStatisticNumber(
      statistics,
      "rushingAttempts",
    ),
  );

  const yardsPerPlay =
    readStatisticNumber(
      statistics,
      "yardsPerPlay",
    ) ??
    safeDivide(
      totalYards,
      totalOffensivePlays,
    );

  const yardsPerPassAttempt =
    readStatisticNumber(
      statistics,
      "yardsPerPass",
    ) ??
    safeDivide(
      netPassingYards,
      passingAttempts === null
        ? null
        : passingAttempts +
            (sacksAllowed ?? 0),
    );

  const yardsPerRushAttempt =
    readStatisticNumber(
      statistics,
      "yardsPerRushAttempt",
    ) ??
    safeDivide(
      rushingYards,
      rushingAttempts,
    );

  return {
    teamId: identity.teamId,
    abbreviation:
      identity.abbreviation,
    displayName: identity.displayName,
    homeAway,

    score: readInteger(
      competitor?.score,
    ),
    wonGame: null,

    firstDowns: readInteger(
      readStatisticNumber(
        statistics,
        "firstDowns",
      ),
    ),

    thirdDownConversions:
      thirdDown === null
        ? null
        : Math.trunc(thirdDown.first),

    thirdDownAttempts:
      thirdDown === null
        ? null
        : Math.trunc(thirdDown.second),

    totalOffensivePlays,
    totalYards,
    yardsPerPlay,

    netPassingYards,
    passingAttempts,
    sacksAllowed,
    yardsPerPassAttempt,

    rushingYards,
    rushingAttempts,
    yardsPerRushAttempt,

    punts: readPunts(
      boxscoreTeam.team,
      playerTeams,
      isFinal,
    ),

    possessionSeconds:
      readPossessionSeconds(
        statistics,
      ),
  };
}

function resolveWonGame(
  score: number | null,
  opponentScore: number | null,
  winnerFlag: boolean | undefined,
  isFinal: boolean,
): boolean | null {
  if (!isFinal) {
    return null;
  }

  if (typeof winnerFlag === "boolean") {
    return winnerFlag;
  }

  if (
    score === null ||
    opponentScore === null
  ) {
    return null;
  }

  return score > opponentScore;
}

function mapSummaryResponse(
  response: ESPNSummaryResponse,
  requestedGameId: string,
): NFLGameStatsSnapshot | null {
  const competition =
    response.header?.competitions?.[0];

  const competitors =
    competition?.competitors;

  const status = mapGameStatus(
    competition?.status,
  );

  const isFinal = status === "final";

  const boxscoreTeams =
    response.boxscore?.teams ?? [];

  const awayBoxscoreTeam =
    boxscoreTeams.find(
      (team) =>
        team.homeAway === "away",
    );

  const homeBoxscoreTeam =
    boxscoreTeams.find(
      (team) =>
        team.homeAway === "home",
    );

  if (
    !awayBoxscoreTeam ||
    !homeBoxscoreTeam
  ) {
    return null;
  }

  const awayCompetitor =
    findCompetitor(
      awayBoxscoreTeam.team,
      competitors,
    );

  const homeCompetitor =
    findCompetitor(
      homeBoxscoreTeam.team,
      competitors,
    );

  const awayTeam = mapTeamGameStats(
    awayBoxscoreTeam,
    awayCompetitor,
    response.boxscore?.players,
    isFinal,
  );

  const homeTeam = mapTeamGameStats(
    homeBoxscoreTeam,
    homeCompetitor,
    response.boxscore?.players,
    isFinal,
  );

  if (!awayTeam || !homeTeam) {
    return null;
  }

  const finalizedAwayTeam: NFLTeamGameStats =
    {
      ...awayTeam,
      wonGame: resolveWonGame(
        awayTeam.score,
        homeTeam.score,
        awayCompetitor?.winner,
        isFinal,
      ),
    };

  const finalizedHomeTeam: NFLTeamGameStats =
    {
      ...homeTeam,
      wonGame: resolveWonGame(
        homeTeam.score,
        awayTeam.score,
        homeCompetitor?.winner,
        isFinal,
      ),
    };

  return {
    gameId:
      response.header?.id?.trim() ||
      requestedGameId,

    season:
      readInteger(
        response.header?.season?.year,
      ),

    week: readWeekNumber(
      response.header?.week,
    ),

    status,
    isFinal,

    awayTeam: finalizedAwayTeam,
    homeTeam: finalizedHomeTeam,

    fetchedAt: new Date().toISOString(),
  };
}

export class ESPNNFLGameStatsProvider
  implements NFLGameStatsProvider
{
  private readonly gameCache = new Map<
    string,
    NFLGameStatsSnapshot
  >();

  async getGameStatsById(
    gameId: string,
  ): Promise<NFLGameStatsSnapshot | null> {
    const normalizedGameId =
      gameId.trim();

    if (!normalizedGameId) {
      return null;
    }

    const query = new URLSearchParams({
      event: normalizedGameId,
    });

    try {
      const response =
        await this.fetchJson<ESPNSummaryResponse>(
          `${ESPN_NFL_API_BASE}/summary?${query.toString()}`,
        );

      const snapshot =
        mapSummaryResponse(
          response,
          normalizedGameId,
        );

      if (snapshot) {
        this.gameCache.set(
          normalizedGameId,
          snapshot,
        );
      }

      return (
        snapshot ??
        this.gameCache.get(
          normalizedGameId,
        ) ??
        null
      );
    } catch (error) {
      const cachedSnapshot =
        this.gameCache.get(
          normalizedGameId,
        );

      if (cachedSnapshot) {
        return cachedSnapshot;
      }

      throw error;
    }
  }

  private async fetchJson<T>(
    url: string,
  ): Promise<T> {
    const controller =
      new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `ESPN NFL game-stat request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw new Error(
          "ESPN NFL game-stat request timed out.",
          {
            cause: error,
          },
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}