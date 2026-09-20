import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { NFLService, type NFLWeekSnapshot } from "../engine";
import { createLiveReadRefresh, refreshOnReturn } from "../services/liveReadRefresh";

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
  const [loadedSnapshot, setSnapshot] = useState<NFLWeekSnapshot | null>(null);
  const snapshot = loadedSnapshot?.season === season && loadedSnapshot.week === week ? loadedSnapshot : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresher = useRef<ReturnType<typeof createLiveReadRefresh<NFLWeekSnapshot>> | null>(null);
  const refresh = useCallback(() => refresher.current?.refresh() ?? Promise.resolve(), []);

  useEffect(() => {
    setError(null);
    const reader = createLiveReadRefresh({
      load: () => NFLService.loadWeek(season, week),
      apply: (value) => { setSnapshot(value); setError(null); },
      error: (err) => setError(err instanceof Error ? err.message : "Unable to load NFL data"),
      loading: setLoading,
      intervalMs: pollingMs,
    });
    refresher.current = reader;
    const unsubscribe = refreshOnReturn(reader.refresh);
    void reader.refresh();
    return () => {
      unsubscribe();
      reader.dispose();
      if (refresher.current === reader) refresher.current = null;
    };
  }, [season, week, pollingMs]);

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
