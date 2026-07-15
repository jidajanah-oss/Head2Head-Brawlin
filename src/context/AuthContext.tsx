import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  type CloudAccountLink,
  type CloudAuthIdentity,
  type CloudAuthStatus,
  type CloudConnectionStatus,
} from "../engine";
import {
  loadCurrentAccountLink,
  verifyCloudConnection,
} from "../services/cloudAccountLinkService";
import {
  getSupabaseAuthRedirectUrl,
  supabaseClient,
  supabaseConfiguration,
} from "../services/supabaseClient";

type AuthContextValue = {
  status: CloudAuthStatus;
  connectionStatus: CloudConnectionStatus;
  configured: boolean;
  missingConfiguration: string[];
  session: Session | null;
  user: User | null;
  identity: CloudAuthIdentity | null;
  accountLink: CloudAccountLink | null;
  access: CloudAccessState;
  errorMessage: string | null;
  connectionErrorMessage: string | null;
  magicLinkSentTo: string | null;
  sendMagicLink: (
    email: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshAccountLink: () => Promise<void>;
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

function getStatusForAccount(
  session: Session | null,
  accountLink: CloudAccountLink | null,
): CloudAuthStatus {
  if (!session) {
    return "signed-out";
  }

  return accountLink
    ? "signed-in-linked"
    : "signed-in-unlinked";
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);
  const [accountLink, setAccountLink] =
    useState<CloudAccountLink | null>(null);
  const [status, setStatus] =
    useState<CloudAuthStatus>(
      supabaseConfiguration.configured
        ? "loading"
        : "disabled",
    );
  const [connectionStatus, setConnectionStatus] =
    useState<CloudConnectionStatus>(
      supabaseConfiguration.configured
        ? "checking"
        : "disabled",
    );
  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);
  const [
    connectionErrorMessage,
    setConnectionErrorMessage,
  ] = useState<string | null>(null);
  const [
    magicLinkSentTo,
    setMagicLinkSentTo,
  ] = useState<string | null>(null);
  const sessionSyncRequestId = useRef(0);

  const synchronizeSession = useCallback(
    async (
      nextSession: Session | null,
    ) => {
      const client = supabaseClient;
      const requestId =
        sessionSyncRequestId.current + 1;
      sessionSyncRequestId.current = requestId;

      setSession(nextSession);
      setErrorMessage(null);

      if (!client || !nextSession) {
        setAccountLink(null);
        setStatus(
          client
            ? "signed-out"
            : "disabled",
        );
        return;
      }

      setStatus("loading");

      try {
        const nextAccountLink =
          await loadCurrentAccountLink(client);

        if (
          requestId !==
          sessionSyncRequestId.current
        ) {
          return;
        }

        setAccountLink(nextAccountLink);
        setStatus(
          getStatusForAccount(
            nextSession,
            nextAccountLink,
          ),
        );
      } catch (error) {
        if (
          requestId !==
          sessionSyncRequestId.current
        ) {
          return;
        }

        setAccountLink(null);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the signed-in account.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    const client = supabaseClient;
    if (!client) {
      return;
    }

    let mounted = true;

    const checkConnection = async () => {
      try {
        await verifyCloudConnection(client);
        if (!mounted) {
          return;
        }

        setConnectionStatus("connected");
        setConnectionErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setConnectionStatus("error");
        setConnectionErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to reach Supabase.",
        );
      }
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.setTimeout(() => {
          if (mounted) {
            void synchronizeSession(
              nextSession,
            );
          }
        }, 0);
      },
    );

    const loadSession = async () => {
      const { data, error } =
        await client.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      await synchronizeSession(
        data.session,
      );
    };

    void checkConnection();
    void loadSession();

    return () => {
      mounted = false;
      sessionSyncRequestId.current += 1;
      subscription.unsubscribe();
    };
  }, [synchronizeSession]);

  const user = session?.user ?? null;

  const identity = useMemo(
    () => getIdentity(user),
    [user],
  );

  const access = useMemo(
    () =>
      buildCloudAccessState(
        identity,
        accountLink,
      ),
    [identity, accountLink],
  );

  const refreshSession = async () => {
    const client = supabaseClient;
    if (!client) {
      return;
    }

    setErrorMessage(null);
    const { data, error } =
      await client.auth.getSession();

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    await synchronizeSession(
      data.session,
    );
  };

  const refreshAccountLink = async () => {
    await synchronizeSession(session);
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

    setMagicLinkSentTo(null);
    await synchronizeSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        connectionStatus,
        configured:
          supabaseConfiguration.configured,
        missingConfiguration:
          supabaseConfiguration
            .missingVariables,
        session,
        user,
        identity,
        accountLink,
        access,
        errorMessage,
        connectionErrorMessage,
        magicLinkSentTo,
        sendMagicLink,
        signOut,
        refreshSession,
        refreshAccountLink,
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
