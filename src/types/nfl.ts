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

export interface NFLTeam {
  id: string;
  abbreviation: string;
  city: string;
  nickname: string;
  fullName: string;
  conference: NFLConference;
  division: NFLDivision;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface NFLScheduleGame {
  id: string;
  season: number;
  week: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  completed: boolean;
  winner?: string;
  homeScore?: number;
  awayScore?: number;
}

export interface NFLScheduleWeek {
  season: number;
  week: number;
  games: NFLScheduleGame[];
}