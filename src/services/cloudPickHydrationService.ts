import { useSyncExternalStore } from "react";

type Account = { userId: string; leagueId: string; playerId: string };
type Status = "loading" | "ready" | "error";
const states = new Map<string | null, Status>();
const listeners = new Set<() => void>();

export function getCloudPickHydrationKey(account: Account | null, season: number, week: number) {
  return account ? [account.userId, account.leagueId, account.playerId, season, week].join(":") : null;
}

export function publishCloudPickHydration(key: string | null, status: Status) {
  if (states.get(key) === status) return;
  states.set(key, status);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useCloudPickHydration(account: Account | null, season: number, week: number): Status {
  const key = getCloudPickHydrationKey(account, season, week);
  return useSyncExternalStore(subscribe,
    () => key ? states.get(key) ?? "loading" : "loading",
    () => "loading");
}
