import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getAdminCookieOptions } from "./session";

describe("Cookie Security", () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    if (originalEnv) {
      (process.env as Record<string, unknown>).NODE_ENV = originalEnv;
    } else {
      delete (process.env as Record<string, unknown>).NODE_ENV;
    }
  });

  it("sets secure flag in production", () => {
    (process.env as Record<string, unknown>).NODE_ENV = "production";
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const options = getAdminCookieOptions(expiresAt);

    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBe(expiresAt);
  });

  it("disables secure flag in test environment only", () => {
    (process.env as Record<string, unknown>).NODE_ENV = "test";
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const options = getAdminCookieOptions(expiresAt);

    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  it("sets secure flag in development", () => {
    (process.env as Record<string, unknown>).NODE_ENV = "development";
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const options = getAdminCookieOptions(expiresAt);

    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  it("sets secure flag when NODE_ENV is undefined", () => {
    delete (process.env as Record<string, unknown>).NODE_ENV;
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const options = getAdminCookieOptions(expiresAt);

    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
  });
});
