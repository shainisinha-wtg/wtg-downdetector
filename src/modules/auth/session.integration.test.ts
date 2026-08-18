import { describe, it, expect, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { createSession, getSessionAccount, revokeSession } from "./session";
import { verifyPassword } from "./password";

describe("Auth Module Integration", () => {
  beforeEach(async () => {
    await prisma.adminSession.deleteMany();
    await prisma.adminAccount.deleteMany();
  });

  describe("Password hashing", () => {
    it("hashes passwords with Argon2id", async () => {
      const password = "strong-password-123";
      const { hash: storedHash } = await verifyPassword(password, null);

      // Verify it's an Argon2id hash
      expect(storedHash).toMatch(/^\$argon2id\$/);

      // Verify we can verify the password
      const { verified } = await verifyPassword(password, storedHash);
      expect(verified).toBe(true);

      // Verify wrong password fails
      const { verified: wrongVerified } = await verifyPassword(
        "wrong-password",
        storedHash
      );
      expect(wrongVerified).toBe(false);
    });
  });

  describe("Session token security", () => {
    it("stores only SHA-256 hashed tokens in database", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
        },
      });

      const { token } = await createSession(account.id);

      // Token should be 32 bytes = 64 hex chars
      expect(token).toMatch(/^[a-f0-9]{64}$/);

      // Database should contain hash, not raw token
      const dbSession = await prisma.adminSession.findFirst({
        where: { accountId: account.id },
      });
      expect(dbSession).toBeTruthy();
      expect(dbSession!.tokenHash).not.toBe(token);
      expect(dbSession!.tokenHash).toMatch(/^[a-f0-9]{64}$/);

      // Should be able to retrieve account with token
      const retrieved = await getSessionAccount(token);
      expect(retrieved?.id).toBe(account.id);
    });

    it("enforces 8-hour session duration", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
        },
      });

      const { expiresAt } = await createSession(account.id);

      // Should expire in 8 hours
      const now = new Date();
      const eightHours = 8 * 60 * 60 * 1000;
      const expectedExpiry = new Date(now.getTime() + eightHours);
      const timeDiff = Math.abs(
        expiresAt.getTime() - expectedExpiry.getTime()
      );
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it("rejects expired sessions", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
        },
      });

      // Create session that's already expired
      await prisma.adminSession.create({
        data: {
          accountId: account.id,
          tokenHash: "0".repeat(64),
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      const retrieved = await getSessionAccount("0".repeat(64));
      expect(retrieved).toBeNull();
    });

    it("rejects revoked sessions", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
        },
      });

      const { token } = await createSession(account.id);

      // Verify session works
      let retrieved = await getSessionAccount(token);
      expect(retrieved?.id).toBe(account.id);

      // Revoke session
      await revokeSession(token);

      // Should no longer work
      retrieved = await getSessionAccount(token);
      expect(retrieved).toBeNull();
    });

    it("rejects sessions for disabled accounts", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
          enabled: true,
        },
      });

      const { token } = await createSession(account.id);

      // Verify session works
      let retrieved = await getSessionAccount(token);
      expect(retrieved?.id).toBe(account.id);

      // Disable account
      await prisma.adminAccount.update({
        where: { id: account.id },
        data: { enabled: false },
      });

      // Should no longer work
      retrieved = await getSessionAccount(token);
      expect(retrieved).toBeNull();
    });

    it("revokes session by raw token during logout", async () => {
      const account = await prisma.adminAccount.create({
        data: {
          username: "testadmin",
          passwordHash: await argon2.hash("password", { type: argon2.argon2id }),
          displayName: "Test Admin",
        },
      });

      const { token } = await createSession(account.id);

      // Verify session works
      const retrieved = await getSessionAccount(token);
      expect(retrieved?.id).toBe(account.id);

      // Revoke via raw token (logout use case)
      await revokeSession(token);

      // Session should be revoked in DB
      const dbSession = await prisma.adminSession.findFirst({
        where: { accountId: account.id },
      });
      expect(dbSession?.revokedAt).not.toBeNull();

      // getSessionAccount should return null
      const afterLogout = await getSessionAccount(token);
      expect(afterLogout).toBeNull();
    });
  });
});
