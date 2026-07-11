# Milestone 12 Package 6 — Real Player Onboarding

## Purpose

Package 6 lets the primary commissioner build the real league roster even when player email addresses are not yet available.

A player needs only:

- A real display name
- An available NFL team
- A league role

The email address is optional until the commissioner is ready to prepare and send that player's account invitation.

## Security boundary

The React application continues to use only the browser-safe Supabase publishable key.

Invitation email creation is performed by the `invite-player` Supabase Edge Function. The function uses Supabase's server-side secret environment variable inside the hosted Edge Function runtime. No secret or service-role key is stored in React, `.env.local`, GitHub, or the built JavaScript bundle.

Database functions use `security definer`, an empty `search_path`, explicit authorization checks, and matching invitation/email validation.

## Package files

```text
src/features/auth/CloudRosterSync.tsx
src/features/auth/PlayerAccountReadinessPanel.tsx
src/main.tsx
src/pages/Players.tsx
src/services/cloudAccountLinkService.ts
src/services/cloudRosterService.ts
src/styles/cloudRoster.css
supabase/functions/invite-player/index.ts
supabase/migrations/20260711030000_milestone_12_player_onboarding.sql
supabase/tests/milestone_12_package_6_verification.sql
docs/MILESTONE_12_PACKAGE_6_REAL_PLAYER_ONBOARDING.md
```

## Database changes

- Adds invitation delivery tracking:
  - `last_sent_at`
  - `send_count`
- Adds protected roster synchronization.
- Adds commissioner-only account-readiness queries.
- Adds invitation preparation and revocation.
- Adds signed-in invitation claiming.
- Updates account-link validation so only the exact invited email can claim the exact invited player.
- Updates the browser-safe cloud schema version to 4.

## Runtime behavior

### Roster first, email later

The existing Player Manager remains the source for adding a player name, team, and role. `CloudRosterSync` safely mirrors that roster into Supabase whenever Jimbo or another authorized commissioner changes it.

### Account states

The Player Account Readiness panel shows:

- `Not linked`
- `Invitation pending`
- `Invitation sent`
- `Linked`

### Invitation flow

1. Add the real player and NFL team.
2. Leave the email blank until it is available.
3. Enter the real email and choose **Prepare invitation**.
4. Nothing is emailed during preparation.
5. Choose **Send invitation** only when ready.
6. The player clicks the Supabase invitation email.
7. The signed-in email claims only its matching pending player invitation.
8. Row Level Security limits the player to that linked account and its protected data.

## Apply the SQL migration

Run this complete file in Supabase SQL Editor:

```text
supabase/migrations/20260711030000_milestone_12_player_onboarding.sql
```

Then run:

```text
supabase/tests/milestone_12_package_6_verification.sql
```

Expected final verification:

- `expected_schema_version = 4`
- `function_count = 6`
- `column_count = 2`
- `active_commissioner_count = 1`
- `active_account_link_count >= 1`
- `package_6_database_ready = true`

## Deploy the Edge Function

In the Supabase Dashboard:

1. Open **Edge Functions**.
2. Choose **Deploy a new function**.
3. Use the dashboard editor.
4. Name the function exactly:

```text
invite-player
```

5. Replace the editor contents with the complete contents of:

```text
supabase/functions/invite-player/index.ts
```

6. Keep JWT verification enabled.
7. Deploy the function.

The hosted runtime supplies the required Supabase environment variables. Do not copy any secret or service-role key into React or into a repository file.

## Local verification

```bash
npm run build
npm run dev
```

While signed in as Jimbo:

1. Open **Me**.
2. Confirm **Player Account Readiness** appears.
3. Confirm Jimbo shows `Linked`.
4. Add a real player using Player Manager without entering an email.
5. Confirm that player appears as `Not linked` after refresh.
6. Do not prepare or send an invitation until the player's real email is available.

## Commit only after verification

```bash
git diff --check
git status --short
git add docs src supabase
git diff --cached --check
git commit -m "Add real player cloud onboarding"
git push
```
