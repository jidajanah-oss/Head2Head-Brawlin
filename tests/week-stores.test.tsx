// @vitest-environment jsdom
import { it, expect } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { publishCloudPickHydration, getCloudPickHydrationKey, useCloudPickHydration } from "../src/services/cloudPickHydrationService";
import { publishPickerClickerCloudAuthority, usePickerClickerCloudAuthority } from "../src/services/pickerClickerCloudAuthorityService";
it("hydrates current and future cards independently, isolating accounts", () => {
  const account = { userId: "u", leagueId: "l", playerId: "p" };
  const current = renderHook(() => useCloudPickHydration(account, 2026, 8));
  const future = renderHook(() => useCloudPickHydration(account, 2026, 10));
  act(() => publishCloudPickHydration(getCloudPickHydrationKey(account, 2026, 8), "ready"));
  act(() => publishCloudPickHydration(getCloudPickHydrationKey(account, 2026, 10), "error"));
  expect(current.result.current).toBe("ready"); expect(future.result.current).toBe("error");
  const other = renderHook(() => useCloudPickHydration({ ...account, userId: "other" }, 2026, 8));
  expect(other.result.current).toBe("loading"); cleanup();
});
it("future source publication cannot replace the current-week authority", () => {
  const current = renderHook(() => usePickerClickerCloudAuthority(2026, 8, "l"));
  const future = renderHook(() => usePickerClickerCloudAuthority(2026, 10, "l"));
  act(() => publishPickerClickerCloudAuthority({ status: "ready", leagueId: "l", season: 2026, week: 8, assignment: null, message: "current" }));
  act(() => publishPickerClickerCloudAuthority({ status: "waiting", leagueId: "l", season: 2026, week: 10, assignment: null, message: "future" }));
  expect(current.result.current.message).toBe("current"); expect(future.result.current.message).toBe("future"); cleanup();
});
