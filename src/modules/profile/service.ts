import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { detectFileType, MB } from "@/lib/file-type";
import { toAvatarWebp } from "@/lib/images";
import { getStorage, newFileKey } from "@/lib/storage";

import type { ProfileUpdateInput } from "./schemas";

/** profile modülü — profil görüntüleme/düzenleme, avatar. (Mezun doğrulama: alumni.ts) */
export type ProfileErrorCode = "INVALID_FIELDS" | "FILE_TOO_LARGE" | "FILE_TYPE" | "FILE_INVALID" | "NOT_FOUND";
export const fail = (code: ProfileErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);

export const AVATAR_MAX_BYTES = 5 * MB;

interface Actor {
  id: string;
}

/** Kendi profili: kullanıcı + profil + üniversite/fakülte/bölüm adları. */
export function getOwnProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      type: true,
      universityId: true,
      university: { select: { name: true } },
      profile: {
        include: {
          faculty: { select: { id: true, nameTr: true, nameEn: true } },
          department: { select: { id: true, nameTr: true, nameEn: true } },
        },
      },
    },
  });
}

export async function updateProfile(actor: Actor, input: ProfileUpdateInput): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { type: true, universityId: true } });
  const fields: Record<string, string> = {};
  // Bölüm, kullanıcının üniversitesine ait olmalı (tenant izolasyonu); fakülte bölümden türetilir.
  const department = user.universityId
    ? await db.department.findFirst({ where: { id: input.departmentId, faculty: { universityId: user.universityId } }, select: { facultyId: true } })
    : null;
  if (!department) fields.departmentId = "validation.department";
  if (user.type === "STUDENT" && input.classYear === undefined) fields.classYear = "validation.classYear";
  if (user.type === "ALUMNI" && input.graduationYear === undefined) fields.graduationYear = "validation.graduationYear";
  if (!department || Object.keys(fields).length > 0) throw fail("INVALID_FIELDS", fields);

  await db.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId: actor.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        studentNo: input.studentNo,
        facultyId: department.facultyId,
        departmentId: input.departmentId,
        classYear: user.type === "STUDENT" ? (input.classYear ?? null) : null,
        graduationYear: user.type === "ALUMNI" ? (input.graduationYear ?? null) : null,
        phone: input.phone,
        gender: input.gender,
        birthDate: input.birthDate,
        bio: input.bio ?? null,
      },
    });
    await audit({ action: "profile.updated", targetType: "User", targetId: actor.id, actorId: actor.id, universityId: user.universityId }, tx);
  });
}

/**
 * Avatar: gerçek tip magic byte ile (JPEG/PNG/WebP) → 256×256 WebP, EXIF silinir →
 * public storage. Eski dosya DB güncellendikten sonra silinir.
 */
export async function setAvatar(actor: Actor, file: Buffer): Promise<string> {
  if (file.byteLength === 0) throw fail("FILE_INVALID");
  if (file.byteLength > AVATAR_MAX_BYTES) throw fail("FILE_TOO_LARGE");
  const type = detectFileType(file);
  if (!type || type.ext === "pdf") throw fail("FILE_TYPE");
  let webp: Buffer;
  try {
    webp = await toAvatarWebp(file);
  } catch {
    throw fail("FILE_INVALID");
  }
  const storage = getStorage();
  const key = newFileKey("avatars", actor.id, "webp");
  await storage.put(key, webp, "public");
  const previous = await db.profile.findUniqueOrThrow({ where: { userId: actor.id }, select: { avatarKey: true } });
  await db.$transaction(async (tx) => {
    await tx.profile.update({ where: { userId: actor.id }, data: { avatarKey: key } });
    await audit({ action: "profile.avatar.updated", targetType: "User", targetId: actor.id, actorId: actor.id }, tx);
  });
  if (previous.avatarKey) await storage.delete(previous.avatarKey, "public");
  return key;
}

export async function removeAvatar(actor: Actor): Promise<void> {
  const previous = await db.profile.findUniqueOrThrow({ where: { userId: actor.id }, select: { avatarKey: true } });
  if (!previous.avatarKey) return;
  await db.$transaction(async (tx) => {
    await tx.profile.update({ where: { userId: actor.id }, data: { avatarKey: null } });
    await audit({ action: "profile.avatar.removed", targetType: "User", targetId: actor.id, actorId: actor.id }, tx);
  });
  await getStorage().delete(previous.avatarKey, "public");
}

/**
 * Hesap silme (identity çağırır, aynı transaction): kişisel veriler anonimleştirilir,
 * mezun belgesi kaydı silinir. Silinecek dosya anahtarları döner (commit sonrası silinir).
 */
export async function anonymizeProfileForDeletion(tx: Tx, userId: string): Promise<{ publicKeys: string[]; privateKeys: string[] }> {
  const profile = await tx.profile.findUnique({ where: { userId }, select: { avatarKey: true } });
  const alumni = await tx.alumniVerification.findUnique({ where: { userId }, select: { storageKey: true } });
  if (profile) {
    await tx.profile.update({
      where: { userId },
      data: {
        firstName: "Silinmiş",
        lastName: "kullanıcı",
        studentNo: null,
        facultyId: null,
        departmentId: null,
        classYear: null,
        graduationYear: null,
        phone: null,
        gender: null,
        birthDate: null,
        avatarKey: null,
        bio: null,
      },
    });
  }
  if (alumni) await tx.alumniVerification.delete({ where: { userId } });
  return { publicKeys: profile?.avatarKey ? [profile.avatarKey] : [], privateKeys: alumni ? [alumni.storageKey] : [] };
}
