import type { Game } from "../types/game";

/**
 * 🏈 NFL SEASON SCHEDULE (SCAFFOLD)
 * This will later be replaced with real NFL API data
 */

export const nflSchedule: Record<number, Game[]> = {
  1: [
    {
      id: "1-1",
      week: 1,
      homeTeam: "BUF",
      awayTeam: "MIA",
      kickoffTime: "2026-09-05T18:00:00Z",
      status: "upcoming",
    },
    {
      id: "1-2",
      week: 1,
      homeTeam: "KC",
      awayTeam: "BAL",
      kickoffTime: "2026-09-05T21:25:00Z",
      status: "upcoming",
    },
    {
      id: "1-3",
      week: 1,
      homeTeam: "DAL",
      awayTeam: "PHI",
      kickoffTime: "2026-09-07T01:20:00Z",
      status: "upcoming",
    },
  ],

  2: [
    {
      id: "2-1",
      week: 2,
      homeTeam: "NYJ",
      awayTeam: "NE",
      kickoffTime: "2026-09-12T18:00:00Z",
      status: "upcoming",
    },
  ],
};

/**
 * 📅 Get games for a week
 */
export function getWeekGames(week: number): Game[] {
  return nflSchedule[week] || [];
}

/**
 * 🏈 Get all weeks available
 */
export function getAvailableWeeks(): number[] {
  return Object.keys(nflSchedule).map(Number);
}