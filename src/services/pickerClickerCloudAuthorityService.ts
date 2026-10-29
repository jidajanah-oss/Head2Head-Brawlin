import {
  useSyncExternalStore,
} from "react";
import type {
  CloudPickerClickerWeekAssignment,
} from "./cloudPickerClickerAssignmentService";

export type PickerClickerCloudAuthorityStatus =
  | "idle"
  | "syncing"
  | "waiting"
  | "ready"
  | "error";

export type PickerClickerCloudAuthorityState = {
  status:
    PickerClickerCloudAuthorityStatus;
  leagueId: string | null;
  season: number | null;
  week: number | null;
  assignment:
    CloudPickerClickerWeekAssignment | null;
  message: string;
};

const IDLE_STATE:
  PickerClickerCloudAuthorityState = {
    status: "idle",
    leagueId: null,
    season: null,
    week: null,
    assignment: null,
    message:
      "Weekly source synchronization has not started.",
  };

let currentState:
  PickerClickerCloudAuthorityState =
    IDLE_STATE;

const states = new Map<string, PickerClickerCloudAuthorityState>();
const authorityKey = (season: number | null, week: number | null, leagueId: string | null) => `${leagueId}:${season}:${week}`;

const listeners =
  new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function
publishPickerClickerCloudAuthority(
  state:
    PickerClickerCloudAuthorityState,
): void {
  states.set(authorityKey(state.season, state.week, state.leagueId), state);
  currentState = state;
  emitChange();
}

export function
resetPickerClickerCloudAuthority(): void {
  if (currentState === IDLE_STATE) {
    return;
  }

  states.clear();
  currentState = IDLE_STATE;
  emitChange();
}

export function
getPickerClickerCloudAuthoritySnapshot():
  PickerClickerCloudAuthorityState {
  return currentState;
}

function subscribe(
  listener: () => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function
usePickerClickerCloudAuthority(season?: number, week?: number, leagueId?: string):
  PickerClickerCloudAuthorityState {
  return useSyncExternalStore(
    subscribe,
    () => season !== undefined && week !== undefined
      ? states.get(authorityKey(season, week, leagueId ?? null)) ?? IDLE_STATE
      : currentState,
    () => IDLE_STATE,
  );
}
