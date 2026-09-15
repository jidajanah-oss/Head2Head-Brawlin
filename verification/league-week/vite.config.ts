import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  cacheDir: 'verification/league-week/.vite-cache',
  plugins: [{ name: 'league-week-fixtures', enforce: 'pre', resolveId(id) {
    if (['AuthContext', 'supabaseClient', 'leaguePersistence'].some(name => id.endsWith('/' + name))) {
      return resolve('verification/league-week/fixtures.tsx');
    }
  } }, react()],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
});
