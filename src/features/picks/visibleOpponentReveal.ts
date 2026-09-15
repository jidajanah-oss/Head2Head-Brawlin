import type { CloudOpponentPickReveal } from "../../services/cloudOpponentPickRevealService";

export function visibleOpponentReveal(
  response: CloudOpponentPickReveal | null,
  target: { allowed: boolean; leagueId?: string; playerId: string; season: number; week: number },
): CloudOpponentPickReveal | null {
  return target.allowed && response?.leagueId === target.leagueId &&
    response?.viewerPlayerId === target.playerId && response?.season === target.season &&
    response?.week === target.week ? response : null;
}

export function revealedOpponentPick(response: CloudOpponentPickReveal | null, gameId: string) {
  return response?.canReveal && response.matchupType === "owned-opponent"
    ? response.revealedPicks.find(pick => pick.gameId === gameId && pick.locked)
    : undefined;
}
