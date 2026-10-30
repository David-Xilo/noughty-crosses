/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { version } from "./package.json";

// Relative base: the same build serves itch.io, Capacitor and Tauri.
export default defineConfig({
  base: "./",
  // The version the credits card shows: package.json's, the same as the tag (TTT-5.1).
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: "dist", chunkSizeWarningLimit: 800 },
  test: { include: ["test/**/*.test.ts"] },
});
