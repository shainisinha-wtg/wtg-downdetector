import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const SESSION_DURATION_HOURS = 8;

/**
 * Get secure cookie options for admin session cookies.
 *
 * IMPORTANT: Secure flag is only disabled in test environment to allow automated
 * HTTP-based route testing. Production and development environments must use HTTPS.
 * This is an explicit test-only exemption, not a runtime security trade-off.
 */
export function getAdminCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "test",
    sameSite: "lax" as const,
    expires: expiresAt,
    path: "/",
  };
}

/**
 * Generate a 32-byte random token and return both raw and SHA-256 hash
 */
function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/**
 * Create a new session for an admin account
 * Returns the raw token (to be sent in cookie) and expiry timestamp
 */
export async function createSession(
  accountId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
  );

  await prisma.adminSession.create({
    data: {
      accountId,
      tokenHash: hash,
      expiresAt,
    },
  });

  return { token: raw, expiresAt };
}

/**
 * Retrieve the admin account associated with a session token
 * Returns null if session is invalid, expired, revoked, or account disabled
 */
export async function getSessionAccount(
  token: string,
): Promise<{ id: string; username: string; displayName: string } | null> {
  const hash = createHash("sha256").update(token).digest("hex");

  const session = await prisma.adminSession.findFirst({
    where: {
      tokenHash: hash,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
    include: {
      account: true,
    },
  });

  if (!session || !session.account.enabled) {
    return null;
  }

  return {
    id: session.account.id,
    username: session.account.username,
    displayName: session.account.displayName,
  };
}

/**
 * Revoke a session by token
 */
export async function revokeSession(token: string): Promise<void> {
  const hash = createHash("sha256").update(token).digest("hex");

  await prisma.adminSession.updateMany({
    where: { tokenHash: hash },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all sessions for an account
 */
export async function revokeAllSessions(accountId: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { accountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
