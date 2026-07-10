import type { NFLConference } from "./nflTeamOwnership";

export type PlayoffRound =
  | "wildcard"
  | "divisional"
  | "conference-championship"
  | "super-bowl";

export type PlayoffConference =
  | NFLConference
  | "NFL";

export type PlayoffSeasonStatus =
  | "active"
  | "complete";

export type PlayoffMatchupStatus =
  | "waiting"
  | "ready"
  | "needs-resolution"
  | "final";

export type PlayoffResultSource =
  | "score"
  | "commissioner-tie-resolution";

export type PlayoffParticipantSnapshot = {
  playerId: string;
  playerName: string;
  nflTeam: string;
  conference: NFLConference;
  seed: number;
  regularSeasonLeaguePoints: number;
  regularSeasonWins: number;
  regularSeasonLosses: number;
  regularSeasonTies: number;
  regularSeasonCorrectPicks: number;
};

export type PlayoffMatchupSide = {
  participant: PlayoffParticipantSnapshot | null;
  score: number | null;
};

export type PlayoffMatchupRecord = {
  id: string;
  season: number;
  round: PlayoffRound;
  conference: PlayoffConference;
  position: number;
  title: string;
  matchupLabel: string;
  teamA: PlayoffMatchupSide;
  teamB: PlayoffMatchupSide;
  status: PlayoffMatchupStatus;
  winnerId: string | null;
  loserId: string | null;
  isTie: boolean;
  resultSource: PlayoffResultSource | null;
  finalizedAt: string | null;
  updatedAt: string;
  note: string;
};

export type PlayoffSeedSnapshot = {
  capturedAt: string;
  AFC: PlayoffParticipantSnapshot[];
  NFC: PlayoffParticipantSnapshot[];
};

export type PlayoffSeasonState = {
  id: string;
  season: number;
  status: PlayoffSeasonStatus;
  initializedAt: string;
  updatedAt: string;
  seeds: PlayoffSeedSnapshot;
  matchups: Record<string, PlayoffMatchupRecord>;
  afcChampionId: string | null;
  nfcChampionId: string | null;
  championId: string | null;
};

export type PlayoffResultsHistory = Record<
  string,
  PlayoffSeasonState
>;

export type RecordPlayoffMatchupResultInput = {
  matchupId: string;
  teamAScore: number;
  teamBScore: number;
  commissionerWinnerId?: string | null;
  note?: string;
};
