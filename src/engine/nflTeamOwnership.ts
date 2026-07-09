import type { Player } from "../types/player";

export type NFLConference = "AFC" | "NFC";

export type NFLDivision =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";

export type NFLTeamInfo = {
  abbreviation: string;
  city: string;
  mascot: string;
  displayName: string;
  conference: NFLConference;
  division: NFLDivision;
};

export type NFLDivisionGroup = {
  conference: NFLConference;
  division: NFLDivision;
  teams: NFLTeamInfo[];
  players: Player[];
  claimedCount: number;
  openCount: number;
};

export type NFLTeamOwnershipValidation = {
  valid: boolean;
  reason?: string;
};

export const NFL_CONFERENCE_ORDER: NFLConference[] = ["AFC", "NFC"];

export const NFL_DIVISION_ORDER: NFLDivision[] = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
];

export const NFL_TEAM_DATA: NFLTeamInfo[] = [
  {
    abbreviation: "BUF",
    city: "Buffalo",
    mascot: "Bills",
    displayName: "Buffalo Bills",
    conference: "AFC",
    division: "AFC East",
  },
  {
    abbreviation: "MIA",
    city: "Miami",
    mascot: "Dolphins",
    displayName: "Miami Dolphins",
    conference: "AFC",
    division: "AFC East",
  },
  {
    abbreviation: "NE",
    city: "New England",
    mascot: "Patriots",
    displayName: "New England Patriots",
    conference: "AFC",
    division: "AFC East",
  },
  {
    abbreviation: "NYJ",
    city: "New York",
    mascot: "Jets",
    displayName: "New York Jets",
    conference: "AFC",
    division: "AFC East",
  },
  {
    abbreviation: "BAL",
    city: "Baltimore",
    mascot: "Ravens",
    displayName: "Baltimore Ravens",
    conference: "AFC",
    division: "AFC North",
  },
  {
    abbreviation: "CIN",
    city: "Cincinnati",
    mascot: "Bengals",
    displayName: "Cincinnati Bengals",
    conference: "AFC",
    division: "AFC North",
  },
  {
    abbreviation: "CLE",
    city: "Cleveland",
    mascot: "Browns",
    displayName: "Cleveland Browns",
    conference: "AFC",
    division: "AFC North",
  },
  {
    abbreviation: "PIT",
    city: "Pittsburgh",
    mascot: "Steelers",
    displayName: "Pittsburgh Steelers",
    conference: "AFC",
    division: "AFC North",
  },
  {
    abbreviation: "HOU",
    city: "Houston",
    mascot: "Texans",
    displayName: "Houston Texans",
    conference: "AFC",
    division: "AFC South",
  },
  {
    abbreviation: "IND",
    city: "Indianapolis",
    mascot: "Colts",
    displayName: "Indianapolis Colts",
    conference: "AFC",
    division: "AFC South",
  },
  {
    abbreviation: "JAX",
    city: "Jacksonville",
    mascot: "Jaguars",
    displayName: "Jacksonville Jaguars",
    conference: "AFC",
    division: "AFC South",
  },
  {
    abbreviation: "TEN",
    city: "Tennessee",
    mascot: "Titans",
    displayName: "Tennessee Titans",
    conference: "AFC",
    division: "AFC South",
  },
  {
    abbreviation: "DEN",
    city: "Denver",
    mascot: "Broncos",
    displayName: "Denver Broncos",
    conference: "AFC",
    division: "AFC West",
  },
  {
    abbreviation: "KC",
    city: "Kansas City",
    mascot: "Chiefs",
    displayName: "Kansas City Chiefs",
    conference: "AFC",
    division: "AFC West",
  },
  {
    abbreviation: "LV",
    city: "Las Vegas",
    mascot: "Raiders",
    displayName: "Las Vegas Raiders",
    conference: "AFC",
    division: "AFC West",
  },
  {
    abbreviation: "LAC",
    city: "Los Angeles",
    mascot: "Chargers",
    displayName: "Los Angeles Chargers",
    conference: "AFC",
    division: "AFC West",
  },
  {
    abbreviation: "DAL",
    city: "Dallas",
    mascot: "Cowboys",
    displayName: "Dallas Cowboys",
    conference: "NFC",
    division: "NFC East",
  },
  {
    abbreviation: "NYG",
    city: "New York",
    mascot: "Giants",
    displayName: "New York Giants",
    conference: "NFC",
    division: "NFC East",
  },
  {
    abbreviation: "PHI",
    city: "Philadelphia",
    mascot: "Eagles",
    displayName: "Philadelphia Eagles",
    conference: "NFC",
    division: "NFC East",
  },
  {
    abbreviation: "WAS",
    city: "Washington",
    mascot: "Commanders",
    displayName: "Washington Commanders",
    conference: "NFC",
    division: "NFC East",
  },
  {
    abbreviation: "CHI",
    city: "Chicago",
    mascot: "Bears",
    displayName: "Chicago Bears",
    conference: "NFC",
    division: "NFC North",
  },
  {
    abbreviation: "DET",
    city: "Detroit",
    mascot: "Lions",
    displayName: "Detroit Lions",
    conference: "NFC",
    division: "NFC North",
  },
  {
    abbreviation: "GB",
    city: "Green Bay",
    mascot: "Packers",
    displayName: "Green Bay Packers",
    conference: "NFC",
    division: "NFC North",
  },
  {
    abbreviation: "MIN",
    city: "Minnesota",
    mascot: "Vikings",
    displayName: "Minnesota Vikings",
    conference: "NFC",
    division: "NFC North",
  },
  {
    abbreviation: "ATL",
    city: "Atlanta",
    mascot: "Falcons",
    displayName: "Atlanta Falcons",
    conference: "NFC",
    division: "NFC South",
  },
  {
    abbreviation: "CAR",
    city: "Carolina",
    mascot: "Panthers",
    displayName: "Carolina Panthers",
    conference: "NFC",
    division: "NFC South",
  },
  {
    abbreviation: "NO",
    city: "New Orleans",
    mascot: "Saints",
    displayName: "New Orleans Saints",
    conference: "NFC",
    division: "NFC South",
  },
  {
    abbreviation: "TB",
    city: "Tampa Bay",
    mascot: "Buccaneers",
    displayName: "Tampa Bay Buccaneers",
    conference: "NFC",
    division: "NFC South",
  },
  {
    abbreviation: "ARI",
    city: "Arizona",
    mascot: "Cardinals",
    displayName: "Arizona Cardinals",
    conference: "NFC",
    division: "NFC West",
  },
  {
    abbreviation: "LAR",
    city: "Los Angeles",
    mascot: "Rams",
    displayName: "Los Angeles Rams",
    conference: "NFC",
    division: "NFC West",
  },
  {
    abbreviation: "SF",
    city: "San Francisco",
    mascot: "49ers",
    displayName: "San Francisco 49ers",
    conference: "NFC",
    division: "NFC West",
  },
  {
    abbreviation: "SEA",
    city: "Seattle",
    mascot: "Seahawks",
    displayName: "Seattle Seahawks",
    conference: "NFC",
    division: "NFC West",
  },
];

export function getNFLTeamInfo(teamAbbreviation: string) {
  return (
    NFL_TEAM_DATA.find(
      (team) =>
        team.abbreviation.toLowerCase() === teamAbbreviation.toLowerCase()
    ) ?? null
  );
}

export function getNFLTeamDisplayName(teamAbbreviation: string) {
  return getNFLTeamInfo(teamAbbreviation)?.displayName ?? teamAbbreviation;
}

export function getNFLTeamsByDivision(division: NFLDivision) {
  return NFL_TEAM_DATA.filter((team) => team.division === division);
}

export function getNFLDivisionsByConference(conference: NFLConference) {
  return NFL_DIVISION_ORDER.filter((division) =>
    division.startsWith(conference)
  );
}

export function getClaimedNFLTeamSet(players: Player[]) {
  return new Set(
    players
      .map((player) => player.nflTeam)
      .filter(Boolean)
      .map((team) => team.toUpperCase())
  );
}

export function isNFLTeamClaimed(
  players: Player[],
  teamAbbreviation: string,
  ignorePlayerId?: string
) {
  return players.some(
    (player) =>
      player.id !== ignorePlayerId &&
      player.nflTeam.toUpperCase() === teamAbbreviation.toUpperCase()
  );
}

export function getAvailableNFLTeams(
  players: Player[],
  ignorePlayerId?: string
) {
  return NFL_TEAM_DATA.filter(
    (team) => !isNFLTeamClaimed(players, team.abbreviation, ignorePlayerId)
  );
}

export function validateNFLTeamOwnership(
  players: Player[],
  teamAbbreviation: string,
  ignorePlayerId?: string
): NFLTeamOwnershipValidation {
  if (!teamAbbreviation.trim()) {
    return {
      valid: false,
      reason: "Select an NFL franchise.",
    };
  }

  const teamInfo = getNFLTeamInfo(teamAbbreviation);

  if (!teamInfo) {
    return {
      valid: false,
      reason: "That NFL franchise is not recognized.",
    };
  }

  if (isNFLTeamClaimed(players, teamAbbreviation, ignorePlayerId)) {
    return {
      valid: false,
      reason: `${teamInfo.displayName} is already claimed by another player.`,
    };
  }

  return {
    valid: true,
  };
}

export function getPlayerDivision(player: Player) {
  return getNFLTeamInfo(player.nflTeam)?.division ?? null;
}

export function getPlayerConference(player: Player) {
  return getNFLTeamInfo(player.nflTeam)?.conference ?? null;
}

export function groupPlayersByNFLDivision(players: Player[]): NFLDivisionGroup[] {
  return NFL_DIVISION_ORDER.map((division) => {
    const teams = getNFLTeamsByDivision(division);
    const divisionPlayers = players.filter((player) => {
      const teamInfo = getNFLTeamInfo(player.nflTeam);
      return teamInfo?.division === division;
    });

    return {
      conference: division.startsWith("AFC") ? "AFC" : "NFC",
      division,
      teams,
      players: divisionPlayers,
      claimedCount: divisionPlayers.length,
      openCount: teams.length - divisionPlayers.length,
    };
  });
}

export function getLeagueOwnershipSummary(players: Player[]) {
  const claimedTeams = getClaimedNFLTeamSet(players);
  const claimedCount = claimedTeams.size;
  const totalTeams = NFL_TEAM_DATA.length;
  const openCount = totalTeams - claimedCount;

  return {
    claimedCount,
    openCount,
    totalTeams,
    isFull: claimedCount >= totalTeams,
  };
}