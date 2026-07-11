/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NFL_PROVIDER?: "mock" | "espn" | "nfl";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}