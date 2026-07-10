import type {
  NFLConferencePlayoffPicture,
  NFLPlayoffPicture,
  NFLPlayoffSeedRow,
} from "./h2hEngine";
import {
  NFL_CONFERENCE_ORDER,
  type NFLConference,
} from "./nflTeamOwnership";
import type {
  PlayoffConference,
  PlayoffMatchupRecord,
  PlayoffMatchupSide,
  PlayoffParticipantSnapshot,
  PlayoffRound,
  PlayoffSeasonState,
  RecordPlayoffMatchupResultInput,
} from "./playoffResultsTypes";

const PLAYOFF_SEED_COUNT = 7;

function getTimestamp(timestamp?: string): string {
  return timestamp?.trim() || new Date().toISOString();
}

function assertPositiveSeason(season: number): void {
  if (!Number.isInteger(season) || season <= 0) {
    throw new Error(
      "Playoff season must be a positive integer.",
    );
  }
}

function assertValidScore(score: number): void {
  if (!Number.isInteger(score) || score < 0) {
    throw new Error(
      "Playoff matchup scores must be non-negative whole numbers.",
    );
  }
}

function getConferencePicture(
  playoffPicture: NFLPlayoffPicture,
  conference: NFLConference,
): NFLConferencePlayoffPicture | null {
  return (
    playoffPicture.conferences.find(
      (picture) =>
        picture.conference === conference,
    ) ?? null
  );
}

function buildParticipantSnapshot(
  seed: NFLPlayoffSeedRow,
): PlayoffParticipantSnapshot {
  return {
    playerId: seed.row.id,
    playerName: seed.row.name,
    nflTeam: seed.row.nflTeam,
    conference: seed.row.conference,
    seed: seed.seed,
    regularSeasonLeaguePoints:
      seed.row.leaguePoints,
    regularSeasonWins: seed.row.wins,
    regularSeasonLosses: seed.row.losses,
    regularSeasonTies: seed.row.ties,
    regularSeasonCorrectPicks:
      seed.row.pickPoints,
  };
}

function buildConferenceSeeds(
  playoffPicture: NFLPlayoffPicture,
  conference: NFLConference,
): PlayoffParticipantSnapshot[] {
  const conferencePicture =
    getConferencePicture(
      playoffPicture,
      conference,
    );

  if (!conferencePicture) {
    return [];
  }

  return conferencePicture.seeds
    .filter(
      (seed) =>
        seed.seed >= 1 &&
        seed.seed <= PLAYOFF_SEED_COUNT,
    )
    .sort(
      (seedA, seedB) =>
        seedA.seed - seedB.seed,
    )
    .map(buildParticipantSnapshot);
}

function buildMatchupSide(
  participant:
    | PlayoffParticipantSnapshot
    | null,
): PlayoffMatchupSide {
  return {
    participant,
    score: null,
  };
}

function buildMatchupRecord({
  season,
  round,
  conference,
  position,
  title,
  matchupLabel,
  teamA,
  teamB,
  note,
  timestamp,
}: {
  season: number;
  round: PlayoffRound;
  conference: PlayoffConference;
  position: number;
  title: string;
  matchupLabel: string;
  teamA:
    | PlayoffParticipantSnapshot
    | null;
  teamB:
    | PlayoffParticipantSnapshot
    | null;
  note: string;
  timestamp: string;
}): PlayoffMatchupRecord {
  return {
    id: getPlayoffMatchupId(
      season,
      conference,
      round,
      position,
    ),
    season,
    round,
    conference,
    position,
    title,
    matchupLabel,
    teamA: buildMatchupSide(teamA),
    teamB: buildMatchupSide(teamB),
    status:
      teamA && teamB ? "ready" : "waiting",
    winnerId: null,
    loserId: null,
    isTie: false,
    resultSource: null,
    finalizedAt: null,
    updatedAt: timestamp,
    note,
  };
}

function getSeed(
  seeds: PlayoffParticipantSnapshot[],
  seedNumber: number,
): PlayoffParticipantSnapshot | null {
  return (
    seeds.find(
      (participant) =>
        participant.seed === seedNumber,
    ) ?? null
  );
}

function getWinner(
  matchup: PlayoffMatchupRecord | undefined,
): PlayoffParticipantSnapshot | null {
  if (
    !matchup ||
    matchup.status !== "final" ||
    !matchup.winnerId
  ) {
    return null;
  }

  if (
    matchup.teamA.participant?.playerId ===
    matchup.winnerId
  ) {
    return matchup.teamA.participant;
  }

  if (
    matchup.teamB.participant?.playerId ===
    matchup.winnerId
  ) {
    return matchup.teamB.participant;
  }

  return null;
}

function getExistingMatchup(
  state: PlayoffSeasonState | null,
  matchupId: string,
): PlayoffMatchupRecord | undefined {
  return state?.matchups[matchupId];
}

function participantsMatch(
  existing: PlayoffMatchupRecord,
  next: PlayoffMatchupRecord,
): boolean {
  return (
    existing.teamA.participant?.playerId ===
      next.teamA.participant?.playerId &&
    existing.teamB.participant?.playerId ===
      next.teamB.participant?.playerId
  );
}

function preserveMatchupResult(
  next: PlayoffMatchupRecord,
  existing: PlayoffMatchupRecord | undefined,
): PlayoffMatchupRecord {
  if (!existing || !participantsMatch(existing, next)) {
    return next;
  }

  return {
    ...next,
    teamA: {
      ...next.teamA,
      score: existing.teamA.score,
    },
    teamB: {
      ...next.teamB,
      score: existing.teamB.score,
    },
    status: existing.status,
    winnerId: existing.winnerId,
    loserId: existing.loserId,
    isTie: existing.isTie,
    resultSource: existing.resultSource,
    finalizedAt: existing.finalizedAt,
    updatedAt: existing.updatedAt,
    note: existing.note,
  };
}

function buildWildcardMatchups(
  season: number,
  conference: NFLConference,
  seeds: PlayoffParticipantSnapshot[],
  timestamp: string,
  previousState: PlayoffSeasonState | null,
): PlayoffMatchupRecord[] {
  const pairs = [
    [2, 7],
    [3, 6],
    [4, 5],
  ] as const;

  return pairs.map(
    ([homeSeed, awaySeed], index) => {
      const matchup = buildMatchupRecord({
        season,
        round: "wildcard",
        conference,
        position: index + 1,
        title: `${conference} Wildcard`,
        matchupLabel:
          `#${homeSeed} vs #${awaySeed}`,
        teamA: getSeed(seeds, homeSeed),
        teamB: getSeed(seeds, awaySeed),
        note:
          "Winner advances to the divisional round.",
        timestamp,
      });

      return preserveMatchupResult(
        matchup,
        getExistingMatchup(
          previousState,
          matchup.id,
        ),
      );
    },
  );
}

function buildDivisionalMatchups(
  season: number,
  conference: NFLConference,
  seeds: PlayoffParticipantSnapshot[],
  wildcardMatchups: PlayoffMatchupRecord[],
  timestamp: string,
  previousState: PlayoffSeasonState | null,
): PlayoffMatchupRecord[] {
  const wildcardWinners = wildcardMatchups
    .map(getWinner)
    .filter(
      (
        participant,
      ): participant is PlayoffParticipantSnapshot =>
        participant !== null,
    )
    .sort(
      (participantA, participantB) =>
        participantA.seed - participantB.seed,
    );

  const wildcardRoundComplete =
    wildcardMatchups.length === 3 &&
    wildcardMatchups.every(
      (matchup) => matchup.status === "final",
    );
  const firstSeed = getSeed(seeds, 1);
  const lowestRemainingSeed =
    wildcardRoundComplete
      ? wildcardWinners[
          wildcardWinners.length - 1
        ] ?? null
      : null;
  const otherWinners = wildcardRoundComplete
    ? wildcardWinners.filter(
        (participant) =>
          participant.playerId !==
          lowestRemainingSeed?.playerId,
      )
    : [];

  const matchupDefinitions = [
    {
      position: 1,
      matchupLabel:
        "#1 Seed vs Lowest Remaining Seed",
      teamA: firstSeed,
      teamB: lowestRemainingSeed,
    },
    {
      position: 2,
      matchupLabel:
        "Remaining Wildcard Winners",
      teamA: otherWinners[0] ?? null,
      teamB: otherWinners[1] ?? null,
    },
  ];

  return matchupDefinitions.map(
    (definition) => {
      const matchup = buildMatchupRecord({
        season,
        round: "divisional",
        conference,
        position: definition.position,
        title: `${conference} Divisional`,
        matchupLabel:
          definition.matchupLabel,
        teamA: definition.teamA,
        teamB: definition.teamB,
        note:
          "NFL reseeding sends the lowest remaining seed to the #1 seed.",
        timestamp,
      });

      return preserveMatchupResult(
        matchup,
        getExistingMatchup(
          previousState,
          matchup.id,
        ),
      );
    },
  );
}

function buildConferenceChampionship(
  season: number,
  conference: NFLConference,
  divisionalMatchups: PlayoffMatchupRecord[],
  timestamp: string,
  previousState: PlayoffSeasonState | null,
): PlayoffMatchupRecord {
  const winners = divisionalMatchups
    .map(getWinner)
    .filter(
      (
        participant,
      ): participant is PlayoffParticipantSnapshot =>
        participant !== null,
    )
    .sort(
      (participantA, participantB) =>
        participantA.seed - participantB.seed,
    );

  const matchup = buildMatchupRecord({
    season,
    round: "conference-championship",
    conference,
    position: 1,
    title: `${conference} Championship`,
    matchupLabel: "Divisional Winners",
    teamA: winners[0] ?? null,
    teamB: winners[1] ?? null,
    note:
      `${conference} champion advances to the Super Bowl.`,
    timestamp,
  });

  return preserveMatchupResult(
    matchup,
    getExistingMatchup(
      previousState,
      matchup.id,
    ),
  );
}

function buildSuperBowl(
  season: number,
  afcChampionship: PlayoffMatchupRecord,
  nfcChampionship: PlayoffMatchupRecord,
  timestamp: string,
  previousState: PlayoffSeasonState | null,
): PlayoffMatchupRecord {
  const matchup = buildMatchupRecord({
    season,
    round: "super-bowl",
    conference: "NFL",
    position: 1,
    title: "Super Bowl",
    matchupLabel:
      "AFC Champion vs NFC Champion",
    teamA: getWinner(afcChampionship),
    teamB: getWinner(nfcChampionship),
    note: "Winner is the league champion.",
    timestamp,
  });

  return preserveMatchupResult(
    matchup,
    getExistingMatchup(
      previousState,
      matchup.id,
    ),
  );
}

function buildMatchupMap(
  matchups: PlayoffMatchupRecord[],
): Record<string, PlayoffMatchupRecord> {
  return matchups.reduce<
    Record<string, PlayoffMatchupRecord>
  >((map, matchup) => {
    map[matchup.id] = matchup;
    return map;
  }, {});
}

export function getPlayoffSeasonId(
  season: number,
): string {
  assertPositiveSeason(season);
  return `${season}-playoffs`;
}

export function getPlayoffMatchupId(
  season: number,
  conference: PlayoffConference,
  round: PlayoffRound,
  position: number,
): string {
  assertPositiveSeason(season);

  if (!Number.isInteger(position) || position <= 0) {
    throw new Error(
      "Playoff matchup position must be a positive integer.",
    );
  }

  return [
    season,
    conference.toLowerCase(),
    round,
    position,
  ].join(":");
}

export function rebuildPlayoffSeason(
  state: PlayoffSeasonState,
  updatedAt?: string,
): PlayoffSeasonState {
  assertPositiveSeason(state.season);

  const timestamp = getTimestamp(updatedAt);
  const conferenceMatchups =
    NFL_CONFERENCE_ORDER.map((conference) => {
      const seeds = state.seeds[conference];
      const wildcardMatchups =
        buildWildcardMatchups(
          state.season,
          conference,
          seeds,
          timestamp,
          state,
        );
      const divisionalMatchups =
        buildDivisionalMatchups(
          state.season,
          conference,
          seeds,
          wildcardMatchups,
          timestamp,
          state,
        );
      const championship =
        buildConferenceChampionship(
          state.season,
          conference,
          divisionalMatchups,
          timestamp,
          state,
        );

      return {
        conference,
        wildcardMatchups,
        divisionalMatchups,
        championship,
      };
    });

  const afcChampionship =
    conferenceMatchups.find(
      (group) => group.conference === "AFC",
    )?.championship;
  const nfcChampionship =
    conferenceMatchups.find(
      (group) => group.conference === "NFC",
    )?.championship;

  if (!afcChampionship || !nfcChampionship) {
    throw new Error(
      "Both conference playoff brackets are required.",
    );
  }

  const superBowl = buildSuperBowl(
    state.season,
    afcChampionship,
    nfcChampionship,
    timestamp,
    state,
  );

  const matchups = buildMatchupMap([
    ...conferenceMatchups.flatMap(
      (group) => [
        ...group.wildcardMatchups,
        ...group.divisionalMatchups,
        group.championship,
      ],
    ),
    superBowl,
  ]);

  const afcChampionId =
    getWinner(afcChampionship)?.playerId ??
    null;
  const nfcChampionId =
    getWinner(nfcChampionship)?.playerId ??
    null;
  const championId =
    getWinner(superBowl)?.playerId ?? null;

  return {
    ...state,
    status: championId ? "complete" : "active",
    updatedAt: timestamp,
    matchups,
    afcChampionId,
    nfcChampionId,
    championId,
  };
}

export function initializePlayoffSeason(
  season: number,
  playoffPicture: NFLPlayoffPicture,
  initializedAt?: string,
): PlayoffSeasonState {
  assertPositiveSeason(season);

  const timestamp = getTimestamp(initializedAt);
  const state: PlayoffSeasonState = {
    id: getPlayoffSeasonId(season),
    season,
    status: "active",
    initializedAt: timestamp,
    updatedAt: timestamp,
    seeds: {
      capturedAt: timestamp,
      AFC: buildConferenceSeeds(
        playoffPicture,
        "AFC",
      ),
      NFC: buildConferenceSeeds(
        playoffPicture,
        "NFC",
      ),
    },
    matchups: {},
    afcChampionId: null,
    nfcChampionId: null,
    championId: null,
  };

  return rebuildPlayoffSeason(
    state,
    timestamp,
  );
}

export function recordPlayoffMatchupResult(
  state: PlayoffSeasonState,
  input: RecordPlayoffMatchupResultInput,
  updatedAt?: string,
): PlayoffSeasonState {
  const matchup = state.matchups[input.matchupId];

  if (!matchup) {
    throw new Error(
      "Playoff matchup was not found.",
    );
  }

  if (
    !matchup.teamA.participant ||
    !matchup.teamB.participant
  ) {
    throw new Error(
      "Playoff matchup participants are not ready.",
    );
  }

  assertValidScore(input.teamAScore);
  assertValidScore(input.teamBScore);

  const timestamp = getTimestamp(updatedAt);
  const isTie =
    input.teamAScore === input.teamBScore;
  const participantIds = [
    matchup.teamA.participant.playerId,
    matchup.teamB.participant.playerId,
  ];

  let winnerId: string | null = null;
  let loserId: string | null = null;
  let resultSource:
    | "score"
    | "commissioner-tie-resolution"
    | null = null;

  if (isTie) {
    const commissionerWinnerId =
      input.commissionerWinnerId?.trim() || null;

    if (
      commissionerWinnerId &&
      !participantIds.includes(
        commissionerWinnerId,
      )
    ) {
      throw new Error(
        "Commissioner playoff winner must be one of the matchup participants.",
      );
    }

    winnerId = commissionerWinnerId;
    loserId = commissionerWinnerId
      ? participantIds.find(
          (playerId) =>
            playerId !== commissionerWinnerId,
        ) ?? null
      : null;
    resultSource = commissionerWinnerId
      ? "commissioner-tie-resolution"
      : null;
  } else if (
    input.teamAScore > input.teamBScore
  ) {
    winnerId =
      matchup.teamA.participant.playerId;
    loserId =
      matchup.teamB.participant.playerId;
    resultSource = "score";
  } else {
    winnerId =
      matchup.teamB.participant.playerId;
    loserId =
      matchup.teamA.participant.playerId;
    resultSource = "score";
  }

  const updatedMatchup: PlayoffMatchupRecord = {
    ...matchup,
    teamA: {
      ...matchup.teamA,
      score: input.teamAScore,
    },
    teamB: {
      ...matchup.teamB,
      score: input.teamBScore,
    },
    status: winnerId
      ? "final"
      : "needs-resolution",
    winnerId,
    loserId,
    isTie,
    resultSource,
    finalizedAt: winnerId ? timestamp : null,
    updatedAt: timestamp,
    note: input.note?.trim() ?? matchup.note,
  };

  return rebuildPlayoffSeason(
    {
      ...state,
      updatedAt: timestamp,
      matchups: {
        ...state.matchups,
        [updatedMatchup.id]: updatedMatchup,
      },
    },
    timestamp,
  );
}

export function clearPlayoffMatchupResult(
  state: PlayoffSeasonState,
  matchupId: string,
  updatedAt?: string,
): PlayoffSeasonState {
  const matchup = state.matchups[matchupId];

  if (!matchup) {
    return state;
  }

  const timestamp = getTimestamp(updatedAt);
  const clearedMatchup: PlayoffMatchupRecord = {
    ...matchup,
    teamA: {
      ...matchup.teamA,
      score: null,
    },
    teamB: {
      ...matchup.teamB,
      score: null,
    },
    status:
      matchup.teamA.participant &&
      matchup.teamB.participant
        ? "ready"
        : "waiting",
    winnerId: null,
    loserId: null,
    isTie: false,
    resultSource: null,
    finalizedAt: null,
    updatedAt: timestamp,
  };

  return rebuildPlayoffSeason(
    {
      ...state,
      updatedAt: timestamp,
      matchups: {
        ...state.matchups,
        [matchupId]: clearedMatchup,
      },
    },
    timestamp,
  );
}

export function getPlayoffMatchupsByRound(
  state: PlayoffSeasonState,
  round: PlayoffRound,
): PlayoffMatchupRecord[] {
  return Object.values(state.matchups)
    .filter((matchup) => matchup.round === round)
    .sort((matchupA, matchupB) => {
      if (
        matchupA.conference !==
        matchupB.conference
      ) {
        return matchupA.conference.localeCompare(
          matchupB.conference,
        );
      }

      return matchupA.position - matchupB.position;
    });
}
