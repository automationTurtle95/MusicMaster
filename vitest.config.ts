import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    env: {
      // Das Schema ist SQLite-only (provider = "sqlite"). Erzwinge eine lokale
      // SQLite-Datei für Tests und ignoriere ggf. im Ambiente gesetzte
      // Postgres-URLs (z. B. aus Containern), damit der Integrationstest gegen
      // das migrierte Schema läuft.
      DATABASE_URL: `file:${path.resolve(__dirname, "prisma/dev.db").replace(/\\/g, "/")}`,
    },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
