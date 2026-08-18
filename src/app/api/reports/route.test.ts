/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { POST } from "./route";
import { PrismaClient } from "@prisma/client";
import { generateReporterToken } from "@/modules/reports/reporter-token";
import { reportRateLimiter } from "@/modules/reports/rate-limiter";

// Use local PostgreSQL for testing
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://wtg:wtg_local_test@127.0.0.1:55432/wtg_downdetector",
    },
  },
});

// Mock the db module to use test database
vi.mock("@/lib/db", () => ({
  prisma: testPrisma,
}));

describe("POST /api/reports", () => {
  const serviceId = "00000000-0000-0000-0000-000000000001";
  const hmacSecret = "test-hmac-secret";

  beforeEach(async () => {
    // Reset rate limiter
    reportRateLimiter.reset();

    // Clean database
    await testPrisma.report.deleteMany();
    await testPrisma.reporterCooldown.deleteMany();
    await testPrisma.incident.deleteMany();
    await testPrisma.service.deleteMany();

    // Create a test service
    await testPrisma.service.create({
      data: {
        id: serviceId,
        name: "Test Service",
        slug: "test-service",
        category: "Developer Tools",
        ownerEmail: "team@example.com",
        thresholdCount: 10,
        thresholdWindowMinutes: 10,
        issueTypes: ["UNAVAILABLE", "SLOW"],
        enabled: true,
      },
    });

    // Mock env
    vi.stubEnv("REPORTER_HMAC_SECRET", hmacSecret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid report with existing cookie", async () => {
    const reporterToken = generateReporterToken();
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `wtg-reporter=${reporterToken}`,
      },
      body: JSON.stringify({
        serviceId,
        issueType: "SLOW",
        note: "Very slow today",
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      ok: true,
      serviceState: "OPERATIONAL",
    });
    expect(data.nextAllowedAt).toBeDefined();
  });

  it("generates cookie and accepts report when cookie is absent", async () => {
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serviceId,
        issueType: "UNAVAILABLE",
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      ok: true,
      serviceState: "OPERATIONAL",
    });

    // Check that cookie was set
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("wtg-reporter=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=31536000"); // 1 year
  });

  it("rejects malformed JSON", async () => {
    const reporterToken = generateReporterToken();
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `wtg-reporter=${reporterToken}`,
      },
      body: "not valid json{",
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      code: "INVALID_REPORT",
    });
  });

  it("rejects unknown service", async () => {
    const reporterToken = generateReporterToken();
    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `wtg-reporter=${reporterToken}`,
      },
      body: JSON.stringify({
        serviceId: "00000000-0000-0000-0000-000000000099",
        issueType: "SLOW",
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      ok: false,
      code: "INVALID_REPORT",
    });
  });

  it("rejects duplicate report within cooldown window", async () => {
    const reporterToken = generateReporterToken();

    // First report
    const firstRequest = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `wtg-reporter=${reporterToken}`,
      },
      body: JSON.stringify({
        serviceId,
        issueType: "SLOW",
      }),
    }) as any;

    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(200);

    // Duplicate report
    const secondRequest = new Request("http://localhost/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `wtg-reporter=${reporterToken}`,
      },
      body: JSON.stringify({
        serviceId,
        issueType: "UNAVAILABLE", // Different issue type
      }),
    }) as any;

    const secondResponse = await POST(secondRequest);
    const data = await secondResponse.json();

    expect(secondResponse.status).toBe(429);
    expect(data).toMatchObject({
      ok: false,
      code: "DUPLICATE_REPORT",
    });
    expect(data.nextAllowedAt).toBeDefined();
  });
});
