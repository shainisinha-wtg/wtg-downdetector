import * as argon2 from "argon2";

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Verify a password against a hash, or return a new hash if null
 * Used for both login verification and initial hash generation
 */
export async function verifyPassword(
  password: string,
  hash: string | null
): Promise<{ verified: boolean; hash: string }> {
  if (hash === null) {
    // Generate new hash for first-time setup
    const newHash = await hashPassword(password);
    return { verified: true, hash: newHash };
  }

  try {
    const verified = await argon2.verify(hash, password);
    return { verified, hash };
  } catch {
    return { verified: false, hash };
  }
}
