import { useSyncExternalStore } from "react";

type Account = { userId: string; leagueId: string; playerId: string };
type Status = "loading" | "ready" | "error";
const states = new Map<string | null, Status>();
const errors = new Map<string | null, string>();
const listeners = new Set<() => void>();

export function getCloudPickHydrationKey(account: Account | null, season: number, week: number) {
  return account ? [account.userId, account.leagueId, account.playerId, season, week].join(":") : null;
}

export function publishCloudPickHydration(key: string | null, status: Status, message = "") {
  const detail = status === "error" ? message : "";
  if (states.get(key) === status && (errors.get(key) ?? "") === detail) return;
  states.set(key, status);
  errors.set(key, detail);
  listeners.forEach(listener => listener());
}

export function useCloudPickHydrationError(account: Account | null, season: number, week: number): string {
  const key = getCloudPickHydrationKey(account, season, week);
  return useSyncExternalStore(subscribe, () => key ? errors.get(key) ?? "" : "", () => "");
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
