export type ObscureStatCoinFlipResolution = {
  id: string;
  season: number;
  week: number;

  winnerPlayerId: string;
  eligiblePlayerIds: string[];

  resolvedAt: string;
};

export type ObscureStatCoinFlipHistory = Record<
  string,
  ObscureStatCoinFlipResolution
>;

export function getObscureStatCoinFlipId(
  season: number,
  week: number,
): string {
  return `${season}-week-${week}-obscure-stat-coin-flip`;
}