import { NextRequest, NextResponse } from "next/server";
import {
  submitReport,
  DuplicateReportError,
  InvalidServiceError,
} from "@/modules/reports/report-intake";
import { generateReporterToken } from "@/modules/reports/reporter-token";
import { reportRateLimiter } from "@/modules/reports/rate-limiter";
import { ZodError } from "zod";

type ReportResponse =
  | { ok: true; nextAllowedAt: string; serviceState: string }
  | {
      ok: false;
      code: "INVALID_REPORT" | "DUPLICATE_REPORT" | "RATE_LIMITED";
      nextAllowedAt?: string;
    };

/**
 * Extract client IP from request headers.
 * Respects X-Forwarded-For if present (assumes trusted ingress).
 * Production deployment should configure ingress to set X-Forwarded-For reliably.
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  // Fallback for development (NextRequest doesn't expose ip directly)
  return "unknown";
}

export async function POST(request: NextRequest): Promise<NextResponse<ReportResponse>> {
  const hmacSecret = process.env.REPORTER_HMAC_SECRET;
  if (!hmacSecret) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REPORT" },
      { status: 500 }
    );
  }

  // Check rate limiting
  const clientIp = getClientIp(request);
  if (reportRateLimiter.isLimited(clientIp)) {
    const resetTime = reportRateLimiter.getResetTime(clientIp);
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        nextAllowedAt: resetTime?.toISOString(),
      },
      { status: 429 }
    );
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_REPORT" },
      { status: 400 }
    );
  }

  // Get or generate reporter token
  let cookieToken: string | undefined;

  // Handle both NextRequest (production) and Request (tests)
  if ("cookies" in request && typeof request.cookies.get === "function") {
    cookieToken = request.cookies.get("wtg-reporter")?.value;
  } else {
    // Parse cookies from header for tests
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/wtg-reporter=([^;]+)/);
      cookieToken = match?.[1];
    }
  }

  let reporterToken = cookieToken;
  let shouldSetCookie = false;

  if (!cookieToken) {
    reporterToken = generateReporterToken();
    shouldSetCookie = true;
  }

  // Submit report
  try {
    const receipt = await submitReport(body, reporterToken!, hmacSecret);

    const response = NextResponse.json<ReportResponse>(
      {
        ok: true as const,
        nextAllowedAt: receipt.nextAllowedAt.toISOString(),
        serviceState: receipt.serviceState,
      },
      { status: 200 }
    );

    // Set cookie if it was generated
    if (shouldSetCookie) {
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = [
        `wtg-reporter=${reporterToken}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        "Max-Age=31536000", // 1 year
      ];

      if (isProduction) {
        cookieOptions.push("Secure");
      }

      response.headers.set("Set-Cookie", cookieOptions.join("; "));
    }

    return response;
  } catch (error) {
    // Handle duplicate report
    if (error instanceof DuplicateReportError) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE_REPORT",
          nextAllowedAt: error.nextAllowedAt.toISOString(),
        },
        { status: 429 }
      );
    }

    // Handle validation errors and invalid service selections.
    if (error instanceof ZodError || error instanceof InvalidServiceError) {
      return NextResponse.json(
        { ok: false, code: "INVALID_REPORT" },
        { status: 400 }
      );
    }

    // Unknown error
    return NextResponse.json(
      { ok: false, code: "INVALID_REPORT" },
      { status: 500 }
    );
  }
}
