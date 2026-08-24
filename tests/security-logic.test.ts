import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isManager, MANAGER_ROLES } from "@/lib/authz";
import { rateLimitAllow } from "@/lib/rate-limit";
import type { Role } from "@/lib/validations/auth";

describe("isManager (RBAC gate)", () => {
  it("grants ADMIN and BOARD", () => {
    expect(isManager("ADMIN")).toBe(true);
    expect(isManager("BOARD")).toBe(true);
    expect(MANAGER_ROLES.every((r) => isManager(r))).toBe(true);
  });

  it("denies MEMBER and undefined", () => {
    expect(isManager("MEMBER")).toBe(false);
    expect(isManager(undefined)).toBe(false);
  });

  it("denies any role outside MANAGER_ROLES", () => {
    expect(isManager("GUEST" as Role)).toBe(false);
  });
});

describe("rateLimitAllow (brute-force protection)", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to 10 attempts per window, then blocks", () => {
    const key = "rl:test:limit";
    for (let i = 0; i < 10; i++) expect(rateLimitAllow(key)).toBe(true);
    expect(rateLimitAllow(key)).toBe(false);
  });

  it("treats distinct keys independently", () => {
    const a = "rl:test:indep:a";
    const b = "rl:test:indep:b";
    for (let i = 0; i < 10; i++) rateLimitAllow(a);
    expect(rateLimitAllow(a)).toBe(false);
    expect(rateLimitAllow(b)).toBe(true);
  });

  it("resets after the 60s window expires", () => {
    const key = "rl:test:reset";
    expect(rateLimitAllow(key)).toBe(true);
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000 + 1);
    expect(rateLimitAllow(key)).toBe(true);
  });
});
