# Commissioner Player Pick Status checks

Run the service checks with `node verification/player-pick-status/service-check.cjs`.

For the isolated browser fixture, run:

`node node_modules/vite/bin/vite.js --config verification/player-pick-status/vite.config.ts --configLoader runner`

Open `/verification/player-pick-status/index.html`. No real Supabase connection is used.

Verify primary and backup access; regular-player and signed-out invisibility with no additional requests; independent prior-week selection; a slow Week 1 response followed by Week 2; empty schedules; refresh failure and recovery. Add `?mobile` to inspect the 390-pixel layout.

The database migration was verified in a rolled-back transaction against the current league: all 32 player counts matched the underlying current-week records, the payload contained only the five documented per-player fields, both commissioner roles could read the report, and regular-player, signed-out, and other-league calls were denied. No picks or submissions were modified.

The panel intentionally counts saved manual/commissioner picks and deliberate Picker Clicker intents, not automatic fallback or submission checkpoints. A missing locked pick takes priority over other completion labels. Weeks without cloud schedules show an unavailable state, not false missing counts.
