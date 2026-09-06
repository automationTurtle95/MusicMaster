import { expect, test } from "@playwright/test";

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const TEST_EMAIL = `e2e-${Date.now()}@musicmaster.app`;
const TEST_PASSWORD = "Test1234!";

test.beforeAll(async () => {
  // Testnutzer direkt in der DB anlegen (scrypt-Hash wie in der App).
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "E2E Testuser",
      password: await hashPassword(TEST_PASSWORD),
      role: "MEMBER",
    },
  });
});

test.afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: TEST_EMAIL } })
    .catch(() => undefined);
  await prisma.$disconnect();
});

test("geschützte Route leitet unauthentifiziert zur Login-Seite um", async ({
  page,
}) => {
  await page.goto("/members");
  await expect(page).toHaveURL(/\/login/);
  // Login-Maske ist präsent (CardTitle "Anmelden" + Submit-Button).
  await expect(
    page.getByRole("button", { name: "Anmelden" }),
  ).toBeVisible();
});

test("Login führt zum Mitgliederbereich, Dashboard und Proben-Kalender", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  // Nach Login landet die App auf dem Default-callbackUrl /members.
  await expect(page).toHaveURL(/\/members/);
  await expect(
    page.getByRole("heading", { name: "Mitglieder" }),
  ).toBeVisible();

  // Dashboard (Modul-Übersicht) lädt.
  await page.goto("/dashboard");
  await expect(
    page.getByText("Übersicht · Saison 2026/27"),
  ).toBeVisible();

  // Proben-Modul inkl. der neuen Kalender-Ansicht lädt (Route: /rehearsals).
  await page.goto("/rehearsals");
  await expect(
    page.getByRole("heading", { name: "Proben" }),
  ).toBeVisible();
});
