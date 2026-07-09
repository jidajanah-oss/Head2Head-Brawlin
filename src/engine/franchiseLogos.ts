import type { Player } from "../types/player";
import { getNFLTeamDisplayName } from "./nflTeamOwnership";

const FRANCHISE_LOGO_BASE_PATH = "/logos/franchises";

export function normalizeNFLTeamLogoKey(nflTeam?: string | null) {
  return (nflTeam ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function getFranchiseLogoPath(
  nflTeam?: string | null,
  customLogo?: string | null
) {
  const customLogoPath = customLogo?.trim();

  if (customLogoPath) {
    return customLogoPath;
  }

  const logoKey = normalizeNFLTeamLogoKey(nflTeam);

  if (!logoKey) {
    return "";
  }

  return `${FRANCHISE_LOGO_BASE_PATH}/${logoKey}.png`;
}

export function getPlayerFranchiseLogoPath(
  player?: Pick<Player, "nflTeam" | "customLogo"> | null
) {
  if (!player) {
    return "";
  }

  return getFranchiseLogoPath(player.nflTeam, player.customLogo);
}

export function getFranchiseLogoFallbackText(nflTeam?: string | null) {
  const logoKey = normalizeNFLTeamLogoKey(nflTeam);

  if (!logoKey) {
    return "NFL";
  }

  return logoKey.slice(0, 3);
}

export function getFranchiseLogoAlt(
  nflTeam?: string | null,
  displayName?: string | null
) {
  const logoKey = normalizeNFLTeamLogoKey(nflTeam);
  const teamName = displayName?.trim() || getNFLTeamDisplayName(logoKey);

  if (!logoKey) {
    return "Franchise logo";
  }

  return `${teamName} franchise logo`;
}