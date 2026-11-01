# Week 8 Picker Clicker scoring correction

Cause: both October 25 corrections were explicitly restricted to season 2026, Week 7. Week 8 therefore still awarded opponent missing-pick points at lock and added those points to normal correct-pick credit for the same game.

Changes:
- weeklyScoringEngine.ts extends the valid-final filter and overlapping-credit subtraction from Week 7 to all subsequent weeks/seasons. Both live and newly finalized records use the same helpers. The overlap helper is renamed to remove its Week 7-only name.
- 20261101010000_final_game_single_credit.sql extends the two existing database guards to the same date range. It checks the expected prior definition, fails safely on unexpected definitions, and is idempotent. No pick, eligibility, submission, schedule, or historical result rows are written. Membership checks and response fields stay intact.
- Two regression files exercise the actual PostgreSQL function in PGlite and the actual local engines, including source-dependent deliberate Picker Clicker choices, automatic missing picks, single credit, unfinished/invalid/tied/canceled games, byes, repeated reads, live/final agreement, and partial/untouched eligibility. Earlier than Week 7 behavior remains unchanged.

Untouched-week protection: full automatic weeks remain ineligible for the weekly prize and season correct-pick totals/wins. Partial misses remain eligible. Deliberate Picker Clicker selections remain normal submitted choices. The correction does not redefine these rules.

Validation: 36 tests across 7 files passed. TypeScript and production build passed. Lint completed with four existing warnings (three empty files and one fallback spread); no errors.

Deployment status, updated November 1, 2026: the production Supabase function correction is committed and the live Home matchup board is verified. The same transaction first passed with ROLLBACK, then passed again with COMMIT. Both executions checked the actual Week 8 scores against an independent per-game calculation, compared Weeks 1–7 RPC results before/after, and compared a digest of every stored weekly scoring record. All checks passed.

At verification, the database reported one completed game and one locked game. The six inflated scores were caused by duplicate credit for the already-final game, rather than an additional unfinished game at that moment. The final-only guard also prevents early missed-pick credit as later games lock.

Verified live board:
- Danielle 0 – Ted 1
- Tyler 0 – Annarose 1
- Tha-Tha 1 – Tiereni 0
- Mark L 1 – Zach 0
- Chrissy 0 – Jax 1
- Christie 1 – Devin 0

The database change only replaced the two Week 7 scope guards and renamed one internal comment marker. No picks, eligibility, submissions, schedules, or stored result rows were edited. The saved prior function is available for rollback.

Release: this source change synchronizes the local live/finalization helpers with the corrected cloud RPC. The database migration is already installed in production; its marker makes repeat application a no-op. Publish the matching frontend through the normal validated GitHub Pages workflow.

Production verification confirmed the corrected scores on Home / All league matchups. The previous function definition and before/after evidence were retained with the investigation artifacts.
