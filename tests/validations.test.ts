import { describe, expect, it } from "vitest";

import { memberCreateSchema } from "@/lib/validations/member";
import { signInSchema } from "@/lib/validations/auth";
import { attendanceStatus } from "@/lib/validations/enums";

describe("memberCreateSchema", () => {
  it("akzeptiert ein gültiges Mitglied", () => {
    const result = memberCreateSchema.safeParse({
      firstName: "Anna",
      lastName: "Müller",
      instrument: "Trompete",
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it("lehnt fehlendes Instrument ab", () => {
    const result = memberCreateSchema.safeParse({
      firstName: "Anna",
      lastName: "Müller",
    });
    expect(result.success).toBe(false);
  });

  it("wandelt aktives Flag korrekt (default true)", () => {
    const result = memberCreateSchema.parse({
      firstName: "Anna",
      lastName: "Müller",
      instrument: "Trompete",
    });
    expect(result.active).toBe(true);
  });
});

describe("signInSchema", () => {
  it("validiert E-Mail + Passwort", () => {
    expect(signInSchema.safeParse({ email: "a@b.de", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "keine-email", password: "x" }).success).toBe(false);
  });
});

describe("attendanceStatus", () => {
  it("erlaubt nur definierte Werte", () => {
    expect(attendanceStatus.safeParse("PRESENT").success).toBe(true);
    expect(attendanceStatus.safeParse("VORHANDEN").success).toBe(false);
  });
});
