import { expect, test } from "@playwright/test";

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const TEST_EMAIL = `e2e-instr-${Date.now()}@musicmaster.app`;
const TEST_PASSWORD = "Test1234!";
const INVENTORY = `INV-E2E-${Date.now()}`;

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "E2E Instrumente",
      password: await hashPassword(TEST_PASSWORD),
      role: "ADMIN",
    },
  });
});

test.afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: TEST_EMAIL } })
    .catch(() => undefined);
  await prisma.instrument
    .deleteMany({ where: { inventoryNumber: INVENTORY } })
    .catch(() => undefined);
  await prisma.$disconnect();
});

test("Instrumente-Seite lädt und neues Instrument kann angelegt werden", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page).toHaveURL(/\/members/);

  await page.goto("/instruments");
  await expect(
    page.getByRole("heading", { name: "Instrumente" }),
  ).toBeVisible();

  // Neues Instrument über das Formular anlegen.
  await page.getByLabel("Register").selectOption("Trompete");
  await page.getByPlaceholder("Inventarnummer").fill(INVENTORY);
  await page.getByLabel("Zustand").selectOption("Neuwertig");
  await page.getByRole("button", { name: "Anlegen" }).click();

  // Das angelegte Instrument erscheint in der Liste.
  await expect(page.getByText(INVENTORY)).toBeVisible();
});
