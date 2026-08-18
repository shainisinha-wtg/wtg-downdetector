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
   */
  isLimited(ip: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(ip);

    if (!entry) {
      this.limits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    if (now > entry.resetAt) {
      // Window expired, reset
      this.limits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * Get the time when the limit will reset for an IP.
   * Returns null if no limit is active.
   */
  getResetTime(ip: string): Date | null {
    const entry = this.limits.get(ip);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.resetAt) return null;

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

// Global instance for single-pod deployment
// In production with multiple pods, use distributed rate limiting at ingress (nginx, etc.)
export const reportRateLimiter = new InMemoryRateLimiter(5, 60_000); // 5 requests per minute

// Periodic cleanup (run every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      reportRateLimiter.cleanup();
    },
    5 * 60 * 1000
  );
}
