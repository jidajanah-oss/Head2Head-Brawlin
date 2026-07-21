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
  emailCodeSentTo: string | null;
  sendEmailCode: (
    email: string,
  ) => Promise<void>;
  verifyEmailCode: (
    email: string,
    code: string,
  ) => Promise<void>;
  clearEmailCodeRequest: () => void;
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

function normalizeEmailCode(
  code: string,
): string {
  return code.replace(/\D/g, "");
}

function getEmailCodeErrorMessage(
  message: string,
): string {
  const normalizedMessage =
    message.trim().toLowerCase();

  if (
    normalizedMessage.includes(
      "token has expired",
    ) ||
    normalizedMessage.includes(
      "otp_expired",
    )
  ) {
    return "That sign-in code expired. Request a new code and try again.";
  }

  if (
    normalizedMessage.includes(
      "invalid token",
    ) ||
    normalizedMessage.includes(
      "invalid otp",
    ) ||
    normalizedMessage.includes(
      "token is invalid",
    )
  ) {
    return "That sign-in code is not valid. Check the email and enter the newest code.";
  }

  if (
    normalizedMessage.includes(
      "rate limit",
    ) ||
    normalizedMessage.includes(
      "email rate limit",
    )
  ) {
    return "Too many sign-in emails were requested. Wait a moment before requesting another code.";
  }

  return message.trim() ||
    "Unable to complete email-code sign-in.";
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
    emailCodeSentTo,
    setEmailCodeSentTo,
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

  const sendEmailCode = async (
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
    setEmailCodeSentTo(null);

    const { error } =
      await client.auth.signInWithOtp(
        {
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
          },
        },
      );

    if (error) {
      const nextMessage =
        getEmailCodeErrorMessage(
          error.message,
        );
      setErrorMessage(nextMessage);
      throw new Error(nextMessage);
    }

    setEmailCodeSentTo(
      normalizedEmail,
    );
  };

  const verifyEmailCode = async (
    email: string,
    code: string,
  ) => {
    const client = supabaseClient;
    if (!client) {
      throw new Error(
        "Supabase authentication is not configured.",
      );
    }

    const normalizedEmail =
      normalizeAuthEmail(email);
    const normalizedCode =
      normalizeEmailCode(code);

    if (
      !isValidAuthEmail(
        normalizedEmail,
      )
    ) {
      throw new Error(
        "Enter a valid email address.",
      );
    }

    if (!/^\d{6,10}$/.test(normalizedCode)) {
      throw new Error(
        "Enter the complete sign-in code from your email.",
      );
    }

    setErrorMessage(null);

    const {
      data,
      error,
    } = await client.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: "email",
    });

    if (error) {
      const nextMessage =
        getEmailCodeErrorMessage(
          error.message,
        );
      setErrorMessage(nextMessage);
      throw new Error(nextMessage);
    }

    if (!data.session) {
      const nextMessage =
        "The code was accepted, but no app session was created. Request a new code and try again.";
      setErrorMessage(nextMessage);
      throw new Error(nextMessage);
    }

    setEmailCodeSentTo(null);
    await synchronizeSession(
      data.session,
    );
  };

  const clearEmailCodeRequest = () => {
    setEmailCodeSentTo(null);
    setErrorMessage(null);
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

    setEmailCodeSentTo(null);
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
        emailCodeSentTo,
        sendEmailCode,
        verifyEmailCode,
        clearEmailCodeRequest,
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

