import { describe, expect, it } from "vitest";

import { isValidCronRequest } from "@/lib/cron";
import { env } from "@/lib/env";

describe("isValidCronRequest", () => {
  it("doğru Bearer token ile true döner", () => {
    const req = new Request("http://localhost/api/cron/daily", { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    expect(isValidCronRequest(req)).toBe(true);
  });

  it("yanlış token, eksik header veya yanlış şema ile false döner", () => {
    expect(isValidCronRequest(new Request("http://localhost/api/cron/daily", { headers: { authorization: "Bearer yanlis" } }))).toBe(false);
    expect(isValidCronRequest(new Request("http://localhost/api/cron/daily"))).toBe(false);
    expect(isValidCronRequest(new Request("http://localhost/api/cron/daily", { headers: { authorization: env.CRON_SECRET } }))).toBe(false);
  });
});
