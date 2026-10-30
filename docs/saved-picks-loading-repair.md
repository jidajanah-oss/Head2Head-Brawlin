# Advance-card schedule visibility repair

## Confirmed production cause

The deployed `is_league_member(uuid)` checks `league_members`. Player sign-in
uses active `account_links` joined to active `league_players`, and ordinary
linked accounts need not have a legacy membership row. The schedule SELECT
policy used the former check. Kenny's active computer account could call
`load_my_player_pick_intents` successfully but saw zero `league_games` rows.
The advance-card hydration check rejected that empty schedule before calling
the saved-picks RPC, then displayed the generic saved-picks loading error.
The API returned HTTP 200 because RLS filtered rows rather than rejecting the
request. This was not an empty-picks failure or a missing saved-picks RPC.

Bruce's active backup-commissioner account successfully reads both schedules
and own picks in database diagnostics. His historical iPhone requests also
returned successful saved-pick responses. His reported browser failure could
not be reproduced on his absent device; do not claim this policy mismatch was
proven for his backup-commissioner session. The frontend now displays the
underlying loading error if a failure persists, while continuing to block writes
until hydration succeeds.

## Repair and deployment

Apply `supabase/migrations/20261030010000_linked_player_schedule_read.sql` in the
Supabase SQL Editor for the intended project, then deploy the frontend.
The migration adds only an authenticated SELECT policy on published schedules,
using the existing `current_league_role` active-account-link check. Existing
legacy-member and commissioner policies remain. No schedule write grant,
other-player pick access, lock, reveal, scoring, standings, submission function,
Picker Clicker assignment, or saved record is changed.

Applied to production October 29, 2026 (Eastern). In a repeatable-read transaction,
counts and full-row fingerprints matched before and after: 3,491 picks and
238 submissions. No production picks were created or submitted for testing.
Read-only production checks under all 32 active linked accounts succeeded:
14 games in Week 8, 15 in Week 9, and 14 in Week 10, with each account's own
saved-pick reads succeeding for all three weeks. Bruce and Kenny each retained
14 current-week picks and no future-week picks.

After applying, reload Picks and select the current week and both advance weeks.
Automatic retries also recover without clearing browser storage or signing out.
If an error persists, record the displayed detail and account/week; do not
disable the hydration safeguard or clear saved choices.

## Verification

Isolated PostgreSQL reproduces the deployed legacy-membership mismatch, verifies
the repair for the full 32-player fixture across current and future weeks,
checks backup commissioner reads, and rejects schedule writes by ordinary
players, inactive links, outsiders, anonymous users, and private-pick reads.
Existing submission, lock, reveal, Picker Clicker, week isolation and navigation
tests remain in the suite. Production verification is read-only under active
accounts' database authorization; device-level confirmation remains necessary
for Bruce's originally reported iPhone session.

## Rollback

Drop only `league_games_read_linked_players` if rollback is required. This
restores the previous schedule visibility, including its ordinary-player bug.
Revert the frontend diagnostic change independently. Never delete picks,
submissions, schedules, assignments, or legacy memberships for rollback.
