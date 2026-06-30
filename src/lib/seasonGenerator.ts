import type {
  LeaguePlayer,
  LeagueState,
  PlayerSeason,
} from "../types/leagueModel";

import type { LeagueSetupState } from "../features/setup/setupTypes";

import { nflFranchises } from "./nflFranchises";
import { loadSchedule } from "../data/nfl";
import { generateWeekStates } from "../engine/matchup/generateWeekStates";

export function generateSeasonFromSetup(
  setup: LeagueSetupState
): LeagueState {
  const players: LeaguePlayer[] = setup.players.map((player) => {
    const franchise = nflFranchises.find(
      (team) => team.id === player.franchiseId
    );

    if (!franchise) {
      throw new Error(`Missing franchise for ${player.name}`);
    }

    return {
      id: player.id,
      name: player.name,
      nflTeam: franchise.id,
      conference: franchise.conference,
      division: franchise.division,

      wins: 0,
      losses: 0,
      ties: 0,
      leaguePoints: 0,
      correctPicks: 0,
      headToHeadWins: 0,
      byeWeek: 0,
    };
  });

  const playerSeasons: PlayerSeason[] = players.map((player) => ({
    playerId: player.id,
    season: setup.season,

    nflTeam: player.nflTeam,
    conference: player.conference,
    division: player.division,

    wins: 0,
    losses: 0,
    ties: 0,

    leaguePoints: 0,

    correctPicks: 0,
    weeklyCorrectPicks: 0,
    seasonEligibleCorrectPicks: 0,

    headToHeadWins: 0,

    byeWeek: 0,
  }));

  const scheduleWeeks = loadSchedule(setup.season);

  const weekStates = generateWeekStates({
    season: setup.season,
    players,
    schedule: scheduleWeeks,
  });

  return {
    settings: {
      leagueName: setup.leagueName,
      season: setup.season,
      currentWeek: 1,
      commissioner: setup.commissioner,
      picksLockMinutesBeforeKickoff: 5,
    },

    players,
    playerSeasons,

    schedule: scheduleWeeks.flatMap((week) =>
      week.games.map((game) => ({
        id: game.id,
        week: game.week,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        kickoff: game.kickoff,
        completed: game.completed,
        winner: game.winner,
      }))
    ),

    weeklyMatchups: weekStates.flatMap((week) =>
      week.playerMatchups.map((matchup) => ({
        week: matchup.week,
        homePlayerId: matchup.homePlayerId,
        awayPlayerId: matchup.awayPlayerId ?? "",
        homeCorrect: matchup.homeCorrectPicks,
        awayCorrect: matchup.awayCorrectPicks,
        winnerId: matchup.winnerId,
        tie: false,
        played: matchup.completed,
      }))
    ),

    pickSheets: weekStates.flatMap((week) =>
      week.pickSheets.map((sheet) => ({
        playerId: sheet.playerId,
        week: sheet.week,
        picks: sheet.picks.map((pick) => ({
          gameId: pick.gameId,
          selectedTeam: pick.selectedTeam,
        })),
        submitted: sheet.submitted,
        submittedAt: sheet.submittedAt,
      }))
    ),

    afcSeeds: [],
    nfcSeeds: [],
  };
}