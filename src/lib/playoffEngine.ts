import type { Conference } from "./nflStructure";
import { nflDivisions } from "./nflStructure";
import { getDivisionFromTeam, getConferenceFromTeam } from "./divisionEngine";

type Player = {
  id: string;
  name: string;
  nflTeam: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  correctPicks?: number;
};

type PlayoffSeed = {
  seed: number;
  player: Player;
  divisionWinner?: boolean;
  wildCard?: boolean;
};

function stat(value: number | undefined) {
  return value ?? 0;
}

function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => {
    if (stat(b.leaguePoints) !== stat(a.leaguePoints)) {
      return stat(b.leaguePoints) - stat(a.leaguePoints);
    }

    if (stat(b.correctPicks) !== stat(a.correctPicks)) {
      return stat(b.correctPicks) - stat(a.correctPicks);
    }

    return stat(b.wins) - stat(a.wins);
  });
}

function getDivisionWinners(players: Player[]) {
  const winners: Player[] = [];

  for (const division of Object.keys(nflDivisions) as Array<keyof typeof nflDivisions>) {
    const divisionPlayers = players.filter(
      (player) => getDivisionFromTeam(player.nflTeam) === division
    );

    const sorted = sortPlayers(divisionPlayers);

    if (sorted.length > 0) {
      winners.push(sorted[0]);
    }
  }

  return winners;
}

function getWildcards(players: Player[], divisionWinners: Player[]) {
  const divisionWinnerIds = new Set(divisionWinners.map((player) => player.id));

  return sortPlayers(
    players.filter((player) => !divisionWinnerIds.has(player.id))
  ).slice(0, 3);
}

export function buildPlayoffBracket(players: Player[], conference: Conference) {
  const conferencePlayers = players.filter(
    (player) => getConferenceFromTeam(player.nflTeam) === conference
  );

  const divisionWinners = getDivisionWinners(conferencePlayers);
  const wildcards = getWildcards(conferencePlayers, divisionWinners);

  const seeds: PlayoffSeed[] = [];

  sortPlayers(divisionWinners).forEach((player, index) => {
    seeds.push({
      seed: index + 1,
      player,
      divisionWinner: true,
    });
  });

  wildcards.forEach((player, index) => {
    seeds.push({
      seed: index + 5,
      player,
      wildCard: true,
    });
  });

  return {
    conference,
    seeds,
  };
}

export function isPlayoffViewVisible(currentWeek: number) {
  return currentWeek >= 14;
}