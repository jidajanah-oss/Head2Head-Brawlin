# Milestone 12 Package 2 — Supabase Project, Cloud Schema, Account Links, and RLS

## Package scope

This package creates the first production cloud database boundary for Head2Head Brawlin’ — Steel Edition.

It adds:

- League and roster tables
- Supabase-user-to-player account links
- Future invitation records without sending invitations
- Shared NFL game rows
- Database-enforced pick locking and selected-team validation
- Player-owned pick rows
- Weekly pick submission rows
- Versioned JSON documents for runtime histories
- Commissioner-only document visibility for payout/private state
- Row Level Security for every browser-accessible table
- A `current_account_link` view shaped for the React authentication context

This package does not yet migrate production league data, connect `AuthContext` to the account-link view, or invite players.

## 1. Create the Supabase project

1. Sign in to the Supabase Dashboard.
2. Create a new project named `Head2Head Brawlin`.
3. Choose the nearest available U.S. East region.
4. Create a strong database password and save it securely outside the repository.
5. Wait until project provisioning is complete.

Never commit the database password, a Supabase secret key, or a service-role key.

## 2. Configure authentication URLs

Open Authentication, then URL Configuration.

Set the Site URL to:

```text
https://jidajanah-oss.github.io/Head2Head-Brawlin/
```

Add these Redirect URLs:

```text
http://localhost:5173/**
https://jidajanah-oss.github.io/Head2Head-Brawlin/
```

Keep Email authentication enabled. Do not invite players yet.

## 3. Get the browser-safe project values

Open the project Connect dialog or Project Settings, then API Keys.

Copy only:

- Project URL
- Publishable key beginning with `sb_publishable_`

Create a local `.env.local` file from `.env.example`:

```dotenv
VITE_NFL_PROVIDER=espn
VITE_SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

Do not place `sb_secret_`, `service_role`, database passwords, or JWT secrets in a Vite environment file.

## 4. Add Package 2 files

Copy these files into the repository with the exact paths:

```text
supabase/migrations/20260711010000_milestone_12_cloud_schema.sql
supabase/tests/milestone_12_schema_verification.sql
docs/MILESTONE_12_PACKAGE_2_SUPABASE_SETUP.md
```

No existing React or TypeScript file is replaced in this package.

## 5. Apply the migration

For this first hosted-project setup, use the Supabase SQL Editor:

1. Open SQL Editor.
2. Create a new query.
3. Paste the complete contents of `20260711010000_milestone_12_cloud_schema.sql`.
4. Run the query once.
5. Confirm the query finishes successfully and commits.

The migration is intentionally tracked in the repository even when it is first applied through the SQL Editor.

## 6. Verify the schema

Open a second SQL Editor query and run the complete contents of:

```text
supabase/tests/milestone_12_schema_verification.sql
```

Expected results:

- Eight Package 2 tables are returned.
- `row_security` is `true` for all eight tables.
- Policies exist for every table.
- Authorization helper functions report `DEFINER` security.
- The `current_account_link` view exists.

## 7. Security model

### Player

A linked player can:

- Read the league, roster, shared games, and member-visible documents
- Read only their own pick rows
- Create, update, or delete only their own picks
- Change picks only before the game-specific lock time
- Read and manage only their own weekly submission rows

A player cannot:

- Read another player’s raw pick rows
- Read commissioner-only documents
- Manage account links
- Change the roster or league settings

### Backup commissioner

A linked backup commissioner can:

- Manage shared league state
- Manage games and all picks
- Read commissioner-visible documents
- Update normal roster fields

A backup commissioner cannot:

- Create, change, deactivate, or delete account links
- Assign, deactivate, or change commissioner roles

### Primary commissioner

A linked primary commissioner can:

- Perform all backup commissioner actions
- Manage account links and invitation records
- Assign, deactivate, or change commissioner roles

## 8. Cloud data split

The migration deliberately separates data by security boundary.

Normalized tables:

- `leagues`
- `league_players`
- `league_games`
- `player_picks`
- `weekly_pick_submissions`
- `account_links`
- `account_link_invitations`

Versioned JSON documents:

- Use `visibility = 'members'` for shared scoring, Picker Clicker, obscure-stat, playoff, and other league runtime histories.
- Use `visibility = 'commissioners'` for payout ledger or other restricted commissioner data.

Do not place account-link data or player picks inside a member-visible JSON document.

## 9. Initial commissioner bootstrap

Do not bootstrap or invite accounts during Package 2 testing.

The schema contains a controlled bootstrap path for Package 3:

1. An authenticated user creates the league.
2. That creator creates the commissioner roster row.
3. That creator links their own Auth user to the active commissioner player. The database rejects any different first link.
4. Once an active commissioner link exists, temporary creator bootstrap privileges end.

Package 3 will implement this workflow in the React application and load `current_account_link` into `AuthContext`.

## 10. Build and commit test

Run:

```bash
npm run build
```

Because Package 2 adds only SQL and documentation files, the existing React build should remain unchanged and continue to pass.

Then verify:

```bash
git status
git diff --check
```

Commit only after:

- The migration succeeds in Supabase
- The verification query passes
- `npm run build` passes
- No secret or service-role key appears in the repository

Recommended commit message:

```text
Add cloud database schema and RLS
```
