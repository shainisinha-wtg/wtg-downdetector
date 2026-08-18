import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/modules/auth/password";
import { createSession, getAdminCookieOptions } from "@/modules/auth/session";
import { ADMIN_COOKIE_NAME } from "@/modules/auth/require-admin";
import { loginRateLimiter } from "@/modules/auth/login-rate-limiter";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Extract IP for rate limiting (assumes trusted ingress)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    if (loginRateLimiter.isLimited(ip)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Find account
    const account = await prisma.adminAccount.findUnique({
      where: { username },
    });

    if (!account || !account.enabled) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify password
    const { verified } = await verifyPassword(password, account.passwordHash);

    if (!verified) {
      // Create audit event for failed login
      await prisma.auditEvent.create({
        data: {
          accountId: account.id,
          action: "LOGIN_FAILED",
          metadata: { username },
        },
      });

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Create session
    const { token, expiresAt } = await createSession(account.id);

    // Create audit event for successful login
    await prisma.auditEvent.create({
      data: {
        accountId: account.id,
        action: "LOGIN_SUCCESS",
        metadata: { username },
      },
    });

    // Set secure HTTP-only cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set(
      ADMIN_COOKIE_NAME,
      token,
      getAdminCookieOptions(expiresAt),
    );

    return response;
  } catch {
    // Sanitized error logging - no sensitive data
    console.error("Login error occurred");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
