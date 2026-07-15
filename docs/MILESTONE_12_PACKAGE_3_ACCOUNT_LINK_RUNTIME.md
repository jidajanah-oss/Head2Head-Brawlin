# Milestone 12 Package 3

## Cloud Account Link Runtime + Live Connection Check

This package connects the React authentication context to the Package 2 `current_account_link` view and adds a browser-safe database health check.

It does not create users, invite players, seed the league roster, or move picks to Supabase.

## Files

Complete replacements:

- `src/context/AuthContext.tsx`
- `src/engine/authAccessTypes.ts`
- `src/pages/Players.tsx`

New files:

- `src/services/cloudAccountLinkService.ts`
- `src/features/auth/CloudAccountPanel.tsx`
- `src/styles/auth.css`
- `supabase/migrations/20260711020000_milestone_12_account_link_runtime.sql`
- `supabase/tests/milestone_12_package_3_verification.sql`
- `docs/MILESTONE_12_PACKAGE_3_ACCOUNT_LINK_RUNTIME.md`

## Install

Copy the package folders into the repository root and allow Windows to merge the folders and replace the three existing files.

Do not replace `.env.local` and do not add any Supabase secret key.

## Apply the migration

In Supabase SQL Editor, run the complete file:

`supabase/migrations/20260711020000_milestone_12_account_link_runtime.sql`

Expected result:

`Success. No rows returned`

Then run:

`supabase/tests/milestone_12_package_3_verification.sql`

Expected results:

- `schema_version` = `3`
- `service` = `head2head-brawlin`
- both execute checks = `true`
- `current_account_link` view returned

## Build

Run:

```bash
npm run build
```

The existing Vite bundle-size warning is acceptable.

## Local browser test

Run:

```bash
npm run dev
```

Open the local app and select **Me**.

Expected before any users are created:

- Cloud Account panel appears.
- Status changes from `Checking cloud` to `Cloud connected`.
- Email magic-link form appears.

Do not submit the form yet. Package 1 intentionally uses `shouldCreateUser: false`, and no Supabase users should be invited until the first commissioner bootstrap package is ready.

## Git checks

Run:

```bash
git status --short
git diff --check
```

Confirm `.env.local` is not listed.

After migration, browser test, and build all pass:

```bash
git add src/context/AuthContext.tsx src/engine/authAccessTypes.ts src/services/cloudAccountLinkService.ts src/features/auth/CloudAccountPanel.tsx src/pages/Players.tsx src/styles/auth.css supabase/migrations/20260711020000_milestone_12_account_link_runtime.sql supabase/tests/milestone_12_package_3_verification.sql docs/MILESTONE_12_PACKAGE_3_ACCOUNT_LINK_RUNTIME.md
git commit -m "Connect cloud account link runtime"
git push
```
