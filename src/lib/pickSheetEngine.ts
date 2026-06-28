export type Pick = {
  gameId: string;
  team: string;
};

export type WeeklyPicks = Record<string, Pick[]>; 
// playerId -> picks[]

export type LeaguePicks = Record<string, WeeklyPicks>;
// playerId -> week -> picks

/**
 * 🧠 Create empty pick sheet for a week
 */
export function createEmptyPickSheet(
  playerIds: string[],
  gameIds: string[]
) {
  const sheet: Record<string, Pick[]> = {};

  for (const playerId of playerIds) {
    sheet[playerId] = gameIds.map((gameId) => ({
      gameId,
      team: "",
    }));
  }

  return sheet;
}

/**
 * 🎯 Update a single pick
 */
export function updatePick(
  leaguePicks: LeaguePicks,
  playerId: string,
  week: number,
  gameId: string,
  team: string
) {
  if (!leaguePicks[playerId]) {
    leaguePicks[playerId] = {};
  }

  if (!leaguePicks[playerId][week]) {
    leaguePicks[playerId][week] = [];
  }

  const weekPicks = leaguePicks[playerId][week];

  const existing = weekPicks.find((p) => p.gameId === gameId);

  if (existing) {
    existing.team = team;
  } else {
    weekPicks.push({ gameId, team });
  }

  return leaguePicks;
}

/**
 * 🧮 Convert picks into lookup map for scoring engine
 */
export function picksToMap(picks: Pick[]) {
  const map: Record<string, string> = {};

  for (const pick of picks) {
    map[pick.gameId] = pick.team;
  }

  return map;
}