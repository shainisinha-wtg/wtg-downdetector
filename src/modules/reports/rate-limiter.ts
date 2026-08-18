/**
 * In-memory per-IP rate limiter for report submissions.
 * Suitable for single-pod development. Production requires ingress-level distributed rate limiting.
 *
 * WARNING: Do not persist raw IP addresses. This limiter uses IP only for transient rate limiting
 * and does not log or store IP addresses in the database.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
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
   * Production deployments should use distributed rate limiting (Redis, ingress-level)
   * instead of this in-memory limiter.
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
 *
 * IMPORTANT: This in-memory limiter is suitable for development only.
 * Production requires distributed rate limiting:
 * - Use Redis-backed rate limiting for multi-pod deployments
 * - Or configure ingress-level rate limiting (nginx, API gateway)
 *
 * Memory is bounded through opportunistic cleanup in isLimited/getResetTime.
 * Call cleanup() manually if needed, or use test-only reset().
 */
export const reportRateLimiter = new InMemoryRateLimiter(5, 60_000); // 5 requests per minute
