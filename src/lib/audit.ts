import "server-only";

import type { Prisma } from "../../prisma/generated/client";
import { db } from "./db";

export interface AuditEntry {
  action: string; // "<modül>.<nesne>.<olay>" ör. "identity.user.registered"
  targetType: string;
  targetId: string;
  actorId?: string | null;
  universityId?: string | null;
  meta?: Prisma.InputJsonValue;
}

type AuditClient = Pick<typeof db, "auditLog">;

/** Kritik işlemleri AuditLog'a yazar. Transaction içinde `tx` verilebilir. */
export async function audit(entry: AuditEntry, client: AuditClient = db): Promise<void> {
  await client.auditLog.create({
    data: {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      actorId: entry.actorId ?? null,
      universityId: entry.universityId ?? null,
      meta: entry.meta,
    },
  });
}

export const AUDIT_PAGE_SIZE = 50;

/** Admin "Denetim kaydı": üniversitenin kayıtları, yeniden eskiye (cursor). Aktör adıyla. */
export async function listAuditLogs(universityId: string, filter: { prefix?: string; cursor?: string } = {}) {
  const rows = await db.auditLog.findMany({
    where: { universityId, ...(filter.prefix ? { action: { startsWith: filter.prefix } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: { id: true, action: true, targetType: true, targetId: true, actorId: true, createdAt: true },
  });
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  const actorIds = [...new Set(items.map((r) => r.actorId).filter((v): v is string => Boolean(v)))];
  const actors = new Map(
    (await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } })).map((u) => [
      u.id,
      [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || u.email,
    ]),
  );
  return { items: items.map((r) => ({ ...r, actorName: r.actorId ? (actors.get(r.actorId) ?? "—") : null })), nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}
