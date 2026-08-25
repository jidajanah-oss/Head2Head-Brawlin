import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const PRODUCTION_ORIGIN = "https://head2head.poolplayhub.com";

const ALLOWED_ORIGINS = new Set([
  "https://head2head.poolplayhub.com",
  "https://jidajanah-oss.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type LoginRequest = {
  action: "login";
  username: string;
  pin: string;
};

type StatusRequest = {
  action: "status";
  leagueId: string;
  playerId: string;
};

type ConfigureRequest = {
  action: "configure";
  leagueId: string;
  playerId: string;
  username: string;
  pin: string;
};

type DisableRequest = {
  action: "disable";
  leagueId: string;
  playerId: string;
};

type ComputerAccessRequest =
  | LoginRequest
  | StatusRequest
  | ConfigureRequest
  | DisableRequest;

type ComputerAccessRow = {
  id: string;
  league_id: string;
  player_id: string;
  username: string;
  auth_user_id: string;
  auth_email: string;
  enabled: boolean;
  failed_attempts: number;
  locked_until: string | null;
  last_failed_at: string | null;
  last_success_at: string | null;
};

type PlayerRow = {
  player_id: string;
  display_name: string;
  nfl_team: string;
  role: string;
  status: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
  });
}

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin") ?? "";

  if (!origin) {
    return PRODUCTION_ORIGIN;
  }

  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function getDefaultKey(
  dictionaryName: string,
  legacyName: string,
): string {
  const dictionaryValue = Deno.env.get(dictionaryName);

  if (dictionaryValue) {
    try {
      const parsed = JSON.parse(dictionaryValue) as Record<string, unknown>;
      const defaultValue = parsed.default;

      if (typeof defaultValue === "string" && defaultValue) {
        return defaultValue;
      }

      const firstValue = Object.values(parsed).find(
        (value): value is string =>
          typeof value === "string" && Boolean(value),
      );

      if (firstValue) {
        return firstValue;
      }
    } catch {
      // Fall through to the legacy environment variable.
    }
  }

  return Deno.env.get(legacyName) ?? "";
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9 ._-]{0,38}[a-z0-9]$/i.test(value) ||
    /^[a-z0-9]{2}$/i.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}

function isRequest(value: unknown): value is ComputerAccessRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  if (row.action === "login") {
    return typeof row.username === "string" && typeof row.pin === "string";
  }

  if (row.action === "status" || row.action === "disable") {
    return typeof row.leagueId === "string" && typeof row.playerId === "string";
  }

  if (row.action === "configure") {
    return (
      typeof row.leagueId === "string" &&
      typeof row.playerId === "string" &&
      typeof row.username === "string" &&
      typeof row.pin === "string"
    );
  }

  return false;
}

function isComputerAccessRow(value: unknown): value is ComputerAccessRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.league_id === "string" &&
    typeof row.player_id === "string" &&
    typeof row.username === "string" &&
    typeof row.auth_user_id === "string" &&
    typeof row.auth_email === "string" &&
    typeof row.enabled === "boolean" &&
    typeof row.failed_attempts === "number" &&
    (row.locked_until === null || typeof row.locked_until === "string") &&
    (row.last_failed_at === null || typeof row.last_failed_at === "string") &&
    (row.last_success_at === null || typeof row.last_success_at === "string")
  );
}

function getSafeStatus(row: ComputerAccessRow | null) {
  return row
    ? {
        configured: true,
        enabled: row.enabled,
        username: row.username,
        lockedUntil: row.locked_until,
        lastSuccessAt: row.last_success_at,
      }
    : {
        configured: false,
        enabled: false,
        username: null,
        lockedUntil: null,
        lastSuccessAt: null,
      };
}

async function deriveAuthPassword(
  pin: string,
  row: {
    leagueId: string;
    playerId: string;
    username: string;
  },
  secretKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const source = encoder.encode(
    [
      "head2head-computer-access-v1",
      row.leagueId,
      row.playerId,
      row.username,
      pin,
      secretKey,
    ].join("|"),
  );

  const digest = await crypto.subtle.digest("SHA-256", source);
  const bytes = Array.from(new Uint8Array(digest));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `H2H!${base64}`;
}

function buildAuthEmail(leagueId: string, playerId: string): string {
  const leaguePart = leagueId.replace(/-/g, "").slice(0, 12);
  const playerPart = playerId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `computer-${leaguePart}-${playerPart}@head2head.invalid`;
}

async function getPrimaryCommissionerUserId(
  request: Request,
  supabaseUrl: string,
  publishableKey: string,
  leagueId: string,
): Promise<{ userId: string } | { error: string; status: number }> {
  const authorization = request.headers.get("Authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return { error: "Primary commissioner sign-in is required.", status: 401 };
  }

  const token = authorization.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "The commissioner session is invalid.", status: 401 };
  }

  const { data: canManage, error: manageError } = await userClient.rpc(
    "can_manage_accounts",
    { target_league_id: leagueId },
  );

  if (manageError || canManage !== true) {
    return { error: "Only the primary commissioner can manage computer access.", status: 403 };
  }

  return { userId: userData.user.id };
}

async function loadPlayer(
  adminClient: ReturnType<typeof createClient>,
  leagueId: string,
  playerId: string,
): Promise<PlayerRow | null> {
  const { data, error } = await adminClient
    .from("league_players")
    .select("player_id,display_name,nfl_team,role,status")
    .eq("league_id", leagueId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as PlayerRow;
}

async function loadCredentialByPlayer(
  adminClient: ReturnType<typeof createClient>,
  leagueId: string,
  playerId: string,
): Promise<ComputerAccessRow | null> {
  const { data, error } = await adminClient
    .from("computer_access_accounts")
    .select(
      "id,league_id,player_id,username,auth_user_id,auth_email,enabled,failed_attempts,locked_until,last_failed_at,last_success_at",
    )
    .eq("league_id", leagueId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data && isComputerAccessRow(data) ? data : null;
}

async function loadCredentialByUsername(
  adminClient: ReturnType<typeof createClient>,
  username: string,
): Promise<ComputerAccessRow | null> {
  const { data, error } = await adminClient
    .from("computer_access_accounts")
    .select(
      "id,league_id,player_id,username,auth_user_id,auth_email,enabled,failed_attempts,locked_until,last_failed_at,last_success_at",
    )
    .eq("username", username)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data && isComputerAccessRow(data) ? data : null;
}

Deno.serve(async (request: Request) => {
  const origin = getAllowedOrigin(request);

  if (!origin) {
    return jsonResponse({ ok: false, message: "Origin is not allowed." }, 403, PRODUCTION_ORIGIN);
  }

  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed." }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse(
      { ok: false, message: "Computer access is not configured on the server." },
      500,
      origin,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Request body must be valid JSON." }, 400, origin);
  }

  if (!isRequest(body)) {
    return jsonResponse({ ok: false, message: "Invalid computer-access request." }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (body.action === "login") {
    const username = normalizeUsername(body.username);
    const pin = body.pin.replace(/\D/g, "");

    if (!isValidUsername(username) || !isPin(pin)) {
      return jsonResponse({ ok: false, message: "Player name or PIN is incorrect." }, 401, origin);
    }

    let credential: ComputerAccessRow | null;

    try {
      credential = await loadCredentialByUsername(adminClient, username);
    } catch {
      return jsonResponse({ ok: false, message: "Computer access is temporarily unavailable." }, 503, origin);
    }

    if (!credential) {
      return jsonResponse({ ok: false, message: "Player name or PIN is incorrect." }, 401, origin);
    }

    const now = Date.now();
    const lockedUntil = credential.locked_until
      ? new Date(credential.locked_until).getTime()
      : 0;

    if (lockedUntil > now) {
      return jsonResponse(
        {
          ok: false,
          message: "Computer access is temporarily locked after too many incorrect PIN attempts. Try again later.",
        },
        429,
        origin,
      );
    }

    const player = await loadPlayer(adminClient, credential.league_id, credential.player_id);

    if (!player || player.status !== "active") {
      return jsonResponse({ ok: false, message: "Computer access is not active for this player." }, 403, origin);
    }

    const { data: activeLink } = await adminClient
      .from("account_links")
      .select("id,user_id")
      .eq("league_id", credential.league_id)
      .eq("player_id", credential.player_id)
      .eq("active", true)
      .maybeSingle();

    if (!activeLink || activeLink.user_id !== credential.auth_user_id) {
      return jsonResponse({ ok: false, message: "Computer access is not active for this player." }, 403, origin);
    }

    const effectiveAttempts = lockedUntil && lockedUntil <= now ? 0 : credential.failed_attempts;
    const password = await deriveAuthPassword(
      pin,
      {
        leagueId: credential.league_id,
        playerId: credential.player_id,
        username: credential.username,
      },
      secretKey,
    );

    const signInClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
      email: credential.auth_email,
      password,
    });

    if (signInError || !signInData.session) {
      const nextAttempts = effectiveAttempts + 1;
      const nextLockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
        : null;

      await adminClient
        .from("computer_access_accounts")
        .update({
          failed_attempts: nextAttempts,
          locked_until: nextLockedUntil,
          last_failed_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", credential.id);

      return jsonResponse(
        {
          ok: false,
          message: nextLockedUntil
            ? "Computer access is temporarily locked after too many incorrect PIN attempts. Try again in 15 minutes."
            : "Player name or PIN is incorrect.",
        },
        nextLockedUntil ? 429 : 401,
        origin,
      );
    }

    await adminClient
      .from("computer_access_accounts")
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_success_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", credential.id);

    return jsonResponse(
      {
        ok: true,
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        expiresIn: signInData.session.expires_in,
        playerName: player.display_name,
      },
      200,
      origin,
    );
  }

  if (!isUuid(body.leagueId) || !body.playerId.trim()) {
    return jsonResponse({ ok: false, message: "A valid league and player are required." }, 400, origin);
  }

  const commissioner = await getPrimaryCommissionerUserId(
    request,
    supabaseUrl,
    publishableKey,
    body.leagueId,
  );

  if ("error" in commissioner) {
    return jsonResponse({ ok: false, message: commissioner.error }, commissioner.status, origin);
  }

  const player = await loadPlayer(adminClient, body.leagueId, body.playerId);

  if (!player || player.status !== "active") {
    return jsonResponse({ ok: false, message: "The selected active player was not found." }, 404, origin);
  }

  if (player.role === "commissioner") {
    return jsonResponse({ ok: false, message: "The primary commissioner account cannot be converted to computer PIN access." }, 409, origin);
  }

  if (body.action === "status") {
    try {
      const credential = await loadCredentialByPlayer(adminClient, body.leagueId, body.playerId);
      return jsonResponse({ ok: true, ...getSafeStatus(credential) }, 200, origin);
    } catch {
      return jsonResponse({ ok: false, message: "Unable to load computer-access status." }, 500, origin);
    }
  }

  if (body.action === "disable") {
    let credential: ComputerAccessRow | null;

    try {
      credential = await loadCredentialByPlayer(adminClient, body.leagueId, body.playerId);
    } catch {
      return jsonResponse({ ok: false, message: "Unable to load computer-access status." }, 500, origin);
    }

    if (!credential) {
      return jsonResponse({ ok: true, ...getSafeStatus(null) }, 200, origin);
    }

    const nowIso = new Date().toISOString();

    const { error: disableError } = await adminClient
      .from("computer_access_accounts")
      .update({
        enabled: false,
        failed_attempts: 0,
        locked_until: null,
        updated_by: commissioner.userId,
        updated_at: nowIso,
      })
      .eq("id", credential.id);

    if (disableError) {
      return jsonResponse({ ok: false, message: "Unable to disable computer access." }, 500, origin);
    }

    await adminClient
      .from("account_links")
      .update({ active: false, updated_at: nowIso })
      .eq("league_id", body.leagueId)
      .eq("player_id", body.playerId)
      .eq("user_id", credential.auth_user_id)
      .eq("active", true);

    return jsonResponse(
      {
        ok: true,
        configured: true,
        enabled: false,
        username: credential.username,
        lockedUntil: null,
        lastSuccessAt: credential.last_success_at,
      },
      200,
      origin,
    );
  }

  const username = normalizeUsername(body.username);
  const pin = body.pin.replace(/\D/g, "");

  if (!isValidUsername(username)) {
    return jsonResponse(
      { ok: false, message: "Computer login name must be 2-40 letters/numbers and may include spaces, periods, dashes, or underscores." },
      400,
      origin,
    );
  }

  if (!isPin(pin)) {
    return jsonResponse({ ok: false, message: "Computer access requires exactly a 6-digit PIN." }, 400, origin);
  }

  let credential: ComputerAccessRow | null;

  try {
    credential = await loadCredentialByPlayer(adminClient, body.leagueId, body.playerId);
  } catch {
    return jsonResponse({ ok: false, message: "Unable to load computer-access status." }, 500, origin);
  }

  const { data: usernameOwner, error: usernameOwnerError } = await adminClient
    .from("computer_access_accounts")
    .select("league_id,player_id")
    .eq("username", username)
    .maybeSingle();

  if (usernameOwnerError) {
    return jsonResponse({ ok: false, message: "Unable to validate the computer login name." }, 500, origin);
  }

  if (
    usernameOwner &&
    (usernameOwner.league_id !== body.leagueId ||
      usernameOwner.player_id !== body.playerId)
  ) {
    return jsonResponse({ ok: false, message: "That computer login name is already assigned to another player." }, 409, origin);
  }

  const authEmail = credential?.auth_email ?? buildAuthEmail(body.leagueId, body.playerId);
  const password = await deriveAuthPassword(
    pin,
    {
      leagueId: body.leagueId,
      playerId: body.playerId,
      username,
    },
    secretKey,
  );

  let authUserId = credential?.auth_user_id ?? null;

  if (authUserId) {
    const { error: updateUserError } = await adminClient.auth.admin.updateUserById(authUserId, {
      email: authEmail,
      password,
      email_confirm: true,
      app_metadata: {
        auth_method: "computer_pin",
        computer_username: username,
        league_id: body.leagueId,
        player_id: body.playerId,
      },
    });

    if (updateUserError) {
      return jsonResponse({ ok: false, message: `Unable to update the computer-access login: ${updateUserError.message}` }, 500, origin);
    }
  } else {
    const { data: usersData, error: listUsersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listUsersError) {
      return jsonResponse({ ok: false, message: "Unable to check the authentication directory." }, 500, origin);
    }

    const existingUser = usersData.users.find(
      (user: { id: string; email?: string | null }) =>
        user.email?.toLowerCase() === authEmail.toLowerCase(),
    );

    if (existingUser) {
      authUserId = existingUser.id;
      const { error: updateExistingError } = await adminClient.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        app_metadata: {
          auth_method: "computer_pin",
          computer_username: username,
          league_id: body.leagueId,
          player_id: body.playerId,
        },
      });

      if (updateExistingError) {
        return jsonResponse({ ok: false, message: "Unable to prepare the existing computer-access login." }, 500, origin);
      }
    } else {
      const { data: createUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: {
          auth_method: "computer_pin",
          computer_username: username,
          league_id: body.leagueId,
          player_id: body.playerId,
        },
      });

      if (createUserError || !createUserData.user) {
        return jsonResponse(
          {
            ok: false,
            message: `Unable to create the computer-access login: ${createUserError?.message ?? "No user was created."}`,
          },
          500,
          origin,
        );
      }

      authUserId = createUserData.user.id;
    }
  }

  if (!authUserId) {
    return jsonResponse({ ok: false, message: "Unable to prepare the computer-access identity." }, 500, origin);
  }

  const nowIso = new Date().toISOString();

  if (credential) {
    const { error: credentialUpdateError } = await adminClient
      .from("computer_access_accounts")
      .update({
        username,
        auth_user_id: authUserId,
        auth_email: authEmail,
        enabled: false,
        failed_attempts: 0,
        locked_until: null,
        last_failed_at: null,
        last_pin_reset_at: nowIso,
        updated_by: commissioner.userId,
        updated_at: nowIso,
      })
      .eq("id", credential.id);

    if (credentialUpdateError) {
      const message = credentialUpdateError.code === "23505"
        ? "That computer login name is already assigned to another player."
        : "Unable to save the computer-access account.";
      return jsonResponse({ ok: false, message }, 409, origin);
    }
  } else {
    const { error: credentialInsertError } = await adminClient
      .from("computer_access_accounts")
      .insert({
        league_id: body.leagueId,
        player_id: body.playerId,
        username,
        auth_user_id: authUserId,
        auth_email: authEmail,
        enabled: false,
        failed_attempts: 0,
        locked_until: null,
        last_pin_reset_at: nowIso,
        created_by: commissioner.userId,
        updated_by: commissioner.userId,
        created_at: nowIso,
        updated_at: nowIso,
      });

    if (credentialInsertError) {
      const message = credentialInsertError.code === "23505"
        ? "That computer login name is already assigned to another player."
        : "Unable to save the computer-access account.";
      return jsonResponse({ ok: false, message }, 409, origin);
    }
  }

  const { data: activeTargetLink, error: targetLinkError } = await adminClient
    .from("account_links")
    .select("id,user_id,login_email")
    .eq("league_id", body.leagueId)
    .eq("player_id", body.playerId)
    .eq("active", true)
    .maybeSingle();

  if (targetLinkError) {
    return jsonResponse({ ok: false, message: "Unable to inspect the player's current login link." }, 500, origin);
  }

  const { data: activeComputerLinks, error: computerLinkError } = await adminClient
    .from("account_links")
    .select("id,league_id,player_id")
    .eq("user_id", authUserId)
    .eq("active", true);

  if (computerLinkError) {
    return jsonResponse({ ok: false, message: "Unable to inspect the computer-access account link." }, 500, origin);
  }

  const conflictingComputerLink = (activeComputerLinks ?? []).find(
    (link: { league_id: string; player_id: string }) =>
      link.league_id !== body.leagueId || link.player_id !== body.playerId,
  );

  if (conflictingComputerLink) {
    return jsonResponse({ ok: false, message: "This computer-access identity is already linked to another player." }, 409, origin);
  }

  let retiredLinkId: string | null = null;

  if (activeTargetLink && activeTargetLink.user_id !== authUserId) {
    retiredLinkId = activeTargetLink.id;
    const { error: retireError } = await adminClient
      .from("account_links")
      .update({ active: false, updated_at: nowIso })
      .eq("id", retiredLinkId);

    if (retireError) {
      return jsonResponse({ ok: false, message: "Unable to retire the previous email login link." }, 500, origin);
    }
  }

  await adminClient
    .from("account_link_invitations")
    .update({ status: "revoked", updated_at: nowIso })
    .eq("league_id", body.leagueId)
    .eq("player_id", body.playerId)
    .eq("status", "pending");

  const { data: existingComputerLink } = await adminClient
    .from("account_links")
    .select("id")
    .eq("league_id", body.leagueId)
    .eq("player_id", body.playerId)
    .eq("user_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let linkError: { message: string } | null = null;

  if (existingComputerLink?.id) {
    const { error } = await adminClient
      .from("account_links")
      .update({
        login_email: authEmail,
        active: true,
        linked_by: commissioner.userId,
        linked_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", existingComputerLink.id);
    linkError = error;
  } else {
    const { error } = await adminClient
      .from("account_links")
      .insert({
        league_id: body.leagueId,
        player_id: body.playerId,
        user_id: authUserId,
        login_email: authEmail,
        active: true,
        linked_by: commissioner.userId,
        linked_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
    linkError = error;
  }

  if (linkError) {
    if (retiredLinkId) {
      await adminClient
        .from("account_links")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", retiredLinkId);
    }

    return jsonResponse({ ok: false, message: `Unable to connect the computer-access login: ${linkError.message}` }, 500, origin);
  }

  const { error: enableError } = await adminClient
    .from("computer_access_accounts")
    .update({
      enabled: true,
      failed_attempts: 0,
      locked_until: null,
      updated_by: commissioner.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("league_id", body.leagueId)
    .eq("player_id", body.playerId);

  if (enableError) {
    await adminClient
      .from("account_links")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("league_id", body.leagueId)
      .eq("player_id", body.playerId)
      .eq("user_id", authUserId)
      .eq("active", true);

    if (retiredLinkId) {
      await adminClient
        .from("account_links")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", retiredLinkId);
    }

    return jsonResponse({ ok: false, message: "Computer access could not be finalized; the previous login was restored." }, 500, origin);
  }

  const finalCredential = await loadCredentialByPlayer(adminClient, body.leagueId, body.playerId);

  return jsonResponse(
    {
      ok: true,
      ...getSafeStatus(finalCredential),
      playerName: player.display_name,
      nflTeam: player.nfl_team,
      replacedPreviousLogin: Boolean(activeTargetLink && activeTargetLink.user_id !== authUserId),
    },
    200,
    origin,
  );
});
