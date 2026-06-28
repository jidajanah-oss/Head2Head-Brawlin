export type Game = {
  id: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;

  status: "upcoming" | "live" | "final";

  // 🏈 NEW — real scoring
  homeScore?: number;
  awayScore?: number;
};