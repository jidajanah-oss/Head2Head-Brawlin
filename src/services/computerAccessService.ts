import type { SupabaseClient } from "@supabase/supabase-js";

export type ComputerAccessStatus = {
  configured: boolean;
  enabled: boolean;
  username: string | null;
  lockedUntil: string | null;
  lastSuccessAt: string | null;
};

type ComputerLoginResponse = {
  ok: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  playerName: string;
};

type ComputerAccessStatusResponse = ComputerAccessStatus & {
  ok: true;
  playerName?: string;
  nflTeam?: string;
  replacedPreviousLogin?: boolean;
};

async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.clone().json() as unknown;

      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        return body.message;
      }
    } catch {
      // Fall through to the standard error message.
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function isComputerAccessStatus(
  value: unknown,
): value is ComputerAccessStatusResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    row.ok === true &&
    typeof row.configured === "boolean" &&
    typeof row.enabled === "boolean" &&
    (row.username === null || typeof row.username === "string") &&
    (row.lockedUntil === null || typeof row.lockedUntil === "string") &&
    (row.lastSuccessAt === null || typeof row.lastSuccessAt === "string")
  );
}

export async function signInWithComputerAccess(
  client: SupabaseClient,
  username: string,
  pin: string,
): Promise<ComputerLoginResponse> {
  const { data, error } = await client.functions.invoke(
    "computer-access",
    {
      body: {
        action: "login",
        username,
        pin,
      },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Unable to sign in with computer access.",
      ),
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    data.ok !== true ||
    typeof data.accessToken !== "string" ||
    typeof data.refreshToken !== "string" ||
    typeof data.expiresIn !== "number" ||
    typeof data.playerName !== "string"
  ) {
    throw new Error(
      "Computer-access service returned an invalid sign-in response.",
    );
  }

  return {
    ok: true,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    playerName: data.playerName,
  };
}

export async function loadComputerAccessStatus(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
): Promise<ComputerAccessStatus> {
  const { data, error } = await client.functions.invoke(
    "computer-access",
    {
      body: {
        action: "status",
        leagueId,
        playerId,
      },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Unable to load computer-access status.",
      ),
    );
  }

  if (!isComputerAccessStatus(data)) {
    throw new Error(
      "Computer-access service returned an invalid status response.",
    );
  }

  return {
    configured: data.configured,
    enabled: data.enabled,
    username: data.username,
    lockedUntil: data.lockedUntil,
    lastSuccessAt: data.lastSuccessAt,
  };
}

export async function configureComputerAccess(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
  username: string,
  pin: string,
): Promise<ComputerAccessStatusResponse> {
  const { data, error } = await client.functions.invoke(
    "computer-access",
    {
      body: {
        action: "configure",
        leagueId,
        playerId,
        username,
        pin,
      },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Unable to configure computer access.",
      ),
    );
  }

  if (!isComputerAccessStatus(data)) {
    throw new Error(
      "Computer-access service returned an invalid configuration response.",
    );
  }

  return data;
}

export async function disableComputerAccess(
  client: SupabaseClient,
  leagueId: string,
  playerId: string,
): Promise<ComputerAccessStatus> {
  const { data, error } = await client.functions.invoke(
    "computer-access",
    {
      body: {
        action: "disable",
        leagueId,
        playerId,
      },
    },
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Unable to disable computer access.",
      ),
    );
  }

  if (!isComputerAccessStatus(data)) {
    throw new Error(
      "Computer-access service returned an invalid disable response.",
    );
  }

  return {
    configured: data.configured,
    enabled: data.enabled,
    username: data.username,
    lockedUntil: data.lockedUntil,
    lastSuccessAt: data.lastSuccessAt,
  };
}
