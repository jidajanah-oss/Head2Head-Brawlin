import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
const mocks = ['AuthContext','LeagueContext','NFLContext','cloudPlayerPickService','cloudLeagueGameService','cloudWeeklyPickSubmissionService','cloudSeasonResetService','supabaseClient'];
export default defineConfig({
 cacheDir: 'verification/.vite-cache',
 plugins: [{ name: 'isolated-pick-fixtures', enforce: 'pre', resolveId(id) {
   if (mocks.some(name => id.endsWith('/'+name))) return resolve('verification/fixtures.tsx');
 }},react()], server:{host:'127.0.0.1',port:5179},
});
