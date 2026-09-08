# Returning-player pick regression check

Run `node node_modules/vite/bin/vite.js --config verification/vite.config.ts --configLoader runner` and open `/verification/index.html`.

This mounts the production sync, Pick Sheet, and weekly submission components against synthetic contexts and cloud services. It never connects to Supabase. The schedule fixture returns no rows, reproducing an active Computer Access account whose protected pick RPC works but whose legacy league membership does not expose the schedule.

Check:

1. A fresh card restores 16 choices, including one locked choice; the audit reports zero writes and zero schedule reads. The separate player's choice remains DAL.
2. The locked game's buttons are disabled; open games remain editable. Change one open choice and resubmit an already-submitted card. The fixture rejects a submission containing the locked game or missing any of the 15 open choices.
3. Logout/login and Fresh Card restore the changed open choice and all 16 selections without additional writes. Full reload restores the initial synthetic cloud card.
4. Toggle Network Failure: the sheet and submission show a loading/error state, with no misleading missing card or enabled submission. Toggle again to recover.
5. Lock All Games disables resubmission.

The fixture deliberately uses no real player credentials or pick selections. Actual database verification must remain read-only.
