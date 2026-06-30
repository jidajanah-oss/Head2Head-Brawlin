export type NFLByeWeekMap = Record<string, number>;

export const byeWeeks2026: NFLByeWeekMap = {
  "ARI": 1,
  "ATL": 1,
  "CAR": 1,
  "CHI": 1,
  "CIN": 1,
  "CLE": 1,
  "DAL": 1,
  "DEN": 1,
  "DET": 1,
  "GB": 1,
  "HOU": 1,
  "IND": 1,
  "JAX": 1,
  "LAC": 1,
  "LAR": 1,
  "LV": 1,
  "MIN": 1,
  "NE": 1,
  "NO": 1,
  "NYG": 1,
  "NYJ": 1,
  "PHI": 1,
  "PIT": 1,
  "SEA": 1,
  "SF": 1,
  "TB": 1,
  "TEN": 1,
  "WAS": 1
};

export function getByeWeek(teamId: string, season: number) {
  if (season === 2026) {
    return byeWeeks2026[teamId] ?? null;
  }

  return null;
}
