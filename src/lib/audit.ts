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
