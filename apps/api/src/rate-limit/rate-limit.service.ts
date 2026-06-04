import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertAllowed(key: string, rule: RateLimitRule): void {
    const now = Date.now();
    const bucketKey = `${rule.name}:${key.trim() || "anonymous"}`;
    const bucket = this.buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + rule.windowMs
      });
      this.cleanupExpiredBuckets(now);
      return;
    }

    if (bucket.count >= rule.limit) {
      throw new HttpException(
        `Rate limit exceeded. Try again in ${Math.ceil(
          (bucket.resetAt - now) / 1000
        )} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    bucket.count += 1;
  }

  private cleanupExpiredBuckets(now: number) {
    if (this.buckets.size < 5_000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
