export type PlayerStatus = "active" | "inactive";

export type Player = {
  id: string;
  name: string;
  nflTeam: string;
  email?: string;
  status: PlayerStatus;
};