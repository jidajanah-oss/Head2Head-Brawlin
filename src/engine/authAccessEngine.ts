import type { PlayerRole } from "../types/player";
import type {
  CloudAccessState,
  CloudAccountLink,
  CloudAuthIdentity,
} from "./authAccessTypes";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthEmail(
  email: string,
): string {
  return email.trim().toLowerCase();
}

export function isValidAuthEmail(
  email: string,
): boolean {
  return EMAIL_PATTERN.test(
    normalizeAuthEmail(email),
  );
}

export function isCommissionerRole(
  role: PlayerRole | null,
): boolean {
  return (
    role === "commissioner" ||
    role === "backup_commissioner"
  );
}

export function buildCloudAccessState(
  identity: CloudAuthIdentity | null,
  accountLink: CloudAccountLink | null,
): CloudAccessState {
  const validAccountLink =
    identity &&
    accountLink &&
    accountLink.active &&
    accountLink.userId === identity.userId
      ? accountLink
      : null;

  const role = validAccountLink?.role ?? null;
  const isAuthenticated = Boolean(identity);
  const isLinked = Boolean(validAccountLink);
  const hasCommissionerAccess =
    isCommissionerRole(role);

  return {
    identity,
    accountLink: validAccountLink,
    role,
    linkedPlayerId:
      validAccountLink?.playerId ?? null,
    isAuthenticated,
    isLinked,
    canViewLeague: isLinked,
    canManageOwnPicks:
      isLinked && Boolean(validAccountLink),
    canManageAllPicks:
      hasCommissionerAccess,
    canAccessCommissioner:
      hasCommissionerAccess,
    canManageLeague:
      hasCommissionerAccess,
    canManageAccounts:
      role === "commissioner",
  };
}

export function canManagePlayerPicks(
  access: CloudAccessState,
  playerId: string,
): boolean {
  const normalizedPlayerId =
    playerId.trim();

  if (!normalizedPlayerId) {
    return false;
  }

  if (access.canManageAllPicks) {
    return true;
  }

  return (
    access.canManageOwnPicks &&
    access.linkedPlayerId ===
      normalizedPlayerId
  );
}
