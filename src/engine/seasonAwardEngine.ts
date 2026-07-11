import type { Player } from "../types/player";
import { buildSeasonPlayerScoringSummaries } from "./weeklyScoringEngine";
import {
  getSeasonAwardId,
  type SeasonAwardCandidate,
  type SeasonAwardCategory,
  type SeasonAwardResolutionMethod,
  type SeasonAwardResult,
  type SeasonAwardResults,
  type SeasonAwardWinner,
} from "./seasonAwardTypes";
import {
  getWeeklyScoringRecordId,
  type WeeklyScoringHistory,
} from "./weeklyScoringTypes";

export const SEASON_AWARD_CATEGORIES: readonly SeasonAwardCategory[] = [
  "biggest-winner",
  "biggest-loser",
  "last-to-lose",
];

export const SEASON_AWARD_TITLES: Record<
  SeasonAwardCategory,
  string
> = {
  "biggest-winner": "Biggest Winner",
  "biggest-loser": "Biggest Loser",
  "last-to-lose": "Last to Lose",
};

type BuildSeasonAwardResultsParams = {
  players: Player[];
  scoringHistory: WeeklyScoringHistory;
  season: number;
};

type DeterministicResolution = {
  finalists: SeasonAwardCandidate[];
  resolutionMethod: SeasonAwardResolutionMethod | null;
};

function compareText(
  valueA: string,
  valueB: string,
): number {
  return valueA.localeCompare(valueB, undefined, {
    sensitivity: "base",
  });
}

function getSeasonRecords(
  scoringHistory: WeeklyScoringHistory,
  season: number,
) {
  return Object.values(scoringHistory)
    .filter(
      (record) =>
        record.season === season &&
        record.week >= 1 &&
        record.week <= 18,
    )
    .sort((recordA, recordB) => recordA.week - recordB.week);
}

function getCalculatedThroughWeek(
  scoringHistory: WeeklyScoringHistory,
  season: number,
): number {
  return getSeasonRecords(scoringHistory, season).reduce(
    (latestWeek, record) => Math.max(latestWeek, record.week),
    0,
  );
}

function getFirstLossWeeks(
  scoringHistory: WeeklyScoringHistory,
  season: number,
): Record<string, number> {
  const firstLossWeeks: Record<string, number> = {};

  for (const record of getSeasonRecords(scoringHistory, season)) {
    for (const result of Object.values(record.playerResults)) {
      if (
        result.outcome === "loss" &&
        firstLossWeeks[result.playerId] === undefined
      ) {
        firstLossWeeks[result.playerId] = record.week;
      }
    }
  }

  return firstLossWeeks;
}

function buildCandidates({
  players,
  scoringHistory,
  season,
}: BuildSeasonAwardResultsParams): SeasonAwardCandidate[] {
  const summaries = buildSeasonPlayerScoringSummaries({
    players,
    scoringHistory,
    season,
    throughWeek: 18,
  });

  const firstLossWeeks = getFirstLossWeeks(
    scoringHistory,
    season,
  );

  return Object.values(summaries)
    .filter((summary) => summary.completedHeadToHeadWeeks > 0)
    .map((summary) => ({
      playerId: summary.playerId,
      playerName: summary.playerName,
      nflTeam: summary.nflTeam,
      wins: summary.wins,
      losses: summary.losses,
      ties: summary.ties,
      leaguePoints: summary.leaguePoints,
      seasonCorrectPicks: summary.seasonCorrectPicks,
      completedHeadToHeadWeeks: summary.completedHeadToHeadWeeks,
      firstLossWeek: firstLossWeeks[summary.playerId] ?? null,
      undefeated: summary.losses === 0,
    }));
}

function keepMaximum(
  candidates: SeasonAwardCandidate[],
  getValue: (candidate: SeasonAwardCandidate) => number,
): SeasonAwardCandidate[] {
  const maximum = Math.max(...candidates.map(getValue));
  return candidates.filter(
    (candidate) => getValue(candidate) === maximum,
  );
}

function keepMinimum(
  candidates: SeasonAwardCandidate[],
  getValue: (candidate: SeasonAwardCandidate) => number,
): SeasonAwardCandidate[] {
  const minimum = Math.min(...candidates.map(getValue));
  return candidates.filter(
    (candidate) => getValue(candidate) === minimum,
  );
}

function resolveBiggestWinner(
  candidates: SeasonAwardCandidate[],
): DeterministicResolution {
  let finalists = keepMaximum(
    candidates,
    (candidate) => candidate.wins,
  );

  if (finalists.length === 1) {
    return { finalists, resolutionMethod: "wins" };
  }

  finalists = keepMaximum(
    finalists,
    (candidate) => candidate.leaguePoints,
  );

  if (finalists.length === 1) {
    return { finalists, resolutionMethod: "league-points" };
  }

  finalists = keepMaximum(
    finalists,
    (candidate) => candidate.seasonCorrectPicks,
  );

  return {
    finalists,
    resolutionMethod:
      finalists.length === 1
        ? "season-correct-picks"
        : null,
  };
}

function resolveBiggestLoser(
  candidates: SeasonAwardCandidate[],
): DeterministicResolution {
  let finalists = keepMaximum(
    candidates,
    (candidate) => candidate.losses,
  );

  if (finalists.length === 1) {
    return { finalists, resolutionMethod: "losses" };
  }

  finalists = keepMinimum(
    finalists,
    (candidate) => candidate.leaguePoints,
  );

  if (finalists.length === 1) {
    return { finalists, resolutionMethod: "league-points" };
  }

  finalists = keepMinimum(
    finalists,
    (candidate) => candidate.seasonCorrectPicks,
  );

  return {
    finalists,
    resolutionMethod:
      finalists.length === 1
        ? "season-correct-picks"
        : null,
  };
}

function resolveLastToLose(
  candidates: SeasonAwardCandidate[],
): DeterministicResolution {
  const undefeatedPlayers = candidates.filter(
    (candidate) => candidate.undefeated,
  );

  let finalists: SeasonAwardCandidate[];
  let primaryResolutionMethod: SeasonAwardResolutionMethod;

  if (undefeatedPlayers.length > 0) {
    finalists = undefeatedPlayers;
    primaryResolutionMethod = "undefeated";
  } else {
    finalists = keepMaximum(
      candidates,
      (candidate) => candidate.firstLossWeek ?? 0,
    );
    primaryResolutionMethod = "first-loss-week";
  }

  if (finalists.length === 1) {
    return {
      finalists,
      resolutionMethod: primaryResolutionMethod,
    };
  }

  finalists = keepMaximum(
    finalists,
    (candidate) => candidate.leaguePoints,
  );

  if (finalists.length === 1) {
    return { finalists, resolutionMethod: "league-points" };
  }

  finalists = keepMaximum(
    finalists,
    (candidate) => candidate.seasonCorrectPicks,
  );

  return {
    finalists,
    resolutionMethod:
      finalists.length === 1
        ? "season-correct-picks"
        : null,
  };
}

function resolveCandidates(
  category: SeasonAwardCategory,
  candidates: SeasonAwardCandidate[],
): DeterministicResolution {
  if (category === "biggest-winner") {
    return resolveBiggestWinner(candidates);
  }

  if (category === "biggest-loser") {
    return resolveBiggestLoser(candidates);
  }

  return resolveLastToLose(candidates);
}

function compareCandidates(
  category: SeasonAwardCategory,
  candidateA: SeasonAwardCandidate,
  candidateB: SeasonAwardCandidate,
): number {
  if (category === "biggest-winner") {
    return (
      candidateB.wins - candidateA.wins ||
      candidateB.leaguePoints - candidateA.leaguePoints ||
      candidateB.seasonCorrectPicks - candidateA.seasonCorrectPicks ||
      compareText(candidateA.playerName, candidateB.playerName)
    );
  }

  if (category === "biggest-loser") {
    return (
      candidateB.losses - candidateA.losses ||
      candidateA.leaguePoints - candidateB.leaguePoints ||
      candidateA.seasonCorrectPicks - candidateB.seasonCorrectPicks ||
      compareText(candidateA.playerName, candidateB.playerName)
    );
  }

  if (candidateA.undefeated !== candidateB.undefeated) {
    return candidateA.undefeated ? -1 : 1;
  }

  return (
    (candidateB.firstLossWeek ?? 19) -
      (candidateA.firstLossWeek ?? 19) ||
    candidateB.leaguePoints - candidateA.leaguePoints ||
    candidateB.seasonCorrectPicks - candidateA.seasonCorrectPicks ||
    compareText(candidateA.playerName, candidateB.playerName)
  );
}

function createWinner(
  candidate: SeasonAwardCandidate,
  resolutionMethod: SeasonAwardResolutionMethod,
): SeasonAwardWinner {
  return {
    ...candidate,
    resolutionMethod,
  };
}

function buildUnavailableResult(
  season: number,
  category: SeasonAwardCategory,
  isSeasonFinal: boolean,
  calculatedThroughWeek: number,
): SeasonAwardResult {
  return {
    id: getSeasonAwardId(season, category),
    season,
    category,
    title: SEASON_AWARD_TITLES[category],
    status: "unavailable",
    isSeasonFinal,
    calculatedThroughWeek,
    eligiblePlayerCount: 0,
    candidates: [],
    leadingPlayerIds: [],
    coinFlipPlayerIds: [],
    winner: null,
    pendingReason:
      "No player has completed an eligible head-to-head matchup yet.",
  };
}

function buildAwardResult(
  season: number,
  category: SeasonAwardCategory,
  candidates: SeasonAwardCandidate[],
  isSeasonFinal: boolean,
  calculatedThroughWeek: number,
): SeasonAwardResult {
  if (candidates.length === 0) {
    return buildUnavailableResult(
      season,
      category,
      isSeasonFinal,
      calculatedThroughWeek,
    );
  }

  const sortedCandidates = [...candidates].sort(
    (candidateA, candidateB) =>
      compareCandidates(category, candidateA, candidateB),
  );

  const resolution = resolveCandidates(category, candidates);
  const leadingPlayerIds = resolution.finalists
    .map((candidate) => candidate.playerId)
    .sort();

  if (!isSeasonFinal) {
    return {
      id: getSeasonAwardId(season, category),
      season,
      category,
      title: SEASON_AWARD_TITLES[category],
      status: "provisional",
      isSeasonFinal: false,
      calculatedThroughWeek,
      eligiblePlayerCount: candidates.length,
      candidates: sortedCandidates,
      leadingPlayerIds,
      coinFlipPlayerIds: [],
      winner:
        resolution.finalists.length === 1 &&
        resolution.resolutionMethod
          ? createWinner(
              resolution.finalists[0],
              resolution.resolutionMethod,
            )
          : null,
      pendingReason:
        "Provisional result. Week 18 scoring has not been finalized.",
    };
  }

  if (
    resolution.finalists.length === 1 &&
    resolution.resolutionMethod
  ) {
    return {
      id: getSeasonAwardId(season, category),
      season,
      category,
      title: SEASON_AWARD_TITLES[category],
      status: "resolved",
      isSeasonFinal: true,
      calculatedThroughWeek,
      eligiblePlayerCount: candidates.length,
      candidates: sortedCandidates,
      leadingPlayerIds,
      coinFlipPlayerIds: [],
      winner: createWinner(
        resolution.finalists[0],
        resolution.resolutionMethod,
      ),
      pendingReason: null,
    };
  }

  return {
    id: getSeasonAwardId(season, category),
    season,
    category,
    title: SEASON_AWARD_TITLES[category],
    status: "coin-flip-required",
    isSeasonFinal: true,
    calculatedThroughWeek,
    eligiblePlayerCount: candidates.length,
    candidates: sortedCandidates,
    leadingPlayerIds,
    coinFlipPlayerIds: leadingPlayerIds,
    winner: null,
    pendingReason:
      "Commissioner offline coin flip required after all season-award tiebreakers remained tied.",
  };
}

export function isSeasonAwardSeasonFinal(
  scoringHistory: WeeklyScoringHistory,
  season: number,
): boolean {
  return Boolean(
    scoringHistory[getWeeklyScoringRecordId(season, 18)],
  );
}

export function buildSeasonAwardResults({
  players,
  scoringHistory,
  season,
}: BuildSeasonAwardResultsParams): SeasonAwardResults {
  const candidates = buildCandidates({
    players,
    scoringHistory,
    season,
  });

  const isSeasonFinal = isSeasonAwardSeasonFinal(
    scoringHistory,
    season,
  );

  const calculatedThroughWeek = getCalculatedThroughWeek(
    scoringHistory,
    season,
  );

  return {
    "biggest-winner": buildAwardResult(
      season,
      "biggest-winner",
      candidates,
      isSeasonFinal,
      calculatedThroughWeek,
    ),
    "biggest-loser": buildAwardResult(
      season,
      "biggest-loser",
      candidates,
      isSeasonFinal,
      calculatedThroughWeek,
    ),
    "last-to-lose": buildAwardResult(
      season,
      "last-to-lose",
      candidates,
      isSeasonFinal,
      calculatedThroughWeek,
    ),
  };
}
