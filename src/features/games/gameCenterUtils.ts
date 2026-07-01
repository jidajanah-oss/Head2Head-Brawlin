type GameLike = {
  status?: string;
  kickoff?: string | Date;
  kickoffTime?: string | Date;
  completed?: boolean;
  winner?: string | null;
};

function getKickoffValue(gameKickoff: GameLike["kickoff"], gameKickoffTime: GameLike["kickoffTime"]) {
  return gameKickoff ?? gameKickoffTime;
}

export function formatKickoff(kickoff: string | Date | undefined) {
  if (!kickoff) {
    return "Kickoff TBD";
  }

  const date = kickoff instanceof Date ? kickoff : new Date(kickoff);

  if (Number.isNaN(date.getTime())) {
    return "Kickoff TBD";
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getStatusLabel(game: GameLike) {
  const status = String(game.status ?? "").toLowerCase();

  if (game.completed || game.winner || status.includes("final") || status.includes("complete")) {
    return "FINAL";
  }

  if (status.includes("live") || status.includes("in_progress") || status.includes("in-progress")) {
    return "LIVE";
  }

  if (status.includes("locked")) {
    return "LOCKED";
  }

  const kickoff = getKickoffValue(game.kickoff, game.kickoffTime);

  if (kickoff) {
    const kickoffDate = kickoff instanceof Date ? kickoff : new Date(kickoff);

    if (!Number.isNaN(kickoffDate.getTime()) && new Date() >= kickoffDate) {
      return "LOCKED";
    }
  }

  return "OPEN";
}

export function getStatusEmoji(game: GameLike) {
  const label = getStatusLabel(game);

  if (label === "LIVE") return "🟢";
  if (label === "FINAL") return "🏁";
  if (label === "LOCKED") return "🔒";

  return "🟡";
}