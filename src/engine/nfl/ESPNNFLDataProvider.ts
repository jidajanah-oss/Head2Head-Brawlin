import type { NFLDataProvider } from "./NFLDataProvider";
import type {
  NFLGame,
  NFLGameStatus,
  NFLTeamRef,
} from "./NFLTypes";

const ESPN_NFL_API_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

const REGULAR_SEASON_TYPE = "2";
const FIRST_REGULAR_SEASON_WEEK = 1;
const LAST_REGULAR_SEASON_WEEK = 18;
const REQUEST_TIMEOUT_MS = 15_000;

const TEAM_ABBREVIATION_ALIASES: Record<string, string> = {
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
  homeAway?: "home" | "away";
  score?: string | number;
  team?: ESPNTeam;
};

type ESPNCompetition = {
  date?: string;
  status?: ESPNStatus;
  competitors?: ESPNCompetitor[];
};

type ESPNEvent = {
  id?: string;
  date?: string;
  status?: ESPNStatus;
  competitions?: ESPNCompetition[];
};

type ESPNScoreboardResponse = {
  events?: ESPNEvent[];
};

type ESPNWeekValue =
  | number
  | {
      number?: number;
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
};

function normalizeAbbreviation(value: string | undefined): string {
  const abbreviation = value?.trim().toUpperCase() ?? "";

  return TEAM_ABBREVIATION_ALIASES[abbreviation] ?? abbreviation;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readWeekNumber(value: ESPNWeekValue | undefined): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  return readFiniteNumber(value?.number);
}

function mapGameStatus(status: ESPNStatus | undefined): NFLGameStatus {
  const statusType = status?.type;
  const name = statusType?.name?.toUpperCase() ?? "";
  const state = statusType?.state?.toLowerCase() ?? "";

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

function mapTeam(team: ESPNTeam | undefined): NFLTeamRef | null {
  const abbreviation = normalizeAbbreviation(team?.abbreviation);

  if (!abbreviation) {
    return null;
  }

  const name =
    team?.name?.trim() ||
    team?.shortDisplayName?.trim() ||
    abbreviation;

  const displayName =
    team?.displayName?.trim() ||
    name;

  return {
    id: team?.id?.trim() || abbreviation,
    abbreviation,
    name,
    displayName,
  };
}

function mapEvent(
  event: ESPNEvent,
  season: number,
  week: number,
): NFLGame | null {
  const competition = event.competitions?.[0];

  const homeCompetitor = competition?.competitors?.find(
    (competitor) => competitor.homeAway === "home",
  );

  const awayCompetitor = competition?.competitors?.find(
    (competitor) => competitor.homeAway === "away",
  );

  const homeTeam = mapTeam(homeCompetitor?.team);
  const awayTeam = mapTeam(awayCompetitor?.team);
  const kickoff = event.date ?? competition?.date;
  const id = event.id?.trim();

  if (
    !id ||
    !kickoff ||
    !homeTeam ||
    !awayTeam
  ) {
    return null;
  }

  const homeScore = readFiniteNumber(homeCompetitor?.score);
  const awayScore = readFiniteNumber(awayCompetitor?.score);

  const score =
    homeScore !== null && awayScore !== null
      ? {
          home: homeScore,
          away: awayScore,
        }
      : undefined;

  return {
    id,
    season,
    week,
    kickoff,
    status: mapGameStatus(
      event.status ?? competition?.status,
    ),
    homeTeam,
    awayTeam,
    ...(score ? { score } : {}),
  };
}

export class ESPNNFLDataProvider implements NFLDataProvider {
  private readonly gameCache = new Map<string, NFLGame>();

  async getGamesByWeek(
    season: number,
    week: number,
  ): Promise<NFLGame[]> {
    this.validateSeasonAndWeek(season, week);

    const query = new URLSearchParams({
      dates: String(season),
      seasontype: REGULAR_SEASON_TYPE,
      week: String(week),
      limit: "100",
    });

    const response =
      await this.fetchJson<ESPNScoreboardResponse>(
        `${ESPN_NFL_API_BASE}/scoreboard?${query.toString()}`,
      );

    const games = (response.events ?? [])
      .map((event) => mapEvent(event, season, week))
      .filter(
        (game): game is NFLGame =>
          game !== null,
      )
      .sort(
        (gameA, gameB) =>
          new Date(gameA.kickoff).getTime() -
          new Date(gameB.kickoff).getTime(),
      );

    for (const game of games) {
      this.gameCache.set(game.id, game);
    }

    return games;
  }

  async getGameById(
    gameId: string,
  ): Promise<NFLGame | null> {
    const normalizedGameId = gameId.trim();

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

      const header = response.header;
      const competition = header?.competitions?.[0];
      const season = readFiniteNumber(
        header?.season?.year,
      );
      const week = readWeekNumber(header?.week);

      if (
        !competition ||
        season === null ||
        week === null
      ) {
        return (
          this.gameCache.get(normalizedGameId) ??
          null
        );
      }

      const game = mapEvent(
        {
          id: header?.id ?? normalizedGameId,
          date: competition.date,
          status: competition.status,
          competitions: [competition],
        },
        season,
        week,
      );

      if (game) {
        this.gameCache.set(game.id, game);
      }

      return (
        game ??
        this.gameCache.get(normalizedGameId) ??
        null
      );
    } catch (error) {
      const cachedGame =
        this.gameCache.get(normalizedGameId);

      if (cachedGame) {
        return cachedGame;
      }

      throw error;
    }
  }

  private validateSeasonAndWeek(
    season: number,
    week: number,
  ): void {
    if (
      !Number.isInteger(season) ||
      season < 2000
    ) {
      throw new Error(
        `Invalid NFL season: ${season}`,
      );
    }

    if (
      !Number.isInteger(week) ||
      week < FIRST_REGULAR_SEASON_WEEK ||
      week > LAST_REGULAR_SEASON_WEEK
    ) {
      throw new Error(
        `NFL regular-season week must be between ${FIRST_REGULAR_SEASON_WEEK} and ${LAST_REGULAR_SEASON_WEEK}.`,
      );
    }
  }

  private async fetchJson<T>(
    url: string,
  ): Promise<T> {
    const controller = new AbortController();

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
          `ESPN NFL data request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw new Error(
          "ESPN NFL data request timed out.",
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