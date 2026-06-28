export type PlayerRole =
  | "commissioner"
  | "backup_commissioner"
  | "player";

export type PlayerStatus =
  | "active"
  | "inactive";

export type Player = {
  id: string;
  name: string;
  nflTeam: string;
  email?: string;
  customLogo?: string;
  status: PlayerStatus;
  role: PlayerRole;