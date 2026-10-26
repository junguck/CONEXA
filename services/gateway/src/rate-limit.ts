export interface LimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Limiteur à fenêtre fixe en mémoire. Redis prendra le relais quand plusieurs
 * instances tourneront (STACK.md §5) ; l'interface ne changera pas.
 */
export class FixedWindowLimiter {
  private readonly buckets = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): LimitDecision {
    const current = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || current - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { windowStart: current, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (bucket.count >= this.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.windowStart + this.windowMs - current) / 1000),
      );
      return { allowed: false, retryAfterSeconds };
    }

    bucket.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}
