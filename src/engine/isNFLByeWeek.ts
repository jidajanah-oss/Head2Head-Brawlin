// Use the selected week's schedule; an unavailable schedule cannot establish a bye.
export function isNFLByeWeek(team: string, week: number, games: Array<{
  week: number; homeTeam: string | { abbreviation: string }; awayTeam: string | { abbreviation: string };
}>): boolean {
  const weekGames = games.filter(game => game.week === week);
  const normalize = (value: string | { abbreviation: string }) =>
    (typeof value === "string" ? value : value.abbreviation).trim().toUpperCase();
  const franchise = team.trim().toUpperCase();
  return Boolean(franchise) && weekGames.length > 0 && !weekGames.some(game =>
    normalize(game.homeTeam) === franchise || normalize(game.awayTeam) === franchise);
}
