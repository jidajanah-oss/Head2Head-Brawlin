import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NFLGame,
  NFLGameStatus,
} from "../engine/nfl/NFLTypes";

export type CloudLeagueGameStatus =
  | "scheduled"
  | "live"
  | "final"
  | "canceled";

export type CloudLeagueGame = {
  leagueId: string;
  gameId: string;
  season: number;
  week: number;
  awayTeam: string;
  homeTeam: string;
  kickoffAt: string;
  status: CloudLeagueGameStatus;
  awayScore: number | null;
  homeScore: number | null;
  winnerTeam: string | null;
  createdAt: string;
  updatedAt: string;
};

type CloudLeagueGameRow = {
  league_id: string;
  game_id: string;
  season: number;
  week: number;
  away_team: string;
  home_team: string;
  kickoff_at: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  winner_team: string | null;
  created_at: string;
  updated_at: string;
};

const LEAGUE_GAME_COLUMNS = [
  "league_id",
  "game_id",
  "season",
  "week",
  "away_team",
  "home_team",
  "kickoff_at",
  "status",
  "away_score",
  "home_score",
  "winner_team",
  "created_at",
  "updated_at",
].join(",");

function normalizeRequiredIdentifier(
  value: string,
  label: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  return normalizedValue;
}

function normalizeSeason(season: number): number {
  if (
    !Number.isInteger(season) ||
    season < 2000 ||
    season > 2100
  ) {
    throw new Error("Season must be an integer between 2000 and 2100.");
  }

  return season;
}

function normalizeWeek(week: number): number {
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error("Week must be an integer between 1 and 18.");
  }

  return week;
}

function normalizeNFLTeam(team: string): string {
  const normalizedTeam = team.trim().toUpperCase();

  if (!/^[A-Z]{2,3}$/.test(normalizedTeam)) {
    throw new Error("A valid NFL team abbreviation is required.");
  }

  return normalizedTeam;
}

function normalizeKickoff(kickoff: string): string {
  const normalizedKickoff = kickoff.trim();

  if (
    !normalizedKickoff ||
    Number.isNaN(Date.parse(normalizedKickoff))
  ) {
    throw new Error("A valid kickoff timestamp is required.");
  }

  return normalizedKickoff;
}

function isNullableNumber(
  value: unknown,
): value is number | null {
  return value === null || typeof value === "number";
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isCloudLeagueGameStatus(
  value: string,
): value is CloudLeagueGameStatus {
  return (
    value === "scheduled" ||
    value === "live" ||
    value === "final" ||
    value === "canceled"
  );
}

function getCloudLeagueGameRow(
  value: unknown,
): CloudLeagueGameRow | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.league_id !== "string" ||
    typeof row.game_id !== "string" ||
    typeof row.season !== "number" ||
    typeof row.week !== "number" ||
    typeof row.away_team !== "string" ||
    typeof row.home_team !== "string" ||
    typeof row.kickoff_at !== "string" ||
    typeof row.status !== "string" ||
    !isNullableNumber(row.away_score) ||
    !isNullableNumber(row.home_score) ||
    !isNullableString(row.winner_team) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    league_id: row.league_id,
    game_id: row.game_id,
    season: row.season,
    week: row.week,
    away_team: row.away_team,
    home_team: row.home_team,
    kickoff_at: row.kickoff_at,
    status: row.status,
    away_score: row.away_score,
    home_score: row.home_score,
    winner_team: row.winner_team,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCloudLeagueGameRow(
  row: CloudLeagueGameRow,
): CloudLeagueGame {
  const status = row.status;

  if (!isCloudLeagueGameStatus(status)) {
    throw new Error(
      `The cloud game contains an unsupported status: ${status}.`,
    );
  }

  return {
    leagueId: normalizeRequiredIdentifier(
      row.league_id,
      "League ID",
    ),
    gameId: normalizeRequiredIdentifier(
      row.game_id,
      "Game ID",
    ),
    season: normalizeSeason(row.season),
    week: normalizeWeek(row.week),
    awayTeam: normalizeNFLTeam(row.away_team),
    homeTeam: normalizeNFLTeam(row.home_team),
    kickoffAt: normalizeKickoff(row.kickoff_at),
    status,
    awayScore: row.away_score,
    homeScore: row.home_score,
    winnerTeam:
      row.winner_team === null
        ? null
        : normalizeNFLTeam(row.winner_team),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCloudLeagueGameRows(
  value: unknown,
): CloudLeagueGame[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "The cloud game service returned an invalid response.",
    );
  }

  return value.map((item) => {
    const row = getCloudLeagueGameRow(item);

    if (!row) {
      throw new Error(
        "The cloud game service returned an invalid game row.",
      );
    }

    return mapCloudLeagueGameRow(row);
  });
}

function mapNFLGameStatus(
  status: NFLGameStatus,
): CloudLeagueGameStatus {
  switch (status) {
    case "in_progress":
    case "halftime":
      return "live";
    case "final":
      return "final";
    case "canceled":
      return "canceled";
    case "scheduled":
    case "pregame":
    case "postponed":
      return "scheduled";
  }
}

function getWinnerTeam(game: NFLGame): string | null {
  if (
    game.status !== "final" ||
    !game.score ||
    game.score.away === game.score.home
  ) {
    return null;
  }

  return game.score.away > game.score.home
    ? normalizeNFLTeam(game.awayTeam.abbreviation)
    : normalizeNFLTeam(game.homeTeam.abbreviation);
}

function mapNFLGamePayload(
  leagueId: string,
  game: NFLGame,
): Record<string, unknown> {
  const awayTeam = normalizeNFLTeam(
    game.awayTeam.abbreviation,
  );
  const homeTeam = normalizeNFLTeam(
    game.homeTeam.abbreviation,
  );

  if (awayTeam === homeTeam) {
    throw new Error("A league game must contain two different teams.");
  }

  return {
    league_id: leagueId,
    game_id: normalizeRequiredIdentifier(game.id, "Game ID"),
    season: normalizeSeason(game.season),
    week: normalizeWeek(game.week),
    away_team: awayTeam,
    home_team: homeTeam,
    kickoff_at: normalizeKickoff(game.kickoff),
    status: mapNFLGameStatus(game.status),
    away_score: game.score?.away ?? null,
    home_score: game.score?.home ?? null,
    winner_team: getWinnerTeam(game),
  };
}

function wrapCloudGameError(
  action: string,
  message: string,
): Error {
  const normalizedMessage = message.trim();

  if (normalizedMessage.includes("row-level security")) {
    return new Error(
      `Unable to ${action}: the signed-in account cannot manage league games.`,
    );
  }

  return new Error(
    `Unable to ${action}: ${
      normalizedMessage || "unknown cloud error"
    }`,
  );
}

export async function loadCloudLeagueGames(
  client: SupabaseClient,
  leagueId: string,
  season: number,
  week: number,
): Promise<CloudLeagueGame[]> {
  const normalizedLeagueId = normalizeRequiredIdentifier(
    leagueId,
    "League ID",
  );
  const normalizedSeason = normalizeSeason(season);
  const normalizedWeek = normalizeWeek(week);

  const { data, error } = await client
    .from("league_games")
    .select(LEAGUE_GAME_COLUMNS)
    .eq("league_id", normalizedLeagueId)
    .eq("season", normalizedSeason)
    .eq("week", normalizedWeek)
    .order("kickoff_at", { ascending: true })
    .order("game_id", { ascending: true });

  if (error) {
    throw wrapCloudGameError(
      "load cloud league games",
      error.message,
    );
  }

  return mapCloudLeagueGameRows(data);
}

export async function synchronizeCloudLeagueGames(
  client: SupabaseClient,
  leagueId: string,
  games: NFLGame[],
): Promise<CloudLeagueGame[]> {
  const normalizedLeagueId = normalizeRequiredIdentifier(
    leagueId,
    "League ID",
  );

  if (games.length === 0) {
    return [];
  }

  const payload = games.map((game) =>
    mapNFLGamePayload(normalizedLeagueId, game),
  );

  const { data, error } = await client
    .from("league_games")
    .upsert(payload, {
      onConflict: "league_id,game_id",
    })
    .select(LEAGUE_GAME_COLUMNS);

  if (error) {
    throw wrapCloudGameError(
      "synchronize cloud league games",
      error.message,
    );
  }

  return mapCloudLeagueGameRows(data).sort((left, right) => {
    const kickoffDifference =
      Date.parse(left.kickoffAt) - Date.parse(right.kickoffAt);

    return kickoffDifference ||
      left.gameId.localeCompare(right.gameId);
  });
}
