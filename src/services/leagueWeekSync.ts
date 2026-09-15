export type LeagueWeekSyncState = {
  hydrated: boolean;
  saving: boolean;
  error: string | null;
};

// One controller per signed-in account/league. It never writes during hydration.
export function createLeagueWeekSync(options: {
  load: () => Promise<number>;
  save: (expected: number, next: number) => Promise<number>;
  apply: (week: number) => void;
  publish: (state: LeagueWeekSyncState) => void;
  canManage: boolean;
}) {
  let disposed = false;
  let revision = 0;
  let reading = false;
  let currentWeek: number | null = null;
  let state: LeagueWeekSyncState = { hydrated: false, saving: false, error: null };
  const publish = (patch: Partial<LeagueWeekSyncState>) => {
    state = { ...state, ...patch };
    if (!disposed) options.publish(state);
  };
  const message = (error: unknown) => error instanceof Error ? error.message : "Unable to synchronize the league week.";

  const refresh = async () => {
    if (disposed || reading || state.saving) return;
    reading = true;
    const request = revision;
    try {
      const week = await options.load();
      if (disposed || request !== revision) return;
      currentWeek = week;
      options.apply(week);
      publish({ hydrated: true, error: null });
    } catch (error) {
      if (!disposed && request === revision) publish({ error: message(error) });
    } finally {
      reading = false;
    }
  };

  const change = async (week: number) => {
    if (disposed || state.saving || !state.hydrated || !options.canManage || currentWeek === null) return;
    if (!Number.isInteger(week) || week < 1 || week > 18) {
      publish({ error: "Select a regular-season week from 1 through 18." });
      return;
    }
    if (week === currentWeek) return;
    revision += 1;
    publish({ saving: true, error: null });
    try {
      const savedWeek = await options.save(currentWeek, week);
      if (disposed) return;
      currentWeek = savedWeek;
      options.apply(savedWeek);
      publish({ saving: false, error: null });
    } catch (error) {
      if (disposed) return;
      // Reconcile conflicts and ambiguous network failures without retrying the write.
      try {
        const week = await options.load();
        if (disposed) return;
        currentWeek = week;
        options.apply(week);
      } catch { /* Keep the last confirmed week and show the save failure. */ }
      if (!disposed) publish({ saving: false, error: message(error) });
    }
  };

  return { refresh, change, dispose: () => { disposed = true; revision += 1; } };
}
