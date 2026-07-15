import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export type SupabaseConfiguration = {
  configured: boolean;
  projectUrl: string;
  publishableKey: string;
  missingVariables: string[];
};

function normalizeEnvironmentValue(
  value: string | undefined,
): string {
  return value?.trim() ?? "";
}

function isValidProjectUrl(
  value: string,
): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getSupabaseConfiguration():
  SupabaseConfiguration {
  const projectUrl =
    normalizeEnvironmentValue(
      import.meta.env.VITE_SUPABASE_URL,
    );

  const publishableKey =
    normalizeEnvironmentValue(
      import.meta.env
        .VITE_SUPABASE_PUBLISHABLE_KEY,
    ) ||
    normalizeEnvironmentValue(
      import.meta.env
        .VITE_SUPABASE_ANON_KEY,
    );

  const missingVariables: string[] = [];

  if (!isValidProjectUrl(projectUrl)) {
    missingVariables.push(
      "VITE_SUPABASE_URL",
    );
  }

  if (!publishableKey) {
    missingVariables.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return {
    configured:
      missingVariables.length === 0,
    projectUrl,
    publishableKey,
    missingVariables,
  };
}

export const supabaseConfiguration =
  getSupabaseConfiguration();

export const supabaseClient:
  | SupabaseClient
  | null = supabaseConfiguration.configured
  ? createClient(
      supabaseConfiguration.projectUrl,
      supabaseConfiguration.publishableKey,
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          flowType: "pkce",
        },
      },
    )
  : null;

export function getSupabaseAuthRedirectUrl():
  string {
  const baseUrl =
    import.meta.env.BASE_URL?.trim() || "/";

  return new URL(
    baseUrl,
    window.location.origin,
  ).toString();
}
