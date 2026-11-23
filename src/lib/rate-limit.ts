import "server-only";

import { db } from "./db";
import { RateLimitError } from "./errors";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Sabit pencereli sayaç (ADR-0008: Postgres, Redis yok). Tek atomik upsert:
 * pencere bitmişse sayaç 1'e sıfırlanır, değilse artırılır.
 */
export async function consumeRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; windowEnd: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowEnd")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"     = CASE WHEN "RateLimit"."windowEnd" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowEnd" = CASE WHEN "RateLimit"."windowEnd" <= now()
                         THEN now() + make_interval(secs => ${windowSec})
                         ELSE "RateLimit"."windowEnd" END
    RETURNING "count", "windowEnd"`;
  const row = rows[0];
  if (!row) throw new Error("rate limit upsert sonuç döndürmedi");
  const retryAfterSec = Math.max(0, Math.ceil((row.windowEnd.getTime() - Date.now()) / 1000));
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfterSec };
}

/** Birden çok kuralı sırayla uygular; ilk aşılan kuralda durur. */
export async function consumeRateLimits(
  rules: { key: string; limit: number; windowSec: number }[],
): Promise<RateLimitResult> {
  let last: RateLimitResult = { ok: true, remaining: Infinity, retryAfterSec: 0 };
  for (const rule of rules) {
    last = await consumeRateLimit(rule.key, rule.limit, rule.windowSec);
    if (!last.ok) return last;
  }
  return last;
}

/** Kurallardan biri aşılmışsa `RateLimitError` fırlatır. */
export async function enforceRateLimits(rules: { key: string; limit: number; windowSec: number }[]): Promise<void> {
  const result = await consumeRateLimits(rules);
  if (!result.ok) throw new RateLimitError(result.retryAfterSec);
}
