// Scripted playthroughs of the web build (TTT-3.2): npm run e2e builds it, serves it and
// plays. Keep only fast tests that never flake (TTT-0.3).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4174/",
    // Every playthrough starts as a returning player: stored settings skip the first-launch
    // welcome (TTT-4.1.7).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:4174",
          localStorage: [{ name: "ttt.settings.v1", value: "{}" }],
        },
      ],
    },
    launchOptions: { args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=vulkan"] },
  },
  webServer: {
    command: "npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174/",
    reuseExistingServer: false,
  },
});
