import "server-only";

import { db, type Tx } from "@/lib/db";
import { MB } from "@/lib/file-type";

import { fail } from "./service";

/**
 * Manuel mezun doğrulama durumu (AUTH-EMAIL §6) — profile modülünün `AlumniVerification` kaydı.
 * Belge (Attachment) ve karar (ChangeRequest ALUMNI_VERIFY) approval modülündedir; approval
 * handler'ı aşağıdaki `tx` fonksiyonlarını çağırır.
 */
export const ALUMNI_DOC_MAX_BYTES = 10 * MB;

export function getAlumniVerification(userId: string) {
  return db.alumniVerification.findUnique({
    where: { userId },
    select: { status: true, submittedAt: true, rejectReason: true, changeRequestId: true },
  });
}

/** Belge gönderebilir mi: maili doğrulanmış, PENDING_ALUMNI_REVIEW. Üniversitesini döner. */
export async function assertAlumniCanSubmit(userId: string, client: Tx | typeof db = db): Promise<string> {
  const user = await client.user.findUnique({ where: { id: userId }, select: { universityId: true, status: true } });
  if (!user?.universityId || user.status !== "PENDING_ALUMNI_REVIEW") throw fail("NOT_FOUND");
  return user.universityId;
}

export async function recordAlumniSubmission(tx: Tx, userId: string, universityId: string, changeRequestId: string): Promise<void> {
  const data = { universityId, changeRequestId, status: "PENDING" as const, rejectReason: null, decidedAt: null, submittedAt: new Date() };
  await tx.alumniVerification.upsert({ where: { userId }, update: data, create: { userId, ...data } });
}

export async function recordAlumniDecision(tx: Tx, userId: string, status: "APPROVED" | "REJECTED", reason: string | null): Promise<void> {
  await tx.alumniVerification.update({ where: { userId }, data: { status, rejectReason: status === "REJECTED" ? reason : null, decidedAt: new Date() } });
}
