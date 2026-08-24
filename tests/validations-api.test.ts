import { describe, it, expect } from "vitest";

import { eventCreateSchema, eventUpdateSchema } from "@/lib/validations/event";
import { rehearsalCreateSchema } from "@/lib/validations/rehearsal";
import { sheetCreateSchema } from "@/lib/validations/sheet";
import { attendanceBulkSchema } from "@/lib/validations/attendance";

describe("eventCreateSchema", () => {
  it("accepts a valid event and coerces startsAt to Date", () => {
    const r = eventCreateSchema.safeParse({
      title: "Sommerkonzert",
      startsAt: "2026-09-01T19:00:00Z",
      location: "Stadthalle",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.startsAt).toBeInstanceOf(Date);
  });

  it("rejects a missing title", () => {
    expect(
      eventCreateSchema.safeParse({ startsAt: "2026-09-01T19:00:00Z", location: "X" })
        .success,
    ).toBe(false);
  });
});

describe("eventUpdateSchema (partial)", () => {
  it("accepts an empty update", () => {
    expect(eventUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("validates the members array shape when present", () => {
    expect(eventUpdateSchema.safeParse({ members: [{ memberId: "m1" }] }).success).toBe(true);
    expect(eventUpdateSchema.safeParse({ members: [{ role: "Solo" }] }).success).toBe(false);
  });
});

describe("rehearsalCreateSchema", () => {
  it("accepts valid and rejects a missing title", () => {
    expect(
      rehearsalCreateSchema.safeParse({ title: "Probe", startsAt: "2026-09-01T19:00:00Z" })
        .success,
    ).toBe(true);
    expect(rehearsalCreateSchema.safeParse({ startsAt: "2026-09-01T19:00:00Z" }).success).toBe(
      false,
    );
  });
});

describe("sheetCreateSchema", () => {
  it("accepts valid input with difficulty and empty fileUrl", () => {
    expect(
      sheetCreateSchema.safeParse({ title: "Takt 1", difficulty: "MITTEL", fileUrl: "" })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid fileUrl", () => {
    expect(
      sheetCreateSchema.safeParse({ title: "Takt 1", fileUrl: "not-a-url" }).success,
    ).toBe(false);
  });
});

describe("attendanceBulkSchema", () => {
  it("requires at least one item with a valid status", () => {
    expect(
      attendanceBulkSchema.safeParse({ items: [{ memberId: "m1", status: "PRESENT" }] })
        .success,
    ).toBe(true);
    expect(attendanceBulkSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      attendanceBulkSchema.safeParse({ items: [{ memberId: "m1", status: "NOPE" }] })
        .success,
    ).toBe(false);
  });
});
