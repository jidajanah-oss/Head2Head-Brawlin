import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  buildCloudAccessState,
  isValidAuthEmail,
  normalizeAuthEmail,
  type CloudAccessState,
  type CloudAuthIdentity,
  type CloudAuthStatus,
} from "../engine";
import {
  getSupabaseAuthRedirectUrl,
  supabaseClient,
  supabaseConfiguration,
} from "../services/supabaseClient";

type AuthContextValue = {
  status: CloudAuthStatus;
  configured: boolean;
  missingConfiguration: string[];
  session: Session | null;
  user: User | null;
  identity: CloudAuthIdentity | null;
  access: CloudAccessState;
  errorMessage: string | null;
  magicLinkSentTo: string | null;
  sendMagicLink: (
    email: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

function getIdentity(
  user: User | null,
): CloudAuthIdentity | null {
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: normalizeAuthEmail(
      user.email ?? "",
    ),
  };
}

function getStatusForSession(
  session: Session | null,
): CloudAuthStatus {
  return session
    ? "signed-in-unlinked"
    : "signed-out";
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [status, setStatus] =
    useState<CloudAuthStatus>(
      supabaseConfiguration.configured
        ? "loading"
        : "disabled",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    magicLinkSentTo,
    setMagicLinkSentTo,
  ] = useState<string | null>(null);

  useEffect(() => {
    const client = supabaseClient;

    if (!client) {
      return;
    }

    let mounted = true;

    const {
      data: { subscription },
    } =
      client.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!mounted) {
            return;
          }

          setSession(nextSession);
          setStatus(
            getStatusForSession(
              nextSession,
            ),
          );
          setErrorMessage(null);
        },
      );

    const loadSession = async () => {
      const {
        data,
        error,
      } =
        await client.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      setSession(data.session);
      setStatus(
        getStatusForSession(
          data.session,
        ),
      );
    };

    void loadSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  const identity = useMemo(
    () => getIdentity(user),
    [user],
  );

  const access = useMemo(
    () =>
      buildCloudAccessState(
        identity,
        null,
      ),
    [identity],
  );

  const refreshSession = async () => {
    const client = supabaseClient;

    if (!client) {
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    const {
      data,
      error,
    } =
      await client.auth.getSession();

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setSession(data.session);
    setStatus(
      getStatusForSession(
        data.session,
      ),
    );
  };

  const sendMagicLink = async (
    email: string,
  ) => {
    const client = supabaseClient;

    if (!client) {
      throw new Error(
        "Supabase authentication is not configured.",
      );
    }

    const normalizedEmail =
      normalizeAuthEmail(email);

    if (
      !isValidAuthEmail(
        normalizedEmail,
      )
    ) {
      throw new Error(
        "Enter a valid email address.",
      );
    }

    setErrorMessage(null);
    setMagicLinkSentTo(null);

    const { error } =
      await client.auth.signInWithOtp(
        {
          email: normalizedEmail,
          options: {
            emailRedirectTo:
              getSupabaseAuthRedirectUrl(),
            shouldCreateUser: false,
          },
        },
      );

    if (error) {
      setErrorMessage(error.message);
      throw error;
    }

    setMagicLinkSentTo(
      normalizedEmail,
    );
  };

  const signOut = async () => {
    const client = supabaseClient;

    if (!client) {
      return;
    }

    setErrorMessage(null);

    const { error } =
      await client.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      throw error;
    }

    setSession(null);
    setMagicLinkSentTo(null);
    setStatus("signed-out");
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        configured:
          supabaseConfiguration.configured,
        missingConfiguration:
          supabaseConfiguration
            .missingVariables,
        session,
        user,
        identity,
        access,
        errorMessage,
        magicLinkSentTo,
        sendMagicLink,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return context;
}
