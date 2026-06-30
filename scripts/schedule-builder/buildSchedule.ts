/// <reference types="node" />

import fs from "fs";
import path from "path";

type RawGame = {
  week: number;
  awayTeam: string;
  homeTeam: string;
  kickoff: string;
};

type ScheduleGame = {
  id: string;
  season: number;
  week: number;
  awayTeam: string;
  homeTeam: string;
  kickoff: string;
  completed: boolean;
};

type ScheduleWeek = {
  season: number;
  week: number;
  games: ScheduleGame[];
};

const SEASON = 2026;
const VALID_TEAMS = new Set([
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
]);

const inputPath = path.join(
  process.cwd(),
  "scripts",
  "schedule-builder",
  "schedule-input.json"
);

const scheduleOutputPath = path.join(
  process.cwd(),
  "src",
  "data",
  "nfl",
  "schedule",
  "2026.json"
);

const byeOutputPath = path.join(
  process.cwd(),
  "src",
  "data",
  "nfl",
  "byeWeeks.ts"
);

function createGameId(game: RawGame) {
  return `${SEASON}-W${game.week}-${game.awayTeam}-${game.homeTeam}`;
}

function validateGame(game: RawGame, index: number) {
  const label = `Game ${index + 1}`;

  if (!game.week || game.week < 1 || game.week > 18) {
    throw new Error(`${label}: invalid week "${game.week}"`);
  }

  if (!VALID_TEAMS.has(game.awayTeam)) {
    throw new Error(`${label}: invalid away team "${game.awayTeam}"`);
  }

  if (!VALID_TEAMS.has(game.homeTeam)) {
    throw new Error(`${label}: invalid home team "${game.homeTeam}"`);
  }

  if (game.awayTeam === game.homeTeam) {
    throw new Error(`${label}: team cannot play itself`);
  }

  if (!game.kickoff || Number.isNaN(Date.parse(game.kickoff))) {
    throw new Error(`${label}: invalid kickoff "${game.kickoff}"`);
  }
}

function buildSchedule(rawGames: RawGame[]): ScheduleWeek[] {
  const seenIds = new Set<string>();
  const weeks = new Map<number, ScheduleGame[]>();

  rawGames.forEach((game, index) => {
    validateGame(game, index);

    const id = createGameId(game);

    if (seenIds.has(id)) {
      throw new Error(`Duplicate game detected: ${id}`);
    }

    seenIds.add(id);

    const converted: ScheduleGame = {
      id,
      season: SEASON,
      week: game.week,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      kickoff: game.kickoff,
      completed: false,
    };

    if (!weeks.has(game.week)) {
      weeks.set(game.week, []);
    }

    weeks.get(game.week)!.push(converted);
  });

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, games]) => ({
      season: SEASON,
      week,
      games: games.sort(
        (a, b) =>
          new Date(a.kickoff).getTime() -
          new Date(b.kickoff).getTime()
      ),
    }));
}

function buildByeWeeks(schedule: ScheduleWeek[]) {
  const byeWeeks: Record<string, number> = {};

  for (const week of schedule) {
    const activeTeams = new Set<string>();

    for (const game of week.games) {
      activeTeams.add(game.awayTeam);
      activeTeams.add(game.homeTeam);
    }

    for (const team of VALID_TEAMS) {
      if (!activeTeams.has(team) && !byeWeeks[team]) {
        byeWeeks[team] = week.week;
      }
    }
  }

  return byeWeeks;
}

function writeByeWeeks(byeWeeks: Record<string, number>) {
  const content = `export type NFLByeWeekMap = Record<string, number>;

export const byeWeeks2026: NFLByeWeekMap = ${JSON.stringify(
    byeWeeks,
    null,
    2
  )};

export function getByeWeek(teamId: string, season: number) {
  if (season === 2026) {
    return byeWeeks2026[teamId] ?? null;
  }

  return null;
}
`;

  fs.writeFileSync(byeOutputPath, content);
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error("Missing scripts/schedule-builder/schedule-input.json");
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const rawGames = JSON.parse(raw) as RawGame[];

  const schedule = buildSchedule(rawGames);
  const byeWeeks = buildByeWeeks(schedule);

  fs.writeFileSync(scheduleOutputPath, JSON.stringify(schedule, null, 2));
  writeByeWeeks(byeWeeks);

  console.log(`✅ Built ${rawGames.length} games`);
  console.log(`✅ Wrote ${scheduleOutputPath}`);
  console.log(`✅ Wrote ${byeOutputPath}`);
}

main();