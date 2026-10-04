import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// Unit and component tests. End-to-end tests live in e2e/ and run with Playwright.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
