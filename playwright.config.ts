import path from "node:path";

import { defineConfig } from "@playwright/test";

// E2E nutzt zwingend die lokale SQLite-Dev-DB (unabhängig von ggf. gesetzten
// Postgres-URLs in der Umgebung) sowie einen Test-AUTH_SECRET.
const dbUrl = `file:${path
  .resolve(__dirname, "prisma/dev.db")
  .replace(/\\/g, "/")}`;
process.env.DATABASE_URL = dbUrl;
process.env.AUTH_SECRET = "e2e-test-secret-not-for-prod";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 300000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
    },
  },
});
