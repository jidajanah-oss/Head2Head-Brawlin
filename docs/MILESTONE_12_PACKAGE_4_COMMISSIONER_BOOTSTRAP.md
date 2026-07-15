# Milestone 12 Package 4

## Commissioner Bootstrap and Local Session Sync

This package completes the first controlled commissioner sign-in workflow.

## Confirmed cloud state before installation

- The Supabase project is healthy.
- The browser can reach the Package 3 cloud connection function.
- The primary commissioner account is linked to Jimbo.
- Jimbo is the active cloud commissioner for the 2026 league.
- The magic-link sign-in flow succeeds.

No email address, Supabase user UUID, database password, secret key, or service-role key belongs in this repository.

## Files

- `src/features/auth/CloudPlayerSessionSync.tsx`
- `src/main.tsx`
- `supabase/tests/milestone_12_package_4_commissioner_verification.sql`
- `docs/MILESTONE_12_PACKAGE_4_COMMISSIONER_BOOTSTRAP.md`

## Runtime behavior

When a linked account signs in, the session sync component:

1. Selects the linked local league player for the new signed-in session.
2. Synchronizes that local player's role with the protected cloud account link.
3. Demotes stale duplicate primary commissioner roles when the linked role is `commissioner`.
4. Locks a regular player to their own local player ID.
5. Allows primary and backup commissioners to switch the active player after the initial session sync so they can administer the league.
6. Leaves signed-out local behavior unchanged during the migration period.

## Installation

Copy the package folders into the repository root and replace `src/main.tsx` when prompted.

Do not replace or commit `.env.local`.

## Required checks

Run:

```bash
npm run build
git diff --check
git status --short
```

Then start the local app:

```bash
npm run dev
```

With the commissioner still signed in, open **Me** and confirm:

- Cloud Account shows Jimbo.
- Role shows Commissioner.
- The Active Player card shows Jimbo.
- Player 1 no longer carries the Commissioner badge.

The commissioner may then select another active player and the selection should remain. A future regular-player login must automatically return to that player's linked local ID if another selection is attempted.

## Supabase verification

Run `supabase/tests/milestone_12_package_4_commissioner_verification.sql` in the SQL Editor.

Expected single row:

- `display_name`: Jimbo
- `nfl_team`: WAS
- `role`: commissioner
- `status`: active
- `account_link_active`: true
- `auth_user_exists`: true
- `active_commissioner_count`: 1

## Commit

After every check passes:

```bash
git add docs/MILESTONE_12_PACKAGE_4_COMMISSIONER_BOOTSTRAP.md src/main.tsx src/features/auth/CloudPlayerSessionSync.tsx supabase/tests/milestone_12_package_4_commissioner_verification.sql
git commit -m "Add commissioner cloud session sync"
git push
```
