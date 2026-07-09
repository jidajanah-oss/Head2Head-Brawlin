import type { NFLDataProvider } from "./NFLDataProvider";
import type { NFLGame } from "./NFLTypes";

const mockGames: NFLGame[] = [
  {
    id: "2026-W1-G1",
    week: 1,
    season: 2026,
    kickoff: "2026-09-10T20:20:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "DAL",
      abbreviation: "DAL",
      name: "Cowboys",
      displayName: "Dallas Cowboys",
    },
    homeTeam: {
      id: "PHI",
      abbreviation: "PHI",
      name: "Eagles",
      displayName: "Philadelphia Eagles",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G2",
    week: 1,
    season: 2026,
    kickoff: "2026-09-11T20:15:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "BAL",
      abbreviation: "BAL",
      name: "Ravens",
      displayName: "Baltimore Ravens",
    },
    homeTeam: {
      id: "CIN",
      abbreviation: "CIN",
      name: "Bengals",
      displayName: "Cincinnati Bengals",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G3",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "PIT",
      abbreviation: "PIT",
      name: "Steelers",
      displayName: "Pittsburgh Steelers",
    },
    homeTeam: {
      id: "CLE",
      abbreviation: "CLE",
      name: "Browns",
      displayName: "Cleveland Browns",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G4",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "MIA",
      abbreviation: "MIA",
      name: "Dolphins",
      displayName: "Miami Dolphins",
    },
    homeTeam: {
      id: "BUF",
      abbreviation: "BUF",
      name: "Bills",
      displayName: "Buffalo Bills",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G5",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "NE",
      abbreviation: "NE",
      name: "Patriots",
      displayName: "New England Patriots",
    },
    homeTeam: {
      id: "NYJ",
      abbreviation: "NYJ",
      name: "Jets",
      displayName: "New York Jets",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G6",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "LV",
      abbreviation: "LV",
      name: "Raiders",
      displayName: "Las Vegas Raiders",
    },
    homeTeam: {
      id: "LAC",
      abbreviation: "LAC",
      name: "Chargers",
      displayName: "Los Angeles Chargers",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G7",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "HOU",
      abbreviation: "HOU",
      name: "Texans",
      displayName: "Houston Texans",
    },
    homeTeam: {
      id: "IND",
      abbreviation: "IND",
      name: "Colts",
      displayName: "Indianapolis Colts",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G8",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "TEN",
      abbreviation: "TEN",
      name: "Titans",
      displayName: "Tennessee Titans",
    },
    homeTeam: {
      id: "JAX",
      abbreviation: "JAX",
      name: "Jaguars",
      displayName: "Jacksonville Jaguars",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G9",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "ATL",
      abbreviation: "ATL",
      name: "Falcons",
      displayName: "Atlanta Falcons",
    },
    homeTeam: {
      id: "CAR",
      abbreviation: "CAR",
      name: "Panthers",
      displayName: "Carolina Panthers",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G10",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T13:00:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "NO",
      abbreviation: "NO",
      name: "Saints",
      displayName: "New Orleans Saints",
    },
    homeTeam: {
      id: "TB",
      abbreviation: "TB",
      name: "Buccaneers",
      displayName: "Tampa Bay Buccaneers",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G11",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T16:05:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "ARI",
      abbreviation: "ARI",
      name: "Cardinals",
      displayName: "Arizona Cardinals",
    },
    homeTeam: {
      id: "SEA",
      abbreviation: "SEA",
      name: "Seahawks",
      displayName: "Seattle Seahawks",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G12",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T16:25:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "SF",
      abbreviation: "SF",
      name: "49ers",
      displayName: "San Francisco 49ers",
    },
    homeTeam: {
      id: "LAR",
      abbreviation: "LAR",
      name: "Rams",
      displayName: "Los Angeles Rams",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G13",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T16:25:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "CHI",
      abbreviation: "CHI",
      name: "Bears",
      displayName: "Chicago Bears",
    },
    homeTeam: {
      id: "GB",
      abbreviation: "GB",
      name: "Packers",
      displayName: "Green Bay Packers",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G14",
    week: 1,
    season: 2026,
    kickoff: "2026-09-13T20:20:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "MIN",
      abbreviation: "MIN",
      name: "Vikings",
      displayName: "Minnesota Vikings",
    },
    homeTeam: {
      id: "DET",
      abbreviation: "DET",
      name: "Lions",
      displayName: "Detroit Lions",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G15",
    week: 1,
    season: 2026,
    kickoff: "2026-09-14T19:15:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "NYG",
      abbreviation: "NYG",
      name: "Giants",
      displayName: "New York Giants",
    },
    homeTeam: {
      id: "WAS",
      abbreviation: "WAS",
      name: "Commanders",
      displayName: "Washington Commanders",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
  {
    id: "2026-W1-G16",
    week: 1,
    season: 2026,
    kickoff: "2026-09-14T20:30:00-04:00",
    status: "scheduled",
    awayTeam: {
      id: "KC",
      abbreviation: "KC",
      name: "Chiefs",
      displayName: "Kansas City Chiefs",
    },
    homeTeam: {
      id: "DEN",
      abbreviation: "DEN",
      name: "Broncos",
      displayName: "Denver Broncos",
    },
    score: {
      away: 0,
      home: 0,
    },
  },
];

export class MockNFLDataProvider implements NFLDataProvider {
  async getGamesByWeek(season: number, week: number): Promise<NFLGame[]> {
    return mockGames.filter(
      (game) => game.season === season && game.week === week
    );
  }

  async getGameById(gameId: string): Promise<NFLGame | null> {
    return mockGames.find((game) => game.id === gameId) ?? null;
  }
}