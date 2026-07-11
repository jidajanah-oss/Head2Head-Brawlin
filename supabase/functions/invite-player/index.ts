import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REDIRECT_URL =
  "https://jidajanah-oss.github.io/Head2Head-Brawlin/";
const PRODUCTION_ORIGIN = "https://jidajanah-oss.github.io";

const ALLOWED_ORIGINS = new Set([
  "https://jidajanah-oss.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

type InvitationRequest = {
  invitationId: string;
};

type InvitationRow = {
  id: string;
  league_id: string;
  player_id: string;
  email: string;
  status: string;
  expires_at: string | null;
  last_sent_at: string | null;
  send_count: number;
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
      const parsed = JSON.parse(dictionaryValue) as Record<
        string,
        unknown
      >;
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

function isInvitationRequest(
  value: unknown,
): value is InvitationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const invitationId = (value as Record<string, unknown>).invitationId;
  return (
    typeof invitationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      invitationId,
    )
  );
}

function isInvitationRow(value: unknown): value is InvitationRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.league_id === "string" &&
    typeof row.player_id === "string" &&
    typeof row.email === "string" &&
    typeof row.status === "string" &&
    (row.expires_at === null || typeof row.expires_at === "string") &&
    (row.last_sent_at === null || typeof row.last_sent_at === "string") &&
    typeof row.send_count === "number"
  );
}

Deno.serve(async (request: Request) => {
  const origin = getAllowedOrigin(request);

  if (!origin) {
    return jsonResponse(
      { ok: false, message: "Origin is not allowed." },
      403,
      PRODUCTION_ORIGIN,
    );
  }

  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, message: "Method not allowed." },
      405,
      origin,
    );
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse(
      { ok: false, message: "Authentication is required." },
      401,
      origin,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = getDefaultKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "SUPABASE_ANON_KEY",
  );
  const secretKey = getDefaultKey(
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse(
      {
        ok: false,
        message: "The invitation service is not configured.",
      },
      500,
      origin,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, message: "Request body must be valid JSON." },
      400,
      origin,
    );
  }

  if (!isInvitationRequest(requestBody)) {
    return jsonResponse(
      { ok: false, message: "A valid invitation ID is required." },
      400,
      origin,
    );
  }

  const token = authorization.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse(
      { ok: false, message: "The commissioner session is invalid." },
      401,
      origin,
    );
  }

  const { data: invitationData, error: invitationError } =
    await userClient
      .from("account_link_invitations")
      .select(
        "id,league_id,player_id,email,status,expires_at,last_sent_at,send_count",
      )
      .eq("id", requestBody.invitationId)
      .maybeSingle();

  if (invitationError) {
    return jsonResponse(
      {
        ok: false,
        message: "Unable to read the pending invitation.",
      },
      403,
      origin,
    );
  }

  if (!isInvitationRow(invitationData)) {
    return jsonResponse(
      { ok: false, message: "Pending invitation was not found." },
      404,
      origin,
    );
  }

  if (invitationData.status !== "pending") {
    return jsonResponse(
      { ok: false, message: "The invitation is no longer pending." },
      409,
      origin,
    );
  }

  if (
    invitationData.expires_at &&
    new Date(invitationData.expires_at).getTime() <= Date.now()
  ) {
    return jsonResponse(
      { ok: false, message: "The invitation has expired." },
      409,
      origin,
    );
  }

  if (invitationData.last_sent_at) {
    return jsonResponse(
      {
        ok: false,
        message:
          "This invitation email was already sent. Revoke it before preparing a new invitation.",
      },
      409,
      origin,
    );
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: existingUsers, error: existingUsersError } =
    await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (existingUsersError) {
    return jsonResponse(
      {
        ok: false,
        message: "Unable to check the Supabase user directory.",
      },
      500,
      origin,
    );
  }

  const normalizedEmail = invitationData.email.toLowerCase();
  const existingUser = existingUsers.users.some(
    (user: { email?: string | null }) =>
      user.email?.toLowerCase() === normalizedEmail,
  );

  if (existingUser) {
    return jsonResponse(
      {
        ok: true,
        status: "existing-user",
        message:
          "That Supabase account already exists. The player can use the Cloud Account sign-in form, and the pending invitation will link automatically after sign-in.",
      },
      200,
      origin,
    );
  }

  const { error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(
      invitationData.email,
      {
        redirectTo: PRODUCTION_REDIRECT_URL,
        data: {
          league_id: invitationData.league_id,
          player_id: invitationData.player_id,
        },
      },
    );

  if (inviteError) {
    return jsonResponse(
      {
        ok: false,
        message: `Supabase could not send the invitation: ${inviteError.message}`,
      },
      502,
      origin,
    );
  }

  const { error: updateError } = await adminClient
    .from("account_link_invitations")
    .update({
      last_sent_at: new Date().toISOString(),
      send_count: invitationData.send_count + 1,
    })
    .eq("id", invitationData.id)
    .eq("status", "pending");

  if (updateError) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The email was accepted by Supabase, but the invitation status could not be updated.",
      },
      500,
      origin,
    );
  }

  return jsonResponse(
    {
      ok: true,
      status: "sent",
      message: "Player invitation email sent successfully.",
    },
    200,
    origin,
  );
});