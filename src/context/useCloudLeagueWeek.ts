import { readWithDeadline } from "../services/liveReadRefresh";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabaseClient } from "../services/supabaseClient";
import { loadCloudLeagueWeek, saveCloudLeagueWeek } from "../services/cloudLeagueWeekService";
import { createLeagueWeekSync, type LeagueWeekSyncState } from "../services/leagueWeekSync";

export function useCloudLeagueWeek(season: number, apply: (week: number) => void) {
  const { status, access } = useAuth();
  const link = access.accountLink;
  const leagueId = link?.leagueId;
  const userId = link?.userId;
  const canManage = access.canManageLeague;
  const key = status === "signed-in-linked" && leagueId && userId
    ? JSON.stringify([userId, leagueId, season, canManage]) : null;
  const [snapshot, setSnapshot] = useState<LeagueWeekSyncState & { key: string | null }>({
    key: null, hydrated: false, saving: false, error: null,
  });
  const active = useRef<{ key: string; sync: ReturnType<typeof createLeagueWeekSync> } | null>(null);

  useEffect(() => {
    const client = supabaseClient;
    if (!key || !leagueId || !client) return;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const sync = createLeagueWeekSync({
      load: () => readWithDeadline(() => loadCloudLeagueWeek(client, leagueId, season)),
      save: (expected, week) => saveCloudLeagueWeek(client, leagueId, season, expected, week),
      apply,
      canManage,
      publish: (state) => {
        setSnapshot({ ...state, key });
        clearTimeout(retryTimer);
        if (state.error && !state.saving) retryTimer = setTimeout(() => { void sync.refresh(); }, 2_000);
      },
    });
    active.current = { key, sync };
    setSnapshot({ key, hydrated: false, saving: false, error: null });
    const refresh = () => { void sync.refresh(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    // Polling works even when leagues is not in the Supabase Realtime publication.
    const timer = window.setInterval(visible, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      sync.dispose();
      clearTimeout(retryTimer);
      active.current = null;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key, leagueId, season, canManage, apply]);

  const matching = key !== null && snapshot.key === key;
  const ready = matching && snapshot.hydrated;
  return {
    loading: status === "loading" || (key !== null && !ready),
    error: matching ? snapshot.error : null,
    saving: matching && snapshot.saving,
    canChange: ready && canManage && !snapshot.saving,
    change: (week: number) => {
      if (active.current?.key === key) void active.current.sync.change(week);
    },
    refresh: () => {
      if (active.current?.key === key) void active.current.sync.refresh();
    },
  };
}
