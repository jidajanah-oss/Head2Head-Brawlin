# Milestone 12 Package 5

## Placeholder Roster Cleanup

This package removes the temporary eight-player roster that was used before
real cloud account onboarding.

## Preserved player

- Jimbo
- Washington (`WAS`)
- Primary commissioner
- Existing Supabase account link

## Removed placeholders

- Player 1 / PIT
- Player 2 / DAL
- Player 3 / PHI
- Player 4 / BUF
- Brandon / BAL
- Brenton / CIN
- Dot / CLE

Those seven NFL teams return to open-team status.

## Safety behavior

The browser migration runs before `LeagueProvider` loads persistence. It only
changes local data when all of the following are true:

1. The roster contains exactly eight players.
2. The exact eight name/team signatures above are present.
3. Jimbo's exact internal player ID is present.
4. Jimbo is assigned to Washington.

A later real roster cannot match this signature, so it will not be altered.

## Data cleanup

The migration:

- Keeps Jimbo's local player record and any Jimbo picks.
- Makes Jimbo the active local player and sole primary commissioner.
- Removes all other local players and their picks.
- Clears scoring, Picker Clicker, obscure-stat, payout-ledger, and playoff
  histories that could contain placeholder player IDs.
- Preserves league settings, games, NFL game results, and Supabase login data.

The starter roster in `src/lib/leagueEngine.ts` is now empty so the four
original sample players cannot return after a persistence reset. The cloud
session-sync component can recreate a missing linked player from the protected
Supabase account-link view.

## Supabase impact

No database migration is required. Only Jimbo was inserted into
`league_players`, so the supplied SQL file is a verification query only.

## Required checks

```bash
npm run build
npm run dev
```

With Jimbo signed in, open **Me** and confirm:

- Cloud Account shows Jimbo / Commissioner / WAS.
- Active Player shows Jimbo.
- Claimed shows `1/32`.
- Active shows `1`.
- PIT, DAL, PHI, BUF, BAL, CIN, and CLE show as open.

Then run:

```bash
git diff --check
git status --short
```

## Commit

After all checks pass:

```bash
git add docs/MILESTONE_12_PACKAGE_5_PLACEHOLDER_ROSTER_CLEANUP.md src/engine/placeholderRosterMigration.ts src/features/auth/CloudPlayerSessionSync.tsx src/lib/leagueEngine.ts src/main.tsx supabase/tests/milestone_12_package_5_roster_verification.sql
git commit -m "Remove placeholder league roster"
git push
```
