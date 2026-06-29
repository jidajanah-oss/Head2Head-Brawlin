import { LiveGameStatusEngine } from "../gameStatus/LiveGameStatusEngine";

export interface PickLockGame {
  id: string;
  kickoff: string;
  final?: boolean;
}

export class PickLockEngine {
  static isPickLocked(game: PickLockGame): boolean {
    return LiveGameStatusEngine.isLocked({
      kickoffTime: game.kickoff,
      isFinal: game.final ?? false,
    });
  }

  static getLockedGameIds(games: PickLockGame[]): string[] {
    return games
      .filter(game => this.isPickLocked(game))
      .map(game => game.id);
  }

  static getOpenGameIds(games: PickLockGame[]): string[] {
    return games
      .filter(game => !this.isPickLocked(game))
      .map(game => game.id);
  }

  static canEditPick(game: PickLockGame): boolean {
    return !this.isPickLocked(game);
  }
}