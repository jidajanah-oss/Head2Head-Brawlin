import type { NFLScheduleWeek } from "../../types/nfl";
import schedule2026 from "./schedule/2026.json";

const schedules: Record<number, NFLScheduleWeek[]> = {
  2026: schedule2026 as NFLScheduleWeek[],
};

export function loadSchedule(season: number): NFLScheduleWeek[] {
  const schedule = schedules[season];

  if (!schedule) {
    throw new Error(`No NFL schedule found for season ${season}.`);
  }

  return schedule;
}

export function getScheduleWeek(season: number, week: number) {
  return loadSchedule(season).find((item) => item.week === week);
}