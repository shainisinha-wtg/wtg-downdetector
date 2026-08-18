import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/modules/auth/password";
import { createSession } from "@/modules/auth/session";
import { ADMIN_COOKIE_NAME } from "@/modules/auth/require-admin";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Find account
    const account = await prisma.adminAccount.findUnique({
      where: { username },
    });

    if (!account || !account.enabled) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
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
        { status: 401 }
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
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }
}
