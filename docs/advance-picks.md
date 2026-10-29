# Advance Picks

Every linked active player can choose the league current week or either of the next two regular-season weeks (capped at Week 18). Picks uses its own NFL provider for advance cards. The global league week, scoring, results, standings, roster, authentication, and commissioner controls stay on the league week. A league-week rollover returns the selector to the new current week.

The existing per-game cloud pick records and atomic Sync and Submit RPC are reused. Editing an open pick retains existing automatic synchronization and resubmission behavior. Locked choices are excluded from submission payloads and remain protected by the existing database lock. Opponent reveal remains on the current week and keeps its existing database-enforced per-game reveal timing. Bye exemptions use the selected week's schedule.

## Database change

Apply `supabase/migrations/20261029010000_advance_picks.sql` after the existing migrations. It replaces only `submit_weekly_picks` and `submit_weekly_picks_with_intents`, extending their allowed window to `current_week .. least(current_week + 2, 18)`. It retains owner validation, authenticated-only grants, atomic rollback, per-game lock checks, and team validation. It does not rewrite pick, roster, score, account, or league records. No new player permissions or service key in the browser are needed.

## Schedule and Picker Clicker preparation

A signed-in commissioner automatically publishes the next two schedules through the existing commissioner-only game upsert and prepares missing shared Picker Clicker sources in week order, using the existing nonrepeating selection algorithm and protected RPC. Existing assignments are reused. Preparation retries every minute, loads the live ESPN schedule, and reports errors to the commissioner. It never advances the league week. Members cannot publish or alter schedules or create assignments.

Before launch, a commissioner must open the updated app and leave it open until both future weeks have complete cloud schedules and authoritative Picker Clicker assignments. Advance cards fail closed while these are missing or the published game identities/teams/kickoffs disagree with the live schedule. A commissioner needs to open the app after subsequent week rollovers to prepare the newly available week and when kickoff changes need publishing. Schedule preparation is deliberately not delegated to ordinary members.

## Validation and rollout

1. Run `npm ci`, `npm test`, `npm run build`, and `npx oxlint src tests`. Database tests use isolated PostgreSQL through PGlite, applying the real foundational migrations and new migration; they do not connect to production. Test auth schema emulates Supabase JWT subject lookup.
2. Inspect production function definitions against the repository migration history and record existing row counts. Verify the intended league and season. Apply the migration transaction before deploying the app.
3. Merge only after pull-request validation passes. The existing main-branch Pages deployment also runs tests before building.
4. Sign in as commissioner to publish both future schedules and PC assignments. Verify current/future card switching, own-account saved choices after reload/on another device, manual and PC submissions, bye handling, current-week reveal, and locks using a non-production fixture where possible. Do not alter real players' picks for smoke tests.
5. Verify production read-only function definitions, schedule/assignment availability, and Pages release. If live verification or database access is unavailable, leave the PR unmerged.

## Rollback

Revert the frontend commit to restore the current-week-only page. Keep all saved advance picks in place; they remain ordinary picks for their game IDs and require no promotion when their week arrives. If database rollback is necessary, restore the two previous function definitions from `20260907040000_incremental_weekly_pick_submission.sql` and `20260727030000_atomic_weekly_pick_sync_submit.sql` in one transaction. Do not delete picks or future schedules as a rollback step.
