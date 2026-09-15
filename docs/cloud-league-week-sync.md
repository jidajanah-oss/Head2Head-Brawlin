# Cloud league week synchronization

## Changes

- `LeagueContext` hydrates the active week from the signed-in member's league in Supabase before mounting week-dependent consumers. It updates only `league.currentWeek` and caches that value through the existing persistence path.
- `useCloudLeagueWeek` loads on sign-in and refreshes on focus, reconnection, visibility restoration, and every 15 seconds while visible. Requests from an old account/session are discarded.
- `leagueWeekSync` permits only confirmed cloud changes, blocks overlapping writes, ignores stale reads, and reconciles conflicts or uncertain save failures without retrying a write.
- Both Commissioner Week Control surfaces (Season Operations and Setup Wizard) save automatically, disable controls during saving/loading, and display errors with a refresh action.
- Migration `20260916010000_cloud_league_week_sync.sql` adds two authenticated functions. `load_member_league_week` reads `public.leagues.current_week` after validating the active account link. `set_commissioner_league_week` checks commissioner/backup commissioner authorization, league, season, week range, and expected current week before updating only `current_week` (plus the table's existing timestamp trigger).
- No changes to auth credentials or providers, NFL schedule synchronization in `App.tsx`, standings calculations, picks, finalized history, or Picker Clicker assignments. No live data was reset or modified during development.

## Validation

- Production TypeScript/Vite build passed; Vite reports the existing large-bundle advisory.
- 23 Node checks passed: 14 new week-sync/service checks plus 9 existing opponent-reveal/Picker Clicker checks.
- 10 browser integration checks passed against the real `LeagueProvider` under React StrictMode, with synthetic auth, persistence, and Supabase responses. Includes hydration, next/previous/selection saves, preserved Week 1 state, focus/reconnect refresh, failure handling, player write denial, and local caching.
- Targeted source lint passed. Repository-wide lint exits successfully but has pre-existing warnings, mostly in committed generated assets.
- The new SQL functions have not been executed against a live database. Real-device verification remains a deployment check.

## Deploy (PowerShell)

Run from the existing repository:

```powershell
cd C:\Users\jidaj\Documents\GitHub\Head2Head-Brawlin
supabase db push --dry-run
```

Review the pending migrations. Apply the new migration before deploying the frontend:

```powershell
supabase db push
npm.cmd run build
node --test verification/league-week-sync.test.mjs verification/home-redesign.test.mjs
git add src/context/LeagueContext.tsx src/context/useCloudLeagueWeek.ts src/services/cloudLeagueWeekService.ts src/services/leagueWeekSync.ts src/features/commissioner/CommissionerSeasonOperations.tsx src/features/setup/SetupWizard.tsx supabase/migrations/20260916010000_cloud_league_week_sync.sql verification/league-week-sync.test.mjs verification/league-week/.gitignore verification/league-week/index.html verification/league-week/main.tsx verification/league-week/fixtures.tsx verification/league-week/vite.config.ts docs/cloud-league-week-sync.md
git commit -m "Sync active league week across signed-in devices"
git push origin main
```

The repository is currently on `main`; its existing GitHub Pages workflow deploys pushes to `main`. If the Supabase CLI is not linked/authenticated, apply the exact new migration through the correct project's Supabase SQL Editor instead. Do not rerun older migrations manually. No Edge Function deployment or Realtime publication change is required.

After the Pages deployment finishes, reload the PC and phone. Both should read the existing cloud week (expected Week 2), show Week 1 history, and load the current NFL schedule. Do not advance again just to repair the phone. The next intentional commissioner week change will be saved for all devices; other open devices follow within 15 seconds or when brought back into focus.

## Repeat browser integration checks

```powershell
node node_modules/vite/bin/vite.js --config verification/league-week/vite.config.ts --configLoader runner
```

Open `http://127.0.0.1:5182/verification/league-week/index.html`. It should report `ALL INTEGRATION CHECKS PASSED`. This harness never contacts Supabase.
