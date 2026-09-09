import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({cacheDir:'verification/player-pick-status/.vite-cache',plugins:[{name:'status-fixtures',enforce:'pre',resolveId(id){if(['AuthContext','LeagueContext','supabaseClient'].some(name=>id.endsWith('/'+name)))return resolve('verification/player-pick-status/fixtures.tsx');}},react()],server:{host:'127.0.0.1',port:5181}});
