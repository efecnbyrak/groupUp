import "server-only";

import { cookies } from "next/headers";

import { hmacSha256, safeEqualHex } from "@/lib/crypto";
import { env } from "@/lib/env";

/**
 * `/dogrula` sayfasının hangi adresi doğruladığını taşıyan imzalı cookie (30 dk).
 * Yalnızca adresi taşır; doğrulama yine OTP koduyla yapılır.
 */
const VERIFY_COOKIE = "gu_verify";
const TTL_SEC = 30 * 60;

const sign = (email: string) => hmacSha256(env.SESSION_SECRET, `verify:${email}`);

export async function setPendingVerification(email: string): Promise<void> {
  const value = `${Buffer.from(email).toString("base64url")}.${sign(email)}`;
  (await cookies()).set(VERIFY_COOKIE, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SEC,
  });
}

export async function getPendingVerification(): Promise<string | null> {
  const raw = (await cookies()).get(VERIFY_COOKIE)?.value;
  if (!raw) return null;
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  return safeEqualHex(sign(email), signature) ? email : null;
}

export async function clearPendingVerification(): Promise<void> {
  (await cookies()).delete(VERIFY_COOKIE);
}
