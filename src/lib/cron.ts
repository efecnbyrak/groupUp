import "server-only";

import { safeEqualHex, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

/** Cron route'ları için yetki kontrolü — `requireUser()` yerine geçer (DEPLOYMENT §Cron, `CRON_SECRET`). */
export function isValidCronRequest(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  return safeEqualHex(sha256(token), sha256(env.CRON_SECRET));
}
