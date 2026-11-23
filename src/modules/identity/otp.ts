import "server-only";

import { randomOtp, safeEqualHex, sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { EmailTokenPurpose, Prisma } from "@/lib/db-types";
import { env } from "@/lib/env";

/** OTP kuralları — AUTH-EMAIL §2. */
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

type Tx = Prisma.TransactionClient;

export function otpHash(code: string, email: string): string {
  return sha256(`${code}${email}${env.SESSION_SECRET}`);
}

/**
 * Yeni OTP üretir; aynı adres+amaç için açık kodları `usedAt` ile kapatır.
 * Düz kodu döner (yalnızca maile yazılır, saklanmaz).
 */
export async function issueOtp(
  tx: Tx,
  input: { email: string; purpose: EmailTokenPurpose; userId: string | null },
): Promise<string> {
  const now = new Date();
  await tx.emailToken.updateMany({
    where: { email: input.email, purpose: input.purpose, usedAt: null },
    data: { usedAt: now },
  });
  const code = randomOtp();
  await tx.emailToken.create({
    data: {
      email: input.email,
      purpose: input.purpose,
      userId: input.userId,
      codeHash: otpHash(code, input.email),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });
  return code;
}

export type OtpResult = { status: "ok"; userId: string | null } | { status: "invalid" | "expired" | "tooMany" };

/**
 * Kodu doğrular. Her denemede `attempts` atomik artırılır; 5. yanlışta kod iptal edilir.
 * Başarıda kod tek kullanımlık olarak kapatılır.
 */
export async function consumeOtp(input: { email: string; purpose: EmailTokenPurpose; code: string }): Promise<OtpResult> {
  const token = await db.emailToken.findFirst({
    where: { email: input.email, purpose: input.purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { status: "expired" };
  if (token.expiresAt.getTime() <= Date.now()) return { status: "expired" };

  // Eşzamanlı denemelerde sınırı aşmamak için koşullu artırım.
  const bumped = await db.emailToken.updateMany({
    where: { id: token.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) return { status: "tooMany" };

  if (safeEqualHex(otpHash(input.code, input.email), token.codeHash)) {
    const closed = await db.emailToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return closed.count === 1 ? { status: "ok", userId: token.userId } : { status: "expired" };
  }

  if (token.attempts + 1 >= OTP_MAX_ATTEMPTS) {
    await db.emailToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    return { status: "tooMany" };
  }
  return { status: "invalid" };
}
