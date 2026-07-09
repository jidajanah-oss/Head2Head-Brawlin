import type { Player } from "../../types/player";
import type { NFLGame, NFLTeamRef } from "../nfl/NFLTypes";
import { getNFLTeamDisplayName } from "../nflTeamOwnership";

export type ResolvedHeadToHeadMatchupSource = "nfl-schedule" | "rotation";

export type ResolvedHeadToHeadMatchupType =
  | "owned-opponent"
  | "open-opponent"
  | "bye";

export type ResolvedHeadToHeadMatchup = {
  id: string;
  week: number;
  playerA: Player;
  playerB: Player | null;
  source: ResolvedHeadToHeadMatchupSource;
  matchupType: ResolvedHeadToHeadMatchupType;
  sourceGameId?: string;
  kickoff?: string;
  playerATeamAbbreviation: string;
  playerATeamDisplayName: string;
  playerBTeamAbbreviation?: string;
  playerBTeamDisplayName?: string;
  openOpponentTeamAbbreviation?: string;
  openOpponentTeamDisplayName?: string;
};

function normalizeTeam(team: string) {
  return team.trim().toUpperCase();
}

function getPlayerTeamDisplayName(player: Player) {
  return getNFLTeamDisplayName(player.nflTeam);
}

function getNFLTeamRefDisplayName(team: NFLTeamRef) {
  return team.displayName || getNFLTeamDisplayName(team.abbreviation);
}

function getActivePlayers(players: Player[]) {
  return players.filter((player) => player.status === "active");
}

function buildTeamOwnerMap(players: Player[]) {
  return getActivePlayers(players).reduce<Record<string, Player>>(
    (owners, player) => {
      const team = normalizeTeam(player.nflTeam);

      if (team) {
        owners[team] = player;
      }

      return owners;
    },
    {}
  );
}

function buildOwnedOpponentMatchup(params: {
  game: NFLGame;
  week: number;
  awayOwner: Player;
  homeOwner: Player;
}): ResolvedHeadToHeadMatchup {
  return {
    id: `week-${params.week}-nfl-${params.game.id}`,
    week: params.week,
    playerA: params.awayOwner,
    playerB: params.homeOwner,
    source: "nfl-schedule",
    matchupType: "owned-opponent",
    sourceGameId: params.game.id,
    kickoff: params.game.kickoff,
    playerATeamAbbreviation: params.game.awayTeam.abbreviation,
    playerATeamDisplayName: getNFLTeamRefDisplayName(params.game.awayTeam),
    playerBTeamAbbreviation: params.game.homeTeam.abbreviation,
    playerBTeamDisplayName: getNFLTeamRefDisplayName(params.game.homeTeam),
  };
}

function buildOpenOpponentMatchup(params: {
  game: NFLGame;
  week: number;
  owner: Player;
  ownerTeam: NFLTeamRef;
  openOpponentTeam: NFLTeamRef;
}): ResolvedHeadToHeadMatchup {
  return {
    id: `week-${params.week}-nfl-${params.game.id}-${params.owner.id}-open`,
    week: params.week,
    playerA: params.owner,
    playerB: null,
    source: "nfl-schedule",
    matchupType: "open-opponent",
    sourceGameId: params.game.id,
    kickoff: params.game.kickoff,
    playerATeamAbbreviation: params.ownerTeam.abbreviation,
    playerATeamDisplayName: getNFLTeamRefDisplayName(params.ownerTeam),
    openOpponentTeamAbbreviation: params.openOpponentTeam.abbreviation,
    openOpponentTeamDisplayName: getNFLTeamRefDisplayName(
      params.openOpponentTeam
    ),
  };
}

function buildByeMatchup(params: {
  player: Player;
  week: number;
}): ResolvedHeadToHeadMatchup {
  return {
    id: `week-${params.week}-bye-${params.player.id}`,
    week: params.week,
    playerA: params.player,
    playerB: null,
    source: "nfl-schedule",
    matchupType: "bye",
    playerATeamAbbreviation: normalizeTeam(params.player.nflTeam),
    playerATeamDisplayName: getPlayerTeamDisplayName(params.player),
  };
}

export function resolveNFLScheduleHeadToHeadMatchups(params: {
  players: Player[];
  nflGames: NFLGame[];
  week: number;
}): ResolvedHeadToHeadMatchup[] {
  const activePlayers = getActivePlayers(params.players);
  const ownersByTeam = buildTeamOwnerMap(activePlayers);
  const matchups: ResolvedHeadToHeadMatchup[] = [];
  const scheduledTeams = new Set<string>();
  const matchedPlayerIds = new Set<string>();

  const weekGames = params.nflGames.filter((game) => game.week === params.week);

  for (const game of weekGames) {
    const awayTeam = normalizeTeam(game.awayTeam.abbreviation);
    const homeTeam = normalizeTeam(game.homeTeam.abbreviation);

    scheduledTeams.add(awayTeam);
    scheduledTeams.add(homeTeam);

    const awayOwner = ownersByTeam[awayTeam];
    const homeOwner = ownersByTeam[homeTeam];

    if (awayOwner && homeOwner) {
      matchups.push(
        buildOwnedOpponentMatchup({
          game,
          week: params.week,
          awayOwner,
          homeOwner,
        })
      );

      matchedPlayerIds.add(awayOwner.id);
      matchedPlayerIds.add(homeOwner.id);
      continue;
    }

    if (awayOwner && !homeOwner) {
      matchups.push(
        buildOpenOpponentMatchup({
          game,
          week: params.week,
          owner: awayOwner,
          ownerTeam: game.awayTeam,
          openOpponentTeam: game.homeTeam,
        })
      );

      matchedPlayerIds.add(awayOwner.id);
      continue;
    }

    if (!awayOwner && homeOwner) {
      matchups.push(
        buildOpenOpponentMatchup({
          game,
          week: params.week,
          owner: homeOwner,
          ownerTeam: game.homeTeam,
          openOpponentTeam: game.awayTeam,
        })
      );

      matchedPlayerIds.add(homeOwner.id);
    }
  }

  for (const player of activePlayers) {
    const playerTeam = normalizeTeam(player.nflTeam);

    if (!matchedPlayerIds.has(player.id) && !scheduledTeams.has(playerTeam)) {
      matchups.push(
        buildByeMatchup({
          player,
          week: params.week,
        })
      );
    }
  }

  return matchups;
}