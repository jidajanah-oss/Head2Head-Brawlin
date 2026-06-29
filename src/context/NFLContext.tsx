import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { NFLService, type NFLWeekSnapshot } from "../engine";

interface NFLContextValue {
  season: number;
  week: number;
  snapshot: NFLWeekSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setWeek: (week: number) => void;
  setSeason: (season: number) => void;
}

const NFLContext = createContext<NFLContextValue | null>(null);

interface NFLProviderProps {
  children: ReactNode;
  initialSeason?: number;
  initialWeek?: number;
  pollingMs?: number;
}

export function NFLProvider({
  children,
  initialSeason = 2026,
  initialWeek = 1,
  pollingMs = 30_000,
}: NFLProviderProps) {
  const [season, setSeason] = useState(initialSeason);
  const [week, setWeek] = useState(initialWeek);
  const [snapshot, setSnapshot] = useState<NFLWeekSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextSnapshot = await NFLService.loadWeek(season, week);
      setSnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load NFL data");
    } finally {
      setLoading(false);
    }
  }, [season, week]);

  useEffect(() => {
    void refresh();

    const timerId = setInterval(() => {
      void refresh();
    }, pollingMs);

    return () => {
      clearInterval(timerId);
    };
  }, [refresh, pollingMs]);

  const value = useMemo<NFLContextValue>(
    () => ({
      season,
      week,
      snapshot,
      loading,
      error,
      refresh,
      setWeek,
      setSeason,
    }),
    [season, week, snapshot, loading, error, refresh]
  );

  return <NFLContext.Provider value={value}>{children}</NFLContext.Provider>;
}

export function useNFL() {
  const context = useContext(NFLContext);

  if (!context) {
    throw new Error("useNFL must be used inside NFLProvider");
  }

  return context;
}