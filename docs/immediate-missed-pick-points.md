# Immediate missed-pick Head2Head points

When a game locks with no deliberate pick, the opponent's live Head2Head score receives the missed-pick point on the next existing refresh (normally within 15 seconds). It does not wait for an NFL result or weekly finalization. The overall matchup remains provisional until the week is complete.

The live database calculation now uses deliberate correct picks plus the opponent's missing locked picks, matching the existing finalized bonus rule. Deliberately selected Picker Clicker remains a made pick with normal scoring. An automatic copied selection earns no normal correct-pick credit. The point is computed on each read, not accumulated or written into a score table.

Prize eligibility remains unchanged: the player's other deliberate picks still count after a partial omission. All-week omission causes disqualification only after every game locks. Bye franchises receive no picks obligation or penalty. Existing finalized history is not rewritten.

Finalization receives the original intent map instead of a map containing automatic copied teams. This preserves the distinction between deliberate and automatic choices in both Head2Head and weekly-prize correct-pick counts.

## Deployment

1. Deploy the website first. The new client accepts early points while remaining compatible with the previous database response.
2. Apply only `supabase/migrations/20261012010000_immediate_missed_pick_points.sql` to the correct Head2Head Supabase project. It atomically replaces the existing read-only scoring function and preserves its membership check and grants. It does not update picks, prizes, or finalized records.
3. Reload the website so an older cached client cannot reject a score greater than the number of completed games. Confirm Week 5 Bruce Lee / Travis reads 9–9 if the verified 8–9 baseline and one missed Thursday pick still apply.
4. Verify the player's completion remains 14/15, with one missed locked game, and weekly prize eligibility remains available for the other picks.

Rollback uses the previous definition of `load_live_matchup_scores` from `20261011010000_head2head_bye_exemption.sql`; execute only that function definition and its grants, not the whole historical migration chain. No score rows need reversal because reads calculate the points.

## Verification

Run `node verification/immediate-missed-pick-points.test.cjs` and `node verification/bye-week.test.cjs`, plus `npm run build`.

The immediate-points regression checks early lock credit, no credit before lock, the Week 5 9–9 fixture, source-independent automatic points, deliberately selected Picker Clicker, repeated reads, live/final agreement, partial/full weekly omission, bye exemptions, legacy RPC responses, and rejection of malformed responses.

These tests exercise the TypeScript scoring and client response validation. Database execution must also be verified during deployment; the migration's SQL is not executed by the Node regression test.
