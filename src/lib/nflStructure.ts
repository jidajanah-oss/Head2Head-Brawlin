export type Division =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";

export type Conference = "AFC" | "NFC";

export const nflDivisions: Record<
  Division,
  { conference: Conference; teams: string[] }
> = {
  "AFC East": {
    conference: "AFC",
    teams: ["BUF", "MIA", "NE", "NYJ"],
  },
  "AFC North": {
    conference: "AFC",
    teams: ["BAL", "CIN", "CLE", "PIT"],
  },
  "AFC South": {
    conference: "AFC",
    teams: ["HOU", "IND", "JAX", "TEN"],
  },
  "AFC West": {
    conference: "AFC",
    teams: ["KC", "LV", "LAC", "DEN"],
  },

  "NFC East": {
    conference: "NFC",
    teams: ["DAL", "NYG", "PHI", "WAS"],
  },
  "NFC North": {
    conference: "NFC",
    teams: ["CHI", "DET", "GB", "MIN"],
  },
  "NFC South": {
    conference: "NFC",
    teams: ["ATL", "CAR", "NO", "TB"],
  },
  "NFC West": {
    conference: "NFC",
    teams: ["ARI", "LAR", "SF", "SEA"],
  },
};