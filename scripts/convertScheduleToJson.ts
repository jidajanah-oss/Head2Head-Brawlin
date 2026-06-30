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

const inputPath = path.join(process.cwd(), "scripts", "schedule-input.json");
const outputPath = path.join(
  process.cwd(),
  "src",
  "data",
  "nfl",
  "schedule",
  "2026.json"
);

function createGameId(game: RawGame) {
  return `${SEASON}-W${game.week}-${game.awayTeam}-${game.homeTeam}`;
}

function convertSchedule(rawGames: RawGame[]): ScheduleWeek[] {
  const weeks = new Map<number, ScheduleGame[]>();

  for (const game of rawGames) {
    const converted: ScheduleGame = {
      id: createGameId(game),
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
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, games]) => ({
      season: SEASON,
      week,
      games,
    }));
}

function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(
      "Missing scripts/schedule-input.json. Create that file first."
    );
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  const rawGames = JSON.parse(raw) as RawGame[];

  const schedule = convertSchedule(rawGames);

  fs.writeFileSync(outputPath, JSON.stringify(schedule, null, 2));

  console.log(`✅ Converted ${rawGames.length} games`);
  console.log(`✅ Wrote ${outputPath}`);
}

main();