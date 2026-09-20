// A read-only refresh lifecycle. Dispose before changing account/week so an old
// response can never replace the new target's data. Concurrent wakeups coalesce.
export function createLiveReadRefresh<T>(options: {
  load: () => Promise<T>;
  apply: (value: T) => void;
  error: (error: unknown) => void;
  loading?: (loading: boolean) => void;
  intervalMs: number;
  timeoutMs?: number;
}) {
  let disposed = false;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const refresh = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (running) return running;
    clearTimeout(timer);
    options.loading?.(true);
    running = (async () => {
      try {
        const value = await Promise.race([
          Promise.resolve().then(options.load),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(() => reject(new Error("Data refresh timed out. Retrying automatically.")), options.timeoutMs ?? 20_000);
          }),
        ]);
        if (!disposed) { failures = 0; options.apply(value); }
      } catch (error) {
        if (!disposed) { failures += 1; options.error(error); }
      } finally {
        clearTimeout(deadline);
        running = null;
        if (!disposed) {
          options.loading?.(false);
          timer = setTimeout(() => { void refresh(); }, failures
            ? Math.min(2_000 * 2 ** Math.min(failures - 1, 3), options.intervalMs)
            : options.intervalMs);
        }
      }
    })();
    return running;
  };
  return { refresh, dispose() { disposed = true; clearTimeout(timer); clearTimeout(deadline); } };
}

export function refreshOnReturn(refresh: () => Promise<void>) {
  const wake = () => { if (document.visibilityState !== "hidden") void refresh(); };
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", wake);
  return () => {
    window.removeEventListener("focus", wake);
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", wake);
  };
}

// Bound reads only; never retry a write whose outcome may be uncertain.
export async function readWithDeadline<T>(load: () => Promise<T>, timeoutMs = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Data refresh timed out. Please retry.")), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
