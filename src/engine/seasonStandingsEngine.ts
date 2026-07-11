import type { Player } from "../types/player";
import {
  buildNFLStyleDivisionStandings,
  compareHeadToHeadStandingRows,
  type HeadToHeadGameResults,
  type HeadToHeadPicks,
  type HeadToHeadStandingRow,
  type NFLStyleConferenceStandingGroup,
  type NFLStyleDivisionStandingGroup,
  type NFLStyleDivisionStandingRow,
  type NFLStyleDivisionStandings,
} from "./h2hEngine";
import type { NFLGame } from "./nfl/NFLTypes";
import {
  NFL_CONFERENCE_ORDER,
  NFL_DIVISION_ORDER,
} from "./nflTeamOwnership";
import {
  buildSeasonPlayerScoringSummaries,
  inspectNFLWeekCompletion,
} from "./weeklyScoringEngine";
import type {
  SeasonPlayerScoringSummary,
  WeeklyScoringHistory,
} from "./weeklyScoringTypes";

const WILDCARD_SEED_COUNT = 3;

type BuildSeasonAwareStandingsParams = {
  players: Player[];
  picks: HeadToHeadPicks;
  gameResults: HeadToHeadGameResults;
  scoringHistory: WeeklyScoringHistory;
  nflGames: NFLGame[];
  season: number;
  week: number;
};

function applySeasonSummaryToStandingRow<
  TRow extends HeadToHeadStandingRow,
>(
  row: TRow,
  summary: SeasonPlayerScoringSummary | undefined,
  holdWeeklyResultPending: boolean
): TRow {
  const weeklyResult =
    holdWeeklyResultPending &&
    (row.weeklyResult === "win" ||
      row.weeklyResult === "loss" ||
      row.weeklyResult === "tie")
      ? "pending"
      : row.weeklyResult;

  if (!summary) {
    return {
      ...row,
      wins: 0,
      losses: 0,
      ties: 0,
      leaguePoints: 0,
      pickPoints: 0,
      possiblePoints: 0,
      missingScoredPicks: 0,
      weeklyResult,
    };
  }

  return {
    ...row,
    wins: summary.wins,
    losses: summary.losses,
    ties: summary.ties,
    leaguePoints: summary.leaguePoints,
    pickPoints: summary.seasonCorrectPicks,
    possiblePoints: summary.seasonPossiblePicks,
    missingScoredPicks: summary.seasonMissingPicks,
    weeklyResult,
  };
}

function resetNFLStandingMetadata(
  row: NFLStyleDivisionStandingRow
): NFLStyleDivisionStandingRow {
  return {
    ...row,
    rank: 0,
    conferenceRank: 0,
    divisionRank: 0,
    divisionPointsBack: 0,
    isDivisionLeader: false,
    isWildcardSeed: false,
  };
}

export function buildSeasonAwareNFLStyleDivisionStandings({
  players,
  picks,
  gameResults,
  scoringHistory,
  nflGames,
  season,
  week,
}: BuildSeasonAwareStandingsParams): NFLStyleDivisionStandings {
  const completion = inspectNFLWeekCompletion(
    nflGames,
    season,
    week
  );

  const hasCurrentNFLSchedule =
    completion.totalScheduledGames > 0;

  const currentWeekResults = hasCurrentNFLSchedule
    ? completion.gameResults
    : gameResults;

  const baseStandings = buildNFLStyleDivisionStandings(
    players,
    picks,
    currentWeekResults,
    week,
    nflGames
  );

  const seasonSummaries =
    buildSeasonPlayerScoringSummaries({
      players,
      scoringHistory,
      season,
      throughWeek: week,
    });

  const holdWeeklyResultPending =
    hasCurrentNFLSchedule && !completion.isComplete;

  const updatedAssignedRows =
    baseStandings.allRows.map((row) =>
      resetNFLStandingMetadata(
        applySeasonSummaryToStandingRow(
          row,
          seasonSummaries[row.id],
          holdWeeklyResultPending
        )
      )
    );

  const rowsById = new Map(
    updatedAssignedRows.map((row) => [row.id, row])
  );

  const allRows = [...updatedAssignedRows].sort(
    compareHeadToHeadStandingRows
  );

  allRows.forEach((row, index) => {
    row.rank = index + 1;
  });

  const divisions: NFLStyleDivisionStandingGroup[] =
    NFL_DIVISION_ORDER.map((division) => {
      const baseDivision =
        baseStandings.divisions.find(
          (group) => group.division === division
        );

      const rows = (
        baseDivision?.rows
          .map((row) => rowsById.get(row.id))
          .filter(
            (
              row
            ): row is NFLStyleDivisionStandingRow =>
              Boolean(row)
          ) ?? []
      ).sort(compareHeadToHeadStandingRows);

      const leaderLeaguePoints =
        rows[0]?.leaguePoints ?? 0;

      rows.forEach((row, index) => {
        row.divisionRank = index + 1;
        row.divisionPointsBack = Math.max(
          leaderLeaguePoints - row.leaguePoints,
          0
        );
        row.isDivisionLeader = index === 0;
      });

      return {
        conference: division.startsWith("AFC")
          ? "AFC"
          : "NFC",
        division,
        teams: baseDivision?.teams ?? [],
        rows,
        leader: rows[0] ?? null,
        claimedCount: rows.length,
        openCount: Math.max(
          (baseDivision?.teams.length ?? 0) -
            rows.length,
          0
        ),
      };
    });

  const conferences: NFLStyleConferenceStandingGroup[] =
    NFL_CONFERENCE_ORDER.map((conference) => {
      const conferenceDivisions = divisions.filter(
        (division) =>
          division.conference === conference
      );

      const rows = allRows
        .filter(
          (row) => row.conference === conference
        )
        .sort(compareHeadToHeadStandingRows);

      rows.forEach((row, index) => {
        row.conferenceRank = index + 1;
        row.isWildcardSeed = false;
      });

      const divisionLeaders = conferenceDivisions
        .map((division) => division.leader)
        .filter(
          (
            row
          ): row is NFLStyleDivisionStandingRow =>
            Boolean(row)
        )
        .sort(compareHeadToHeadStandingRows);

      const wildcardRows = rows
        .filter((row) => !row.isDivisionLeader)
        .sort(compareHeadToHeadStandingRows);

      wildcardRows.forEach((row, index) => {
        row.isWildcardSeed =
          index < WILDCARD_SEED_COUNT;
      });

      return {
        conference,
        divisions: conferenceDivisions,
        rows,
        divisionLeaders,
        wildcardRows,
      };
    });

  const unassignedRows = baseStandings.unassignedRows
    .map((row) =>
      applySeasonSummaryToStandingRow(
        row,
        seasonSummaries[row.id],
        holdWeeklyResultPending
      )
    )
    .sort(compareHeadToHeadStandingRows)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    allRows,
    unassignedRows,
    divisions,
    conferences,
    claimedTeamCount: allRows.length,
    openTeamCount: Math.max(
      baseStandings.totalTeamCount - allRows.length,
      0
    ),
    totalTeamCount: baseStandings.totalTeamCount,
    occupiedDivisionCount: divisions.filter(
      (division) => division.claimedCount > 0
    ).length,
  };
}