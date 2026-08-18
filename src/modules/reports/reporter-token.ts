import { randomBytes, createHmac } from "crypto";

const MINIMUM_TOKEN_BYTES = 16; // 128 bits

/**
 * Generates a cryptographically random reporter token with at least 128 bits entropy.
 * Token is returned as a URL-safe base64 string.
 */
export function generateReporterToken(): string {
  const tokenBytes = randomBytes(MINIMUM_TOKEN_BYTES);
  return tokenBytes.toString("base64url");
}

/**
 * Computes the HMAC-SHA256 hash of a reporter token using the provided secret.
 * Returns hex-encoded hash.
 */
export function hashReporterToken(token: string, secret: string): string {
  if (!secret) {
    throw new Error("REPORTER_HMAC_SECRET is required");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Validates that a token has sufficient entropy (at least 128 bits).
 * Tokens are base64url encoded, so minimum length is 22 characters for 128 bits.
 */
export function isValidReporterToken(token: string): boolean {
  // Base64url encoding: 128 bits = 16 bytes = 22 characters (with padding removed)
  const MIN_LENGTH = 22;
  return token.length >= MIN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token);
}
