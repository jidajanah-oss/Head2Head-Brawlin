// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCloudLeagueWeek } from "../src/context/useCloudLeagueWeek";
import { createLeagueWeekSync } from "../src/services/leagueWeekSync";

const mock = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => ({
  status: "signed-in-linked", access: { canManageLeague: false,
    accountLink: {userId:"member",leagueId:"league"} },
}) }));
vi.mock("../src/services/supabaseClient", () => ({supabaseClient:{}}));
vi.mock("../src/services/cloudLeagueWeekService", () => ({loadCloudLeagueWeek:mock.load,saveCloudLeagueWeek:mock.save}));
const flush = async () => { for (let i=0;i<15;i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value:T)=>void;
  const promise = new Promise<T>(yes => { resolve=yes; });
  return {promise,resolve};
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("rechecks Week 7 -> 8 on foreground return without unmounting the saved card", async () => {
  const fresh = deferred<number>(); const apply=vi.fn();
  mock.load.mockResolvedValueOnce(7).mockReturnValueOnce(fresh.promise);
  const view=renderHook(()=>useCloudLeagueWeek(2026,apply));
  await act(flush);
  expect(apply).toHaveBeenLastCalledWith(7); expect(view.result.current.loading).toBe(false);
  act(()=>{
    Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(view.result.current.loading).toBe(false);
  await act(async()=>{
    Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus")); await flush();
  });
  expect(mock.load).toHaveBeenCalledTimes(2); expect(view.result.current.loading).toBe(false);
  await act(async()=>{fresh.resolve(8);await flush();});
  expect(apply).toHaveBeenLastCalledWith(8); expect(view.result.current.loading).toBe(false);
  expect(mock.save).not.toHaveBeenCalled();
});

it("refreshes a restored browser page, polls while visible, and removes resume listeners on cleanup", async () => {
  const apply=vi.fn(); mock.load.mockResolvedValue(8);
  const view=renderHook(()=>useCloudLeagueWeek(2026,apply)); await act(flush);
  mock.load.mockResolvedValue(9);
  await act(async()=>{
    const restored=new Event("pageshow"); Object.defineProperty(restored,"persisted",{value:true});
    window.dispatchEvent(restored); await flush();
  });
  expect(apply).toHaveBeenLastCalledWith(9);
  await act(async()=>{vi.advanceTimersByTime(15_000);await flush();});
  expect(mock.load).toHaveBeenCalledTimes(3);
  view.unmount();
  window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("focus"));
  await act(async()=>{vi.advanceTimersByTime(60_000);await flush();});
  expect(mock.load).toHaveBeenCalledTimes(3); expect(mock.save).not.toHaveBeenCalled();
});

it("ignores a suspended old-week response and keeps a new foreground request coalesced", async () => {
  const old=deferred<number>(),fresh=deferred<number>(); const apply=vi.fn(),save=vi.fn();
  const load=vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const sync=createLeagueWeekSync({load,apply,save,publish:vi.fn(),canManage:false});
  const stale=sync.refresh(); sync.invalidate(); const current=sync.refresh();
  old.resolve(7); await stale;
  await sync.refresh(); expect(load).toHaveBeenCalledTimes(2); expect(apply).not.toHaveBeenCalled();
  fresh.resolve(8); await current;
  expect(apply).toHaveBeenCalledExactlyOnceWith(8); expect(save).not.toHaveBeenCalled(); sync.dispose();
});

it("does not interrupt or duplicate a commissioner week change during resume", async () => {
  const saved=deferred<number>(); const apply=vi.fn(),publish=vi.fn();
  const save=vi.fn(()=>saved.promise),load=vi.fn(async()=>7);
  const sync=createLeagueWeekSync({load,apply,save,publish,canManage:true});
  await sync.refresh(); const writing=sync.change(8);
  sync.invalidate(); await sync.refresh();
  expect(publish.mock.lastCall?.[0]).toMatchObject({hydrated:true,saving:true});
  saved.resolve(8); await writing;
  expect(apply).toHaveBeenLastCalledWith(8); expect(save).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1); sync.dispose();
});

it("a pre-save poll cannot block future refreshes or overwrite the confirmed commissioner change", async () => {
  const stale=deferred<number>();const apply=vi.fn();
  const load=vi.fn().mockResolvedValueOnce(7).mockReturnValueOnce(stale.promise).mockResolvedValue(8);
  const sync=createLeagueWeekSync({load,apply,save:async()=>8,publish:vi.fn(),canManage:true});
  await sync.refresh();const old=sync.refresh();await sync.change(8);
  await sync.refresh();stale.resolve(7);await old;
  expect(load).toHaveBeenCalledTimes(3);expect(apply).toHaveBeenLastCalledWith(8);sync.dispose();
});

it("retries a failed return-to-app check without clearing the last confirmed card or writing a week", async () => {
  mock.load.mockResolvedValueOnce(7).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(8);
  const apply=vi.fn();const view=renderHook(()=>useCloudLeagueWeek(2026,apply));await act(flush);
  await act(async()=>{
    window.dispatchEvent(new Event("pagehide"));window.dispatchEvent(new Event("pageshow"));await flush();
  });
  expect(view.result.current.error).toBe("offline");expect(view.result.current.loading).toBe(false);
  expect(apply).toHaveBeenLastCalledWith(7);
  await act(async()=>{vi.advanceTimersByTime(2_000);await flush();});
  expect(apply).toHaveBeenLastCalledWith(8);expect(view.result.current.error).toBe(null);
  expect(mock.save).not.toHaveBeenCalled();
});
