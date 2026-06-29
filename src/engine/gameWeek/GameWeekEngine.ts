export type GameWeekStatus = "not_started" | "active" | "complete";

export interface GameWeekSummary {
  weekNumber: number;
  status: GameWeekStatus;
  totalGames: number;
  lockedGames: number;
  openGames: number;
  completedGames: number;
}

export class GameWeekEngine {
  static buildSummary(params: {
    weekNumber: number;
    totalGames: number;
    lockedGames?: number;
    completedGames?: number;
  }): GameWeekSummary {
    const lockedGames = params.lockedGames ?? 0;
    const completedGames = params.completedGames ?? 0;
    const openGames = Math.max(params.totalGames - lockedGames, 0);

    let status: GameWeekStatus = "not_started";

    if (completedGames >= params.totalGames && params.totalGames > 0) {
      status = "complete";
    } else if (lockedGames > 0 || completedGames > 0) {
      status = "active";
    }

    return {
      weekNumber: params.weekNumber,
      status,
      totalGames: params.totalGames,
      lockedGames,
      openGames,
      completedGames,
    };
  }
}