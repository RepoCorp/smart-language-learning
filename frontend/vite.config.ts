import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
  },
});
