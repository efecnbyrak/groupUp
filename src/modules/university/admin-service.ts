import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { UserStatus, UserType } from "@/lib/db-types";
import { ServiceError } from "@/lib/errors";

import type { UniversityErrorCode } from "./platform-service";
import type { NamesInput } from "./schemas";

/**
 * Üniversite Admini işlemleri. Her fonksiyon `universityId` alır ve TÜM sorgular onunla
 * kapsamlanır: başka üniversitenin kaydı "bulunamadı" gibi davranır (tenant izolasyonu).
 */
const fail = (code: UniversityErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);
const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";

interface Actor {
  id: string;
}

/** Kullanıcının Admin olduğu üniversite (birden çoksa en eskisi). */
export function getAdminUniversity(userId: string) {
  return db.university.findFirst({
    where: { admins: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function isUniversityAdmin(userId: string): Promise<boolean> {
  return (await db.universityAdmin.count({ where: { userId } })) > 0;
}

export async function adminStats(universityId: string) {
  const [students, alumni, faculties, pendingAlumni] = await Promise.all([
    db.user.count({ where: { universityId, type: "STUDENT", status: "ACTIVE" } }),
    db.user.count({ where: { universityId, type: "ALUMNI", status: "ACTIVE" } }),
    db.faculty.count({ where: { universityId } }),
    db.alumniVerification.count({ where: { universityId, status: "PENDING" } }),
  ]);
  return { students, alumni, faculties, pendingAlumni };
}

// ---------------------------------------------------------------- Kullanıcılar

export const USER_PAGE_SIZE = 25;

export interface UserListFilter {
  q?: string;
  type?: UserType;
  status?: UserStatus;
  cursor?: string;
}

/** Cursor sayfalama (createdAt desc, id). Silinmiş hesaplar listelenmez. */
export async function listUniversityUsers(universityId: string, filter: UserListFilter) {
  const q = filter.q?.trim();
  const rows = await db.user.findMany({
    where: {
      universityId,
      deletedAt: null,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : { status: { not: "DELETED" } }),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { profile: { firstName: { contains: q, mode: "insensitive" } } },
              { profile: { lastName: { contains: q, mode: "insensitive" } } },
              { profile: { studentNo: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: USER_PAGE_SIZE + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      email: true,
      type: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      profile: {
        select: { firstName: true, lastName: true, studentNo: true, avatarKey: true, faculty: { select: { nameTr: true, nameEn: true } }, department: { select: { nameTr: true, nameEn: true } } },
      },
    },
  });
  const hasMore = rows.length > USER_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, USER_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

/** Bekleyen manuel mezun doğrulamaları (karar F5'te onay motoruyla). */
export function listPendingAlumni(universityId: string) {
  return db.alumniVerification.findMany({
    where: { universityId, status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    take: 100,
    select: {
      id: true,
      fileName: true,
      submittedAt: true,
      user: { select: { email: true, profile: { select: { firstName: true, lastName: true, graduationYear: true } } } },
    },
  });
}

// ---------------------------------------------------------------- Fakülte / bölüm

export function listFacultiesForAdmin(universityId: string) {
  return db.faculty.findMany({
    where: { universityId },
    orderBy: { nameTr: "asc" },
    select: {
      id: true,
      nameTr: true,
      nameEn: true,
      _count: { select: { profiles: true } },
      departments: { orderBy: { nameTr: "asc" }, select: { id: true, nameTr: true, nameEn: true, _count: { select: { profiles: true } } } },
    },
  });
}

async function withNameGuard<T>(run: () => Promise<T>, field = "nameTr"): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("NAME_TAKEN", { [field]: "university.errors.nameTaken" });
    throw err;
  }
}

export function createFaculty(actor: Actor, universityId: string, input: NamesInput): Promise<void> {
  return withNameGuard(() =>
    db.$transaction(async (tx) => {
      const faculty = await tx.faculty.create({ data: { universityId, nameTr: input.nameTr, nameEn: input.nameEn ?? null }, select: { id: true } });
      await audit({ action: "university.faculty.created", targetType: "Faculty", targetId: faculty.id, actorId: actor.id, universityId, meta: { nameTr: input.nameTr } }, tx);
    }),
  );
}

export function updateFaculty(actor: Actor, universityId: string, facultyId: string, input: NamesInput): Promise<void> {
  return withNameGuard(() =>
    db.$transaction(async (tx) => {
      const { count } = await tx.faculty.updateMany({ where: { id: facultyId, universityId }, data: { nameTr: input.nameTr, nameEn: input.nameEn ?? null } });
      if (count === 0) throw fail("NOT_FOUND");
      await audit({ action: "university.faculty.updated", targetType: "Faculty", targetId: facultyId, actorId: actor.id, universityId, meta: { nameTr: input.nameTr } }, tx);
    }),
  );
}

/** Profillerde kullanılan fakülte/bölüm silinmez; bölümü olan fakülte de silinmez. */
export async function deleteFaculty(actor: Actor, universityId: string, facultyId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const faculty = await tx.faculty.findFirst({
      where: { id: facultyId, universityId },
      select: { nameTr: true, _count: { select: { profiles: true, departments: true } } },
    });
    if (!faculty) throw fail("NOT_FOUND");
    if (faculty._count.profiles > 0 || faculty._count.departments > 0) throw fail("IN_USE");
    await tx.faculty.delete({ where: { id: facultyId } });
    await audit({ action: "university.faculty.deleted", targetType: "Faculty", targetId: facultyId, actorId: actor.id, universityId, meta: { nameTr: faculty.nameTr } }, tx);
  });
}

export function createDepartment(actor: Actor, universityId: string, facultyId: string, input: NamesInput): Promise<void> {
  return withNameGuard(() =>
    db.$transaction(async (tx) => {
      const faculty = await tx.faculty.findFirst({ where: { id: facultyId, universityId }, select: { id: true } });
      if (!faculty) throw fail("NOT_FOUND");
      const dep = await tx.department.create({ data: { facultyId, nameTr: input.nameTr, nameEn: input.nameEn ?? null }, select: { id: true } });
      await audit({ action: "university.department.created", targetType: "Department", targetId: dep.id, actorId: actor.id, universityId, meta: { facultyId, nameTr: input.nameTr } }, tx);
    }),
  );
}

export function updateDepartment(actor: Actor, universityId: string, departmentId: string, input: NamesInput): Promise<void> {
  return withNameGuard(() =>
    db.$transaction(async (tx) => {
      const { count } = await tx.department.updateMany({ where: { id: departmentId, faculty: { universityId } }, data: { nameTr: input.nameTr, nameEn: input.nameEn ?? null } });
      if (count === 0) throw fail("NOT_FOUND");
      await audit({ action: "university.department.updated", targetType: "Department", targetId: departmentId, actorId: actor.id, universityId, meta: { nameTr: input.nameTr } }, tx);
    }),
  );
}

export async function deleteDepartment(actor: Actor, universityId: string, departmentId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const dep = await tx.department.findFirst({ where: { id: departmentId, faculty: { universityId } }, select: { nameTr: true, _count: { select: { profiles: true } } } });
    if (!dep) throw fail("NOT_FOUND");
    if (dep._count.profiles > 0) throw fail("IN_USE");
    await tx.department.delete({ where: { id: departmentId } });
    await audit({ action: "university.department.deleted", targetType: "Department", targetId: departmentId, actorId: actor.id, universityId, meta: { nameTr: dep.nameTr } }, tx);
  });
}

/** Hesap silmede (identity çağırır, aynı transaction): kullanıcının tüm Admin rolleri kalkar. */
export async function revokeAdminRolesForUser(tx: Tx, userId: string): Promise<number> {
  const { count } = await tx.universityAdmin.deleteMany({ where: { userId } });
  return count;
}
