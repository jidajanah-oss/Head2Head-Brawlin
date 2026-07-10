import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const GITHUB_PAGES_REPOSITORY =
  "Head2Head-Brawlin";

const isGitHubPagesBuild =
  process.env.GITHUB_PAGES === "true";

export default defineConfig({
  plugins: [react()],
  base: isGitHubPagesBuild
    ? `/${GITHUB_PAGES_REPOSITORY}/`
    : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
