import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { detectFileType, MB, safeFileName } from "@/lib/file-type";
import { getStorage, newFileKey } from "@/lib/storage";

import { fail } from "./service";

/**
 * Manuel mezun doğrulama — belge yükleme (AUTH-EMAIL §6). PDF/JPG/PNG ≤ 10 MB, private storage.
 * Karar (onay/ret) F5'te onay motoruyla (ChangeRequest ALUMNI_VERIFY) verilir.
 */
export const ALUMNI_DOC_MAX_BYTES = 10 * MB;
const ALLOWED = new Set(["pdf", "jpg", "png"]);

export function getAlumniVerification(userId: string) {
  return db.alumniVerification.findUnique({
    where: { userId },
    select: { status: true, fileName: true, submittedAt: true, rejectReason: true },
  });
}

/** İlk yükleme veya ret/yenileme sonrası yeniden yükleme: kayıt PENDING'e döner, eski dosya silinir. */
export async function submitAlumniDocument(actor: { id: string }, file: Buffer, originalName: string): Promise<void> {
  if (file.byteLength === 0) throw fail("FILE_INVALID");
  if (file.byteLength > ALUMNI_DOC_MAX_BYTES) throw fail("FILE_TOO_LARGE");
  const type = detectFileType(file);
  if (!type || !ALLOWED.has(type.ext)) throw fail("FILE_TYPE");

  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { universityId: true, status: true } });
  if (!user.universityId || user.status !== "PENDING_ALUMNI_REVIEW") throw fail("NOT_FOUND");

  const storage = getStorage();
  const key = newFileKey("alumni", actor.id, type.ext);
  await storage.put(key, file, "private");
  const previous = await db.alumniVerification.findUnique({ where: { userId: actor.id }, select: { storageKey: true } });
  const data = {
    universityId: user.universityId,
    storageKey: key,
    fileName: safeFileName(originalName),
    mimeType: type.mime,
    sizeBytes: file.byteLength,
    status: "PENDING" as const,
    rejectReason: null,
    decidedAt: null,
    submittedAt: new Date(),
  };
  await db.$transaction(async (tx) => {
    await tx.alumniVerification.upsert({ where: { userId: actor.id }, update: data, create: { userId: actor.id, ...data } });
    await audit({ action: "profile.alumni.documentSubmitted", targetType: "User", targetId: actor.id, actorId: actor.id, universityId: user.universityId, meta: { mime: type.mime, size: file.byteLength } }, tx);
  });
  if (previous) await storage.delete(previous.storageKey, "private");
}
