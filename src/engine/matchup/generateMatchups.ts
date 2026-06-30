import type { LeaguePlayer } from "../../types/leagueModel";
import type { NFLScheduleGame } from "../../types/nfl";
import type { PlayerBye } from "../types";
import type { WeeklyMatchup } from "../../types/weekState";

function buildPlayerByTeam(players: LeaguePlayer[]) {
  const map = new Map<string, LeaguePlayer>();

  for (const player of players) {
    map.set(player.nflTeam, player);
  }

  return map;
}

function isByePlayer(playerId: string, byePlayers: PlayerBye[]) {
  return byePlayers.some((bye) => bye.playerId === playerId);
}

export function generateMatchups(
  week: number,
  nflGames: NFLScheduleGame[],
  players: LeaguePlayer[],
  byePlayers: PlayerBye[]
): WeeklyMatchup[] {
  const playerByTeam = buildPlayerByTeam(players);
  const matchups: WeeklyMatchup[] = [];

  for (const game of nflGames) {
    const homePlayer = playerByTeam.get(game.homeTeam);
    const awayPlayer = playerByTeam.get(game.awayTeam);

    if (!homePlayer || !awayPlayer) {
      continue;
    }

    if (
      isByePlayer(homePlayer.id, byePlayers) ||
      isByePlayer(awayPlayer.id, byePlayers)
    ) {
      continue;
    }

    matchups.push({
      week,
      homePlayerId: homePlayer.id,
      awayPlayerId: awayPlayer.id,

      homeFranchise: homePlayer.nflTeam,
      awayFranchise: awayPlayer.nflTeam,

      homeCorrectPicks: 0,
      awayCorrectPicks: 0,

      winnerId: undefined,

      leaguePointsAwarded: false,
      completed: false,
      isByeWeek: false,
    });
  }

  return matchups;
}