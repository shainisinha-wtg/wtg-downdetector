/**
 * In-memory login rate limiter.
 *
 * SECURITY NOTES:
 * - Assumes trusted ingress/proxy handles IP forwarding correctly
 * - Does not persist or log raw IP addresses
 * - Suitable for single-pod development; production needs distributed rate limiting
 * - Returns generic 429/invalid responses without exposing rate limit details
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class LoginRateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 5, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if an IP should be rate limited.
   * Returns true if the IP has exceeded the rate limit.
   * Opportunistically cleans up expired entries.
   */
  isLimited(ip: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(ip);

    // Opportunistic cleanup: remove expired entry for this IP
    if (entry && now > entry.resetAt) {
      this.limits.delete(ip);
    }

    const currentEntry = this.limits.get(ip);

    if (!currentEntry) {
      this.limits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    currentEntry.count++;

    if (currentEntry.count > this.maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * Get the time when the limit will reset for an IP.
   * Returns null if no limit is active.
   * Opportunistically cleans up expired entries.
   */
  getResetTime(ip: string): Date | null {
    const now = Date.now();
    const entry = this.limits.get(ip);

    if (!entry) return null;

    // Opportunistic cleanup: remove expired entry
    if (now > entry.resetAt) {
      this.limits.delete(ip);
      return null;
    }

    return new Date(entry.resetAt);
  }

  /**
   * Reset all rate limits. For testing only.
   */
  reset(): void {
    this.limits.clear();
  }

  /**
   * Cleanup expired entries to prevent memory growth.
   * Manual cleanup method - opportunistic cleanup occurs during isLimited/getResetTime.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(ip);
      }
    }
  }
}

/**
 * Global instance for single-pod deployment.
 * 5 login attempts per minute per IP.
 */
export const loginRateLimiter = new LoginRateLimiter(5, 60_000);
