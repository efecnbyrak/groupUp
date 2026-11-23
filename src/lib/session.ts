import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import type { PlatformRole, UserStatus, UserType } from "../../prisma/generated/client";
import { randomToken, sha256 } from "./crypto";
import { db } from "./db";
import { env } from "./env";

// AUTH-EMAIL §4
export const SESSION_COOKIE = "gu_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTEND_WHEN_LEFT_MS = 15 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionUser {
  sessionId: string;
  id: string;
  email: string;
  platformRole: PlatformRole;
  type: UserType;
  status: UserStatus;
  emailVerified: boolean;
  universityId: string | null;
  locale: string;
  firstName: string | null;
  lastName: string | null;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

function summarizeUserAgent(ua: string | null): string | null {
  return ua ? ua.slice(0, 200) : null;
}

async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return {
    userAgent: summarizeUserAgent(h.get("user-agent")),
    ipHash: ip ? sha256(`${ip}:${env.SESSION_SECRET}`) : null,
  };
}

/** IP'nin tuzlu hash'i — rate limit anahtarları için (ham IP saklanmaz). */
export async function currentIpKey(): Promise<string> {
  return (await requestMeta()).ipHash ?? "unknown";
}

/** Oturum açar ve cookie'yi yazar. Yalnızca Server Action / Route Handler içinde. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await requestMeta();
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt, ...meta },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** İstek başına bir kez çözülür (React cache). Geçersiz/süresi dolmuşsa null. */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { profile: { select: { firstName: true, lastName: true } } } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.deletedAt || session.user.status === "DELETED") return null;

  // Yazma yükünü düşük tut: en fazla saatte bir dokun; 15 günden az kaldıysa uzat.
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    const extend = session.expiresAt.getTime() - now < EXTEND_WHEN_LEFT_MS;
    const expiresAt = extend ? new Date(now + SESSION_TTL_MS) : session.expiresAt;
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt } });
    if (extend) {
      // Server Component'te cookie yazılamaz; o durumda DB süresi uzar, cookie bir sonraki action'da yenilenir.
      try {
        (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
      } catch {
        /* RSC bağlamı */
      }
    }
  }

  const { user } = session;
  return {
    sessionId: session.id,
    id: user.id,
    email: user.email,
    platformRole: user.platformRole,
    type: user.type,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    universityId: user.universityId,
    locale: user.locale,
    firstName: user.profile?.firstName ?? null,
    lastName: user.profile?.lastName ?? null,
  };
});

/** Mevcut oturumu kapatır (çıkış). */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

/** Kullanıcının tüm oturumlarını kapatır; `exceptSessionId` verilirse o hariç. */
export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return count;
}
