import { describe, it, expect, beforeEach } from "vitest";
import { LoginRateLimiter } from "./login-rate-limiter";

describe("LoginRateLimiter", () => {
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    limiter = new LoginRateLimiter(3, 60_000); // 3 attempts per minute
  });

  it("allows attempts within limit", () => {
    expect(limiter.isLimited("192.168.1.1")).toBe(false);
    expect(limiter.isLimited("192.168.1.1")).toBe(false);
    expect(limiter.isLimited("192.168.1.1")).toBe(false);
  });

  it("blocks attempts exceeding limit", () => {
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");

    // Fourth attempt should be blocked
    expect(limiter.isLimited("192.168.1.1")).toBe(true);
  });

  it("tracks separate IPs independently", () => {
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");

    // First IP is now limited
    expect(limiter.isLimited("192.168.1.1")).toBe(true);

    // Second IP should still have full quota
    expect(limiter.isLimited("192.168.1.2")).toBe(false);
    expect(limiter.isLimited("192.168.1.2")).toBe(false);
    expect(limiter.isLimited("192.168.1.2")).toBe(false);
  });

  it("provides reset time for limited IPs", () => {
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1"); // Exceeds limit

    const resetTime = limiter.getResetTime("192.168.1.1");
    expect(resetTime).toBeTruthy();
    expect(resetTime).toBeInstanceOf(Date);
    expect(resetTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null reset time for unlimited IPs", () => {
    const resetTime = limiter.getResetTime("192.168.1.1");
    expect(resetTime).toBeNull();
  });

  it("resets all limits when reset() is called", () => {
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1");
    limiter.isLimited("192.168.1.1"); // Exceeds limit

    expect(limiter.isLimited("192.168.1.1")).toBe(true);

    limiter.reset();

    // Should be able to make attempts again
    expect(limiter.isLimited("192.168.1.1")).toBe(false);
  });

  it("cleans up expired entries", () => {
    const shortLimiter = new LoginRateLimiter(3, 10); // 10ms window

    shortLimiter.isLimited("192.168.1.1");
    shortLimiter.isLimited("192.168.1.1");
    shortLimiter.isLimited("192.168.1.1");
    shortLimiter.isLimited("192.168.1.1"); // Exceeds limit

    expect(shortLimiter.isLimited("192.168.1.1")).toBe(true);

    // Wait for window to expire
    return new Promise((resolve) => {
      setTimeout(() => {
        // Should be reset after expiry
        expect(shortLimiter.isLimited("192.168.1.1")).toBe(false);
        resolve(undefined);
      }, 15);
    });
  });
});
