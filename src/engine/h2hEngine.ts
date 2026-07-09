import type { Player } from "../types/player";
import {
  NFL_CONFERENCE_ORDER,
  NFL_DIVISION_ORDER,
  NFL_TEAM_DATA,
  getNFLTeamInfo,
  getNFLTeamsByDivision,
  type NFLConference,
  type NFLDivision,
  type NFLTeamInfo,
} from "./nflTeamOwnership";

export type HeadToHeadPicks = Record<string, Record<string, string>>;
export type HeadToHeadGameResults = Record<string, string>;

export type HeadToHeadWeeklyResult =
  | "pending"
  | "win"
  | "loss"
  | "tie"
  | "bye";

export type HeadToHeadMatchup = {
  id: string;
  week: number;
  playerA: Player;
  playerB: Player | null;
};

export type HeadToHeadMatchupResult = HeadToHeadMatchup & {
  playerAScore: number;
  playerBScore: number;
  possiblePoints: number;
  winnerId: string | null;
  resultLabel: string;
  status: "pending" | "final" | "bye";
};

export type HeadToHeadStandingRow = {
  id: string;
  name: string;
  nflTeam: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  leaguePoints: number;
  pickPoints: number;
  possiblePoints: number;
  missingScoredPicks: number;
  weeklyOpponentId: string | null;
  weeklyOpponentName: string;
  weeklyResult: HeadToHeadWeeklyResult;
  weeklyScoreLabel: string;
  hasBye: boolean;
};

export type NFLStyleDivisionStandingRow = HeadToHeadStandingRow & {
  nflTeamAbbreviation: string;
  nflTeamDisplayName: string;
  conference: NFLConference;
  division: NFLDivision;
  conferenceRank: number;
  divisionRank: number;
  divisionPointsBack: number;
  isDivisionLeader: boolean;
  isWildcardSeed: boolean;
};

export type NFLStyleDivisionStandingGroup = {
  conference: NFLConference;
  division: NFLDivision;
  teams: NFLTeamInfo[];
  rows: NFLStyleDivisionStandingRow[];
  leader: NFLStyleDivisionStandingRow | null;
  claimedCount: number;
  openCount: number;
};

export type NFLStyleConferenceStandingGroup = {
  conference: NFLConference;
  divisions: NFLStyleDivisionStandingGroup[];
  rows: NFLStyleDivisionStandingRow[];
  divisionLeaders: NFLStyleDivisionStandingRow[];
  wildcardRows: NFLStyleDivisionStandingRow[];
};

export type NFLStyleDivisionStandings = {
  allRows: NFLStyleDivisionStandingRow[];
  unassignedRows: HeadToHeadStandingRow[];
  divisions: NFLStyleDivisionStandingGroup[];
  conferences: NFLStyleConferenceStandingGroup[];
  claimedTeamCount: number;
  openTeamCount: number;
  totalTeamCount: number;
  occupiedDivisionCount: number;
};

export type NFLPlayoffSeedStatus =
  | "division-leader"
  | "wildcard"
  | "bubble"
  | "outside";

export type NFLPlayoffSeedRow = {
  seed: number;
  row: NFLStyleDivisionStandingRow;
  status: NFLPlayoffSeedStatus;
  seedLabel: string;
};

export type NFLPlayoffBubbleRow = {
  row: NFLStyleDivisionStandingRow;
  bubbleRank: number;
  pointsBack: number;
  status: NFLPlayoffSeedStatus;
};

export type NFLConferencePlayoffPicture = {
  conference: NFLConference;
  seeds: NFLPlayoffSeedRow[];
  divisionSeeds: NFLPlayoffSeedRow[];
  wildcardSeeds: NFLPlayoffSeedRow[];
  bubbleRows: NFLPlayoffBubbleRow[];
  firstRoundBye: NFLPlayoffSeedRow | null;
  playoffTeamCount: number;
  bubbleTeamCount: number;
};

export type NFLPlayoffPicture = {
  conferences: NFLConferencePlayoffPicture[];
  totalPlayoffSeeds: number;
  totalBubbleTeams: number;
};

export type NFLPlayoffBracketRound =
  | "wildcard"
  | "divisional"
  | "conference-championship"
  | "super-bowl";

export type NFLPlayoffBracketSlot = {
  seed: number | null;
  label: string;
  row: NFLStyleDivisionStandingRow | null;
  isBye: boolean;
  isPlaceholder: boolean;
};

export type NFLPlayoffBracketMatchup = {
  id: string;
  conference: NFLConference | "NFL";
  round: NFLPlayoffBracketRound;
  title: string;
  matchupLabel: string;
  teamA: NFLPlayoffBracketSlot;
  teamB: NFLPlayoffBracketSlot;
  note: string;
};

export type NFLConferenceBracketShell = {
  conference: NFLConference;
  firstRoundBye: NFLPlayoffBracketSlot;
  wildcardMatchups: NFLPlayoffBracketMatchup[];
  divisionalMatchups: NFLPlayoffBracketMatchup[];
  conferenceChampionship: NFLPlayoffBracketMatchup;
};

export type NFLPlayoffBracketShell = {
  conferences: NFLConferenceBracketShell[];
  superBowl: NFLPlayoffBracketMatchup;
};

const DIVISION_LEADER_SEED_COUNT = 4;
const WILDCARD_SEED_COUNT = 3;
const BUBBLE_ROW_COUNT = 3;

function rotatePlayers(players: Player[], shift: number) {
  if (players.length <= 1) {
    return players;
  }

  const normalizedShift = shift % players.length;

  return [...players.slice(normalizedShift), ...players.slice(0, normalizedShift)];
}

function getActivePlayers(players: Player[]) {
  return players.filter((player) => player.status === "active");
}

function getPlayerPickScore(
  playerId: string,
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults
) {
  const playerPicks = picks[playerId] ?? {};
  const scoredGameIds = Object.keys(gameResults).filter((gameId) =>
    Boolean(gameResults[gameId])
  );

  let correct = 0;
  let missing = 0;

  for (const gameId of scoredGameIds) {
    const winningTeam = gameResults[gameId];
    const selectedTeam = playerPicks[gameId];

    if (!selectedTeam) {
      missing += 1;
    }

    if (selectedTeam === winningTeam) {
      correct += 1;
    }
  }

  return {
    correct,
    possible: scoredGameIds.length,
    missing,
  };
}

function getSeedLabel(seed: number, status: NFLPlayoffSeedStatus) {
  if (status === "division-leader") {
    return `#${seed} Division Leader`;
  }

  if (status === "wildcard") {
    return `#${seed} Wildcard`;
  }

  if (status === "bubble") {
    return "On The Bubble";
  }

  return "Outside Looking In";
}

function buildBracketSlot(
  seed: NFLPlayoffSeedRow | null,
  fallbackLabel: string,
  isBye = false
): NFLPlayoffBracketSlot {
  if (!seed) {
    return {
      seed: null,
      label: fallbackLabel,
      row: null,
      isBye,
      isPlaceholder: true,
    };
  }

  return {
    seed: seed.seed,
    label: `#${seed.seed} ${seed.row.nflTeamAbbreviation} • ${seed.row.name}`,
    row: seed.row,
    isBye,
    isPlaceholder: false,
  };
}

function buildPlaceholderSlot(label: string): NFLPlayoffBracketSlot {
  return {
    seed: null,
    label,
    row: null,
    isBye: false,
    isPlaceholder: true,
  };
}

function getSeedByNumber(
  conference: NFLConferencePlayoffPicture,
  seedNumber: number
) {
  return conference.seeds.find((seed) => seed.seed === seedNumber) ?? null;
}

export function compareHeadToHeadStandingRows(
  playerA: HeadToHeadStandingRow,
  playerB: HeadToHeadStandingRow
) {
  if (playerB.leaguePoints !== playerA.leaguePoints) {
    return playerB.leaguePoints - playerA.leaguePoints;
  }

  if (playerB.wins !== playerA.wins) {
    return playerB.wins - playerA.wins;
  }

  if (playerB.pickPoints !== playerA.pickPoints) {
    return playerB.pickPoints - playerA.pickPoints;
  }

  if (playerA.losses !== playerB.losses) {
    return playerA.losses - playerB.losses;
  }

  return playerA.name.localeCompare(playerB.name);
}

export function buildWeeklyHeadToHeadMatchups(
  players: Player[],
  week: number
): HeadToHeadMatchup[] {
  const activePlayers = getActivePlayers(players);

  if (activePlayers.length === 0) {
    return [];
  }

  if (activePlayers.length === 1) {
    return [
      {
        id: `week-${week}-matchup-1`,
        week,
        playerA: activePlayers[0],
        playerB: null,
      },
    ];
  }

  const [fixedPlayer, ...rotatingPlayers] = activePlayers;
  const rotationShift = Math.max(week - 1, 0);
  const weeklyOrder =
    week <= 1
      ? activePlayers
      : [fixedPlayer, ...rotatePlayers(rotatingPlayers, rotationShift)];

  const matchups: HeadToHeadMatchup[] = [];

  for (let index = 0; index < weeklyOrder.length; index += 2) {
    const playerA = weeklyOrder[index];
    const playerB = weeklyOrder[index + 1] ?? null;

    matchups.push({
      id: `week-${week}-matchup-${matchups.length + 1}`,
      week,
      playerA,
      playerB,
    });
  }

  return matchups;
}

export function evaluateHeadToHeadMatchup(
  matchup: HeadToHeadMatchup,
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults
): HeadToHeadMatchupResult {
  const playerAScore = getPlayerPickScore(
    matchup.playerA.id,
    picks,
    gameResults
  );

  if (!matchup.playerB) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: 0,
      possiblePoints: playerAScore.possible,
      winnerId: null,
      resultLabel: "Bye Week",
      status: "bye",
    };
  }

  const playerBScore = getPlayerPickScore(
    matchup.playerB.id,
    picks,
    gameResults
  );

  const possiblePoints = Math.max(playerAScore.possible, playerBScore.possible);

  if (possiblePoints === 0) {
    return {
      ...matchup,
      playerAScore: 0,
      playerBScore: 0,
      possiblePoints,
      winnerId: null,
      resultLabel: "Pending",
      status: "pending",
    };
  }

  if (playerAScore.correct > playerBScore.correct) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: playerBScore.correct,
      possiblePoints,
      winnerId: matchup.playerA.id,
      resultLabel: `${matchup.playerA.name} wins`,
      status: "final",
    };
  }

  if (playerBScore.correct > playerAScore.correct) {
    return {
      ...matchup,
      playerAScore: playerAScore.correct,
      playerBScore: playerBScore.correct,
      possiblePoints,
      winnerId: matchup.playerB.id,
      resultLabel: `${matchup.playerB.name} wins`,
      status: "final",
    };
  }

  return {
    ...matchup,
    playerAScore: playerAScore.correct,
    playerBScore: playerBScore.correct,
    possiblePoints,
    winnerId: null,
    resultLabel: "Tie",
    status: "final",
  };
}

export function buildHeadToHeadStandings(
  players: Player[],
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults,
  week: number
): HeadToHeadStandingRow[] {
  const activePlayers = getActivePlayers(players);
  const matchups = buildWeeklyHeadToHeadMatchups(activePlayers, week);
  const evaluatedMatchups = matchups.map((matchup) =>
    evaluateHeadToHeadMatchup(matchup, picks, gameResults)
  );

  const rows = activePlayers.reduce<Record<string, HeadToHeadStandingRow>>(
    (standings, player) => {
      const pickScore = getPlayerPickScore(player.id, picks, gameResults);

      standings[player.id] = {
        id: player.id,
        name: player.name,
        nflTeam: player.nflTeam,
        rank: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        leaguePoints: 0,
        pickPoints: pickScore.correct,
        possiblePoints: pickScore.possible,
        missingScoredPicks: pickScore.missing,
        weeklyOpponentId: null,
        weeklyOpponentName: "Waiting",
        weeklyResult: "pending",
        weeklyScoreLabel: "0-0",
        hasBye: false,
      };

      return standings;
    },
    {}
  );

  for (const matchup of evaluatedMatchups) {
    const playerA = rows[matchup.playerA.id];

    if (!playerA) {
      continue;
    }

    if (!matchup.playerB) {
      playerA.weeklyOpponentId = null;
      playerA.weeklyOpponentName = "Bye Week";
      playerA.weeklyResult = "bye";
      playerA.weeklyScoreLabel = `${matchup.playerAScore}-0`;
      playerA.hasBye = true;
      continue;
    }

    const playerB = rows[matchup.playerB.id];

    if (!playerB) {
      continue;
    }

    playerA.weeklyOpponentId = playerB.id;
    playerA.weeklyOpponentName = playerB.name;
    playerA.weeklyScoreLabel = `${matchup.playerAScore}-${matchup.playerBScore}`;

    playerB.weeklyOpponentId = playerA.id;
    playerB.weeklyOpponentName = playerA.name;
    playerB.weeklyScoreLabel = `${matchup.playerBScore}-${matchup.playerAScore}`;

    if (matchup.status === "pending") {
      playerA.weeklyResult = "pending";
      playerB.weeklyResult = "pending";
      continue;
    }

    if (!matchup.winnerId) {
      playerA.ties += 1;
      playerB.ties += 1;
      playerA.leaguePoints += 1;
      playerB.leaguePoints += 1;
      playerA.weeklyResult = "tie";
      playerB.weeklyResult = "tie";
      continue;
    }

    if (matchup.winnerId === playerA.id) {
      playerA.wins += 1;
      playerA.leaguePoints += 3;
      playerA.weeklyResult = "win";

      playerB.losses += 1;
      playerB.weeklyResult = "loss";
      continue;
    }

    playerB.wins += 1;
    playerB.leaguePoints += 3;
    playerB.weeklyResult = "win";

    playerA.losses += 1;
    playerA.weeklyResult = "loss";
  }

  return Object.values(rows)
    .sort(compareHeadToHeadStandingRows)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

export function buildHeadToHeadMatchupResults(
  players: Player[],
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults,
  week: number
): HeadToHeadMatchupResult[] {
  return buildWeeklyHeadToHeadMatchups(players, week).map((matchup) =>
    evaluateHeadToHeadMatchup(matchup, picks, gameResults)
  );
}

export function buildNFLStyleDivisionStandings(
  players: Player[],
  picks: HeadToHeadPicks,
  gameResults: HeadToHeadGameResults,
  week: number
): NFLStyleDivisionStandings {
  const baseStandings = buildHeadToHeadStandings(
    players,
    picks,
    gameResults,
    week
  );

  const assignedRows: NFLStyleDivisionStandingRow[] = [];
  const unassignedRows: HeadToHeadStandingRow[] = [];

  for (const row of baseStandings) {
    const teamInfo = getNFLTeamInfo(row.nflTeam);

    if (!teamInfo) {
      unassignedRows.push(row);
      continue;
    }

    assignedRows.push({
      ...row,
      nflTeamAbbreviation: teamInfo.abbreviation,
      nflTeamDisplayName: teamInfo.displayName,
      conference: teamInfo.conference,
      division: teamInfo.division,
      conferenceRank: 0,
      divisionRank: 0,
      divisionPointsBack: 0,
      isDivisionLeader: false,
      isWildcardSeed: false,
    });
  }

  const divisions: NFLStyleDivisionStandingGroup[] = NFL_DIVISION_ORDER.map(
    (division) => {
      const teams = getNFLTeamsByDivision(division);
      const rows = assignedRows
        .filter((row) => row.division === division)
        .sort(compareHeadToHeadStandingRows);

      const leaderLeaguePoints = rows[0]?.leaguePoints ?? 0;

      rows.forEach((row, index) => {
        row.divisionRank = index + 1;
        row.divisionPointsBack = Math.max(
          leaderLeaguePoints - row.leaguePoints,
          0
        );
        row.isDivisionLeader = index === 0;
      });

      return {
        conference: division.startsWith("AFC") ? "AFC" : "NFC",
        division,
        teams,
        rows,
        leader: rows[0] ?? null,
        claimedCount: rows.length,
        openCount: teams.length - rows.length,
      };
    }
  );

  const conferences: NFLStyleConferenceStandingGroup[] =
    NFL_CONFERENCE_ORDER.map((conference) => {
      const conferenceDivisions = divisions.filter(
        (division) => division.conference === conference
      );

      const rows = assignedRows
        .filter((row) => row.conference === conference)
        .sort(compareHeadToHeadStandingRows);

      rows.forEach((row, index) => {
        row.conferenceRank = index + 1;
      });

      const divisionLeaders = conferenceDivisions
        .map((division) => division.leader)
        .filter((row): row is NFLStyleDivisionStandingRow => Boolean(row))
        .sort(compareHeadToHeadStandingRows);

      const wildcardRows = rows
        .filter((row) => !row.isDivisionLeader)
        .sort(compareHeadToHeadStandingRows);

      wildcardRows.forEach((row, index) => {
        row.isWildcardSeed = index < WILDCARD_SEED_COUNT;
      });

      return {
        conference,
        divisions: conferenceDivisions,
        rows,
        divisionLeaders,
        wildcardRows,
      };
    });

  const allRows = [...assignedRows].sort(compareHeadToHeadStandingRows);

  const claimedTeamCount = assignedRows.length;
  const totalTeamCount = NFL_TEAM_DATA.length;
  const openTeamCount = totalTeamCount - claimedTeamCount;
  const occupiedDivisionCount = divisions.filter(
    (division) => division.claimedCount > 0
  ).length;

  return {
    allRows,
    unassignedRows,
    divisions,
    conferences,
    claimedTeamCount,
    openTeamCount,
    totalTeamCount,
    occupiedDivisionCount,
  };
}

export function buildNFLPlayoffPicture(
  divisionStandings: NFLStyleDivisionStandings
): NFLPlayoffPicture {
  const conferences: NFLConferencePlayoffPicture[] =
    divisionStandings.conferences.map((conference) => {
      const divisionSeeds: NFLPlayoffSeedRow[] = conference.divisionLeaders
        .slice(0, DIVISION_LEADER_SEED_COUNT)
        .map((row, index) => {
          const seed = index + 1;

          return {
            seed,
            row,
            status: "division-leader",
            seedLabel: getSeedLabel(seed, "division-leader"),
          };
        });

      const divisionSeedIds = new Set(
        divisionSeeds.map((seedRow) => seedRow.row.id)
      );

      const wildcardEligibleRows = conference.rows
        .filter((row) => !divisionSeedIds.has(row.id))
        .sort(compareHeadToHeadStandingRows);

      const wildcardSeeds: NFLPlayoffSeedRow[] = wildcardEligibleRows
        .slice(0, WILDCARD_SEED_COUNT)
        .map((row, index) => {
          const seed = divisionSeeds.length + index + 1;

          return {
            seed,
            row,
            status: "wildcard",
            seedLabel: getSeedLabel(seed, "wildcard"),
          };
        });

      const lastWildcardPoints =
        wildcardSeeds[wildcardSeeds.length - 1]?.row.leaguePoints ?? 0;

      const bubbleRows: NFLPlayoffBubbleRow[] = wildcardEligibleRows
        .slice(WILDCARD_SEED_COUNT, WILDCARD_SEED_COUNT + BUBBLE_ROW_COUNT)
        .map((row, index) => ({
          row,
          bubbleRank: index + 1,
          pointsBack: Math.max(lastWildcardPoints - row.leaguePoints, 0),
          status: "bubble",
        }));

      const seeds = [...divisionSeeds, ...wildcardSeeds].sort(
        (seedA, seedB) => seedA.seed - seedB.seed
      );

      return {
        conference: conference.conference,
        seeds,
        divisionSeeds,
        wildcardSeeds,
        bubbleRows,
        firstRoundBye: seeds[0] ?? null,
        playoffTeamCount: seeds.length,
        bubbleTeamCount: bubbleRows.length,
      };
    });

  return {
    conferences,
    totalPlayoffSeeds: conferences.reduce(
      (sum, conference) => sum + conference.playoffTeamCount,
      0
    ),
    totalBubbleTeams: conferences.reduce(
      (sum, conference) => sum + conference.bubbleTeamCount,
      0
    ),
  };
}

export function buildNFLPlayoffBracketShell(
  playoffPicture: NFLPlayoffPicture
): NFLPlayoffBracketShell {
  const conferences: NFLConferenceBracketShell[] =
    playoffPicture.conferences.map((conference) => {
      const seed1 = getSeedByNumber(conference, 1);
      const seed2 = getSeedByNumber(conference, 2);
      const seed3 = getSeedByNumber(conference, 3);
      const seed4 = getSeedByNumber(conference, 4);
      const seed5 = getSeedByNumber(conference, 5);
      const seed6 = getSeedByNumber(conference, 6);
      const seed7 = getSeedByNumber(conference, 7);

      const firstRoundBye = buildBracketSlot(
        seed1,
        "#1 Seed TBD",
        true
      );

      const wildcardMatchups: NFLPlayoffBracketMatchup[] = [
        {
          id: `${conference.conference.toLowerCase()}-wildcard-2-7`,
          conference: conference.conference,
          round: "wildcard",
          title: "Wildcard Round",
          matchupLabel: "#2 vs #7",
          teamA: buildBracketSlot(seed2, "#2 Seed TBD"),
          teamB: buildBracketSlot(seed7, "#7 Seed TBD"),
          note: "Winner advances to the divisional round.",
        },
        {
          id: `${conference.conference.toLowerCase()}-wildcard-3-6`,
          conference: conference.conference,
          round: "wildcard",
          title: "Wildcard Round",
          matchupLabel: "#3 vs #6",
          teamA: buildBracketSlot(seed3, "#3 Seed TBD"),
          teamB: buildBracketSlot(seed6, "#6 Seed TBD"),
          note: "Winner advances to the divisional round.",
        },
        {
          id: `${conference.conference.toLowerCase()}-wildcard-4-5`,
          conference: conference.conference,
          round: "wildcard",
          title: "Wildcard Round",
          matchupLabel: "#4 vs #5",
          teamA: buildBracketSlot(seed4, "#4 Seed TBD"),
          teamB: buildBracketSlot(seed5, "#5 Seed TBD"),
          note: "Winner advances to the divisional round.",
        },
      ];

      const divisionalMatchups: NFLPlayoffBracketMatchup[] = [
        {
          id: `${conference.conference.toLowerCase()}-divisional-1`,
          conference: conference.conference,
          round: "divisional",
          title: "Divisional Round",
          matchupLabel: "#1 Seed vs Lowest Remaining Seed",
          teamA: firstRoundBye,
          teamB: buildPlaceholderSlot("Lowest Remaining Wildcard Winner"),
          note: "Placeholder shell. Reseeding logic comes later.",
        },
        {
          id: `${conference.conference.toLowerCase()}-divisional-2`,
          conference: conference.conference,
          round: "divisional",
          title: "Divisional Round",
          matchupLabel: "Remaining Winners",
          teamA: buildPlaceholderSlot("Highest Remaining Wildcard Winner"),
          teamB: buildPlaceholderSlot("Second Remaining Wildcard Winner"),
          note: "Placeholder shell. Winners will be wired in later.",
        },
      ];

      const conferenceChampionship: NFLPlayoffBracketMatchup = {
        id: `${conference.conference.toLowerCase()}-championship`,
        conference: conference.conference,
        round: "conference-championship",
        title: `${conference.conference} Championship`,
        matchupLabel: "Divisional Winners",
        teamA: buildPlaceholderSlot("Divisional Winner"),
        teamB: buildPlaceholderSlot("Divisional Winner"),
        note: `${conference.conference} champion advances to the Super Bowl.`,
      };

      return {
        conference: conference.conference,
        firstRoundBye,
        wildcardMatchups,
        divisionalMatchups,
        conferenceChampionship,
      };
    });

  const superBowl: NFLPlayoffBracketMatchup = {
    id: "super-bowl",
    conference: "NFL",
    round: "super-bowl",
    title: "Super Bowl",
    matchupLabel: "AFC Champion vs NFC Champion",
    teamA: buildPlaceholderSlot("AFC Champion"),
    teamB: buildPlaceholderSlot("NFC Champion"),
    note: "Final championship matchup shell.",
  };

  return {
    conferences,
    superBowl,
  };
}

export function formatHeadToHeadRecord(row: HeadToHeadStandingRow) {
  return `${row.wins}-${row.losses}-${row.ties}`;
}

export function formatWeeklyResultLabel(result: HeadToHeadWeeklyResult) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "tie") return "Tie";
  if (result === "bye") return "Bye";
  return "Pending";
}