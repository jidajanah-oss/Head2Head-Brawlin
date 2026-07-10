import type { Player } from "../types/player";

import { getNFLTeamDisplayName } from "./nflTeamOwnership";

const FRANCHISE_LOGO_DIRECTORY =
  "logos/franchises";

function getApplicationBasePath(): string {
  const configuredBasePath =
    import.meta.env.BASE_URL?.trim() || "/";

  return configuredBasePath.endsWith("/")
    ? configuredBasePath
    : `${configuredBasePath}/`;
}

function isExternalAssetPath(
  path: string,
): boolean {
  return (
    /^(?:[a-z]+:)?\/\//i.test(path) ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  );
}

function resolvePublicAssetPath(
  path: string,
): string {
  const normalizedPath = path.trim();

  if (!normalizedPath) {
    return "";
  }

  if (isExternalAssetPath(normalizedPath)) {
    return normalizedPath;
  }

  const basePath = getApplicationBasePath();
  const pathWithoutLeadingSlash =
    normalizedPath.replace(/^\/+/, "");

  if (
    basePath !== "/" &&
    normalizedPath.startsWith(basePath)
  ) {
    return normalizedPath;
  }

  return `${basePath}${pathWithoutLeadingSlash}`;
}

export function normalizeNFLTeamLogoKey(
  nflTeam?: string | null,
) {
  return (nflTeam ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function getDefaultFranchiseLogoPath(
  nflTeam?: string | null,
) {
  const logoKey =
    normalizeNFLTeamLogoKey(nflTeam);

  if (!logoKey) {
    return "";
  }

  return resolvePublicAssetPath(
    `${FRANCHISE_LOGO_DIRECTORY}/${logoKey}.png`,
  );
}

export function getFranchiseLogoPath(
  nflTeam?: string | null,
  customLogo?: string | null,
) {
  const customLogoPath =
    customLogo?.trim();

  if (customLogoPath) {
    return resolvePublicAssetPath(
      customLogoPath,
    );
  }

  return getDefaultFranchiseLogoPath(
    nflTeam,
  );
}

export function getPlayerFranchiseLogoPath(
  player?:
    | Pick<
        Player,
        "nflTeam" | "customLogo"
      >
    | null,
) {
  if (!player) {
    return "";
  }

  return getFranchiseLogoPath(
    player.nflTeam,
    player.customLogo,
  );
}

export function getFranchiseLogoFallbackText(
  nflTeam?: string | null,
) {
  const logoKey =
    normalizeNFLTeamLogoKey(nflTeam);

  if (!logoKey) {
    return "NFL";
  }

  return logoKey.slice(0, 3);
}

export function getFranchiseLogoAlt(
  nflTeam?: string | null,
  displayName?: string | null,
) {
  const logoKey =
    normalizeNFLTeamLogoKey(nflTeam);

  const teamName =
    displayName?.trim() ||
    getNFLTeamDisplayName(logoKey);

  if (!logoKey) {
    return "Franchise logo";
  }

  return `${teamName} franchise logo`;
}
