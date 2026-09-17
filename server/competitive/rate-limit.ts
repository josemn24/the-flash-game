import "server-only";

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const capacity = 5;
const refillPerSecond = 0.5;
const buckets = new Map<string, Bucket>();
const adminCapacity = 10;
const adminRefillPerSecond = 10 / 60;
const adminBuckets = new Map<string, Bucket>();

export class CompetitiveRateLimitError extends Error {
  readonly code = "rate_limited";
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "CompetitiveRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function consumeCompetitiveRateLimit(key: string, now = Date.now()): { remaining: number } {
  const previous = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1000;
  const tokens = Math.min(capacity, previous.tokens + elapsedSeconds * refillPerSecond);

  if (tokens < 1) {
    const retryAfterSeconds = Math.max(1, Math.ceil((1 - tokens) / refillPerSecond));
    buckets.set(key, { tokens, updatedAt: now });
    throw new CompetitiveRateLimitError(retryAfterSeconds);
  }

  const next = { tokens: tokens - 1, updatedAt: now };
  buckets.set(key, next);

  if (buckets.size > 1000) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.updatedAt > 120_000) buckets.delete(bucketKey);
    }
  }

  return { remaining: Math.floor(next.tokens) };
}

export function resetCompetitiveRateLimitForTests() {
  buckets.clear();
  adminBuckets.clear();
}

export function consumeAdminRateLimit(key: string, now = Date.now()): { remaining: number } {
  const previous = adminBuckets.get(key) ?? { tokens: adminCapacity, updatedAt: now };
  const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1000;
  const tokens = Math.min(adminCapacity, previous.tokens + elapsedSeconds * adminRefillPerSecond);

  if (tokens < 1) {
    const retryAfterSeconds = Math.max(1, Math.ceil((1 - tokens) / adminRefillPerSecond));
    adminBuckets.set(key, { tokens, updatedAt: now });
    throw new CompetitiveRateLimitError(retryAfterSeconds);
  }

  const next = { tokens: tokens - 1, updatedAt: now };
  adminBuckets.set(key, next);
  return { remaining: Math.floor(next.tokens) };
}
