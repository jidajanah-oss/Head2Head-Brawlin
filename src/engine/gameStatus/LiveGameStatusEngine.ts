export type LiveGameStatus =
  | "upcoming"
  | "open"
  | "locked"
  | "in_progress"
  | "final";

export interface LiveGameStatusInput {
  kickoffTime?: string | Date | null;
  isFinal?: boolean;
  now?: Date;
}

export class LiveGameStatusEngine {
  static getStatus(input: LiveGameStatusInput): LiveGameStatus {
    const now = input.now ?? new Date();

    if (input.isFinal) {
      return "final";
    }

    if (!input.kickoffTime) {
      return "upcoming";
    }

    const kickoff =
      input.kickoffTime instanceof Date
        ? input.kickoffTime
        : new Date(input.kickoffTime);

    if (Number.isNaN(kickoff.getTime())) {
      return "upcoming";
    }

    const lockTime = new Date(kickoff.getTime() - 5 * 60 * 1000);

    if (now >= kickoff) {
      return "in_progress";
    }

    if (now >= lockTime) {
      return "locked";
    }

    return "open";
  }

  static isLocked(input: LiveGameStatusInput): boolean {
    const status = this.getStatus(input);

    return status === "locked" || status === "in_progress" || status === "final";
  }

  static isPlayable(input: LiveGameStatusInput): boolean {
    return this.getStatus(input) === "open";
  }
}