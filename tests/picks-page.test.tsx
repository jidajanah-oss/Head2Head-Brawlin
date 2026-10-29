// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NFLProvider, useNFL } from "../src/context/NFLContext";
import Picks from "../src/pages/Picks";
const state = vi.hoisted(() => ({ league: { currentWeek: 8, players: [{id: "p", name: "Player", nflTeam: "BUF"}] }, activePlayerId: "p" }));
vi.mock("../src/context/LeagueContext", () => ({ useLeague: () => state }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => ({ accountLink: null }) }));
vi.mock("../src/engine", () => ({ NFLService: { loadWeek: async (season: number, week: number) => ({ season, week, weekGames: [{id: String(week), week, awayTeam: week === 9 ? "KC" : "BUF", homeTeam: "NYJ"}], nflGames: [] }) } }));
vi.mock("../src/features/auth/CloudPlayerPickIntentSync", () => ({ default: () => null }));
vi.mock("../src/features/auth/CloudPickerClickerAssignmentSync", () => ({ default: () => null }));
vi.mock("../src/features/players/PlayerSelector", () => ({ default: () => null }));
vi.mock("../src/features/picks/PickSheet", () => ({ default: () => { const { week } = useNFL(); return <p>Card week {week}</p>; } }));
vi.mock("../src/features/picks/WeeklyPickSubmissionPanel", () => ({ default: () => { const { week } = useNFL(); return <p>Submit week {week}</p>; } }));
vi.mock("../src/features/picks/OpponentPickRevealPanel", () => ({ default: () => <p>Current opponent reveal</p> }));
function GlobalProbe() { const { week } = useNFL(); return <p>League runtime week {week}</p>; }
const app = () => <MemoryRouter><NFLProvider initialWeek={8} initialSeason={2026}><GlobalProbe/><Picks/></NFLProvider></MemoryRouter>;
beforeEach(() => { state.league.currentWeek = 8; });
afterEach(cleanup);
it("selects a future card and submit target while leaving the scoring runtime on the current week", async () => {
  const view = render(app());
  await screen.findByText("Card week 8");
  const selector = screen.getByLabelText("Pick week");
  expect(Array.from((selector as HTMLSelectElement).options).map(option => option.value)).toEqual(["8","9","10"]);
  fireEvent.change(selector,{target:{value:"10"}});
  await screen.findByText("Card week 10");
  expect(screen.getByText("Submit week 10")).toBeDefined();
  expect(screen.getByText("League runtime week 8")).toBeDefined();
  expect(screen.queryByText("Current opponent reveal")).toBeNull();
  state.league.currentWeek = 9;
  view.rerender(app());
  await waitFor(() => expect((screen.getByLabelText("Pick week") as HTMLSelectElement).value).toBe("9"));
});
it("uses the selected week's bye rather than blocking advance picks on the current bye", async () => {
  render(app());
  await screen.findByText("Card week 8");
  fireEvent.change(screen.getByLabelText("Pick week"),{target:{value:"9"}});
  await screen.findByText("You’re on a bye week");
  expect(screen.queryByText("Submit week 9")).toBeNull();
  fireEvent.change(screen.getByLabelText("Pick week"),{target:{value:"10"}});
  await screen.findByText("Card week 10");
});
