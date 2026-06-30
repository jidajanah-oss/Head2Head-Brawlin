import { LiveGameStatusEngine } from "../../engine";
import type { WeekGame } from "../../engine";

export function getGameCenterStatus(game: WeekGame) {
  return LiveGameStatusEngine.getStatus({
    kickoffTime: game.kickoff,
    isFinal: game.final ?? false,
  });
}

export function getStatusLabel(game: WeekGame): string {
  const status = getGameCenterStatus(game);

  if (status === "final") return "FINAL";
  if (status === "in_progress") return "LIVE";
  if (status === "locked") return "LOCKED";
  if (status === "open") return "OPEN";

  return "UPCOMING";
}

export function getStatusEmoji(game: WeekGame): string {
  const status = getGameCenterStatus(game);

  if (status === "final") return "✅";
  if (status === "in_progress") return "🔴";
  if (status === "locked") return "🔒";
  if (status === "open") return "🟢";

  return "⏳";
}

export function formatKickoff(kickoff: string): string {
  return new Date(kickoff).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}