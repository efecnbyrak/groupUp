import "server-only";

import { db, type Tx } from "@/lib/db";
import type { NotificationType } from "@/lib/db-types";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  titleTr: string;
  titleEn: string;
  bodyTr?: string | null;
  bodyEn?: string | null;
  href?: string | null;
}

/** Uygulama içi bildirim satırı yazar. `tx` verilirse aynı transaction'da, verilmezse `db` ile. */
export async function notify(input: NotifyInput, tx: Pick<Tx, "notification"> = db): Promise<void> {
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      titleTr: input.titleTr,
      titleEn: input.titleEn,
      bodyTr: input.bodyTr ?? null,
      bodyEn: input.bodyEn ?? null,
      href: input.href ?? null,
    },
  });
}

/** Birden fazla kullanıcıya aynı bildirim (örn. maç saati tüm katılımcılara). */
export async function notifyMany(userIds: string[], data: Omit<NotifyInput, "userId">, tx: Pick<Tx, "notification"> = db): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: data.type,
      titleTr: data.titleTr,
      titleEn: data.titleEn,
      bodyTr: data.bodyTr ?? null,
      bodyEn: data.bodyEn ?? null,
      href: data.href ?? null,
    })),
  });
}

const PAGE_SIZE = 20;

export async function listNotifications(userId: string, cursor?: string) {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > PAGE_SIZE;
  return { items: hasMore ? rows.slice(0, PAGE_SIZE) : rows, nextCursor: hasMore ? rows[PAGE_SIZE - 1]!.id : null };
}

/** Header zili: son N bildirim + okunmamış sayısı (tek sorgu yerine iki — sayaç ayrı index kullanır). */
export async function recentNotifications(userId: string, limit = 6) {
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
