import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { slugify } from "@/lib/slug";

import { normalizeDomain } from "./domain-match";
import type { DomainInput, UniversityInput, UniversityUpdateInput } from "./schemas";

/**
 * Süper Admin işlemleri (ROLES-PERMISSIONS §4: üniversite/domain ekle, Admin ata).
 * Yetki kontrolü action'da (`requireSuperAdmin`); burada iş kuralları + audit.
 */
export type UniversityErrorCode =
  | "NOT_FOUND"
  | "SLUG_TAKEN"
  | "DOMAIN_INVALID"
  | "DOMAIN_TAKEN"
  | "USER_NOT_FOUND"
  | "USER_OTHER_UNIVERSITY"
  | "ALREADY_ADMIN"
  | "REQUEST_RESOLVED"
  | "NAME_TAKEN"
  | "IN_USE";

const fail = (code: UniversityErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);

interface Actor {
  id: string;
}

const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";

// ---------------------------------------------------------------- Okuma

export function listUniversities() {
  return db.university.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      isActive: true,
      alumniVerifyMode: true,
      domains: { orderBy: { domain: "asc" }, select: { id: true, domain: true, type: true } },
      _count: { select: { users: true, admins: true } },
    },
  });
}

export function getUniversity(id: string) {
  return db.university.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      isActive: true,
      alumniVerifyMode: true,
      domains: { orderBy: { domain: "asc" }, select: { id: true, domain: true, type: true } },
      admins: {
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
      },
      _count: { select: { users: true, faculties: true } },
    },
  });
}

export function listAllDomains() {
  return db.universityDomain.findMany({
    orderBy: [{ university: { name: "asc" } }, { domain: "asc" }],
    select: { id: true, domain: true, type: true, university: { select: { id: true, name: true } } },
  });
}

export function listAllAdmins() {
  return db.universityAdmin.findMany({
    orderBy: [{ university: { name: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      createdAt: true,
      university: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
    },
  });
}

export function listUniversityRequests(status: "PENDING" | "RESOLVED") {
  return db.universityRequest.findMany({
    where: status === "PENDING" ? { status: "PENDING" } : { status: { not: "PENDING" } },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
  });
}

export function getUniversityRequest(id: string) {
  return db.universityRequest.findUnique({ where: { id } });
}

export async function platformStats() {
  const [universities, users, pendingRequests, admins] = await Promise.all([
    db.university.count({ where: { isActive: true } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.universityRequest.count({ where: { status: "PENDING" } }),
    db.universityAdmin.count(),
  ]);
  return { universities, users, pendingRequests, admins };
}

// ---------------------------------------------------------------- Üniversite

export async function createUniversity(actor: Actor, input: UniversityInput): Promise<{ id: string }> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw fail("SLUG_TAKEN", { slug: "validation.slug" });
  try {
    return await db.$transaction(async (tx) => {
      if (input.requestId) {
        const { count } = await tx.universityRequest.updateMany({ where: { id: input.requestId, status: "PENDING" }, data: { status: "APPROVED" } });
        if (count === 0) throw fail("REQUEST_RESOLVED");
      }
      const university = await tx.university.create({
        data: { name: input.name, slug, city: input.city, alumniVerifyMode: input.alumniVerifyMode },
        select: { id: true },
      });
      await audit(
        { action: "university.created", targetType: "University", targetId: university.id, actorId: actor.id, universityId: university.id, meta: { slug, requestId: input.requestId ?? null } },
        tx,
      );
      return university;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("SLUG_TAKEN", { slug: "university.errors.slugTaken" });
    throw err;
  }
}

export async function updateUniversity(actor: Actor, input: UniversityUpdateInput): Promise<void> {
  const slug = input.slug ?? slugify(input.name);
  try {
    await db.$transaction(async (tx) => {
      const { count } = await tx.university.updateMany({
        where: { id: input.universityId },
        data: { name: input.name, slug, city: input.city ?? null, alumniVerifyMode: input.alumniVerifyMode },
      });
      if (count === 0) throw fail("NOT_FOUND");
      await audit(
        { action: "university.updated", targetType: "University", targetId: input.universityId, actorId: actor.id, universityId: input.universityId, meta: { slug } },
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("SLUG_TAKEN", { slug: "university.errors.slugTaken" });
    throw err;
  }
}

/** Üniversite silinmez; kapatılınca kayıt/domain çözümlemesinde görünmez. */
export async function setUniversityActive(actor: Actor, universityId: string, active: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.university.updateMany({ where: { id: universityId }, data: { isActive: active } });
    if (count === 0) throw fail("NOT_FOUND");
    await audit(
      { action: active ? "university.activated" : "university.deactivated", targetType: "University", targetId: universityId, actorId: actor.id, universityId },
      tx,
    );
  });
}

// ---------------------------------------------------------------- Domain

export async function addDomain(actor: Actor, input: DomainInput): Promise<void> {
  const domain = normalizeDomain(input.domain);
  if (!domain) throw fail("DOMAIN_INVALID", { domain: "validation.domain" });
  try {
    await db.$transaction(async (tx) => {
      const university = await tx.university.findUnique({ where: { id: input.universityId }, select: { id: true } });
      if (!university) throw fail("NOT_FOUND");
      const row = await tx.universityDomain.create({ data: { universityId: input.universityId, domain, type: input.type }, select: { id: true } });
      await audit(
        { action: "university.domain.added", targetType: "UniversityDomain", targetId: row.id, actorId: actor.id, universityId: input.universityId, meta: { domain, type: input.type } },
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw fail("DOMAIN_TAKEN", { domain: "university.errors.domainTaken" });
    throw err;
  }
}

/** Domain silinir; o domainle kayıtlı kullanıcılar etkilenmez (yeni kayıt kapanır). */
export async function removeDomain(actor: Actor, domainId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.universityDomain.findUnique({ where: { id: domainId }, select: { domain: true, universityId: true } });
    if (!row) throw fail("NOT_FOUND");
    await tx.universityDomain.delete({ where: { id: domainId } });
    await audit(
      { action: "university.domain.removed", targetType: "UniversityDomain", targetId: domainId, actorId: actor.id, universityId: row.universityId, meta: { domain: row.domain } },
      tx,
    );
  });
}

// ---------------------------------------------------------------- Admin atama

/** Admin yalnızca o üniversitenin aktif kullanıcısı olabilir (tenant izolasyonu). */
export async function assignAdmin(actor: Actor, universityId: string, email: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, status: true, universityId: true, deletedAt: true } });
    if (!user || user.status !== "ACTIVE" || user.deletedAt) throw fail("USER_NOT_FOUND", { email: "university.errors.userNotFound" });
    if (user.universityId !== universityId) throw fail("USER_OTHER_UNIVERSITY", { email: "university.errors.userOtherUniversity" });
    const existing = await tx.universityAdmin.findUnique({ where: { universityId_userId: { universityId, userId: user.id } }, select: { id: true } });
    if (existing) throw fail("ALREADY_ADMIN", { email: "university.errors.alreadyAdmin" });
    const admin = await tx.universityAdmin.create({ data: { universityId, userId: user.id, createdById: actor.id }, select: { id: true } });
    await audit({ action: "university.admin.assigned", targetType: "User", targetId: user.id, actorId: actor.id, universityId, meta: { adminId: admin.id } }, tx);
  });
}

export async function removeAdmin(actor: Actor, adminId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const admin = await tx.universityAdmin.findUnique({ where: { id: adminId }, select: { userId: true, universityId: true } });
    if (!admin) throw fail("NOT_FOUND");
    await tx.universityAdmin.delete({ where: { id: adminId } });
    await audit({ action: "university.admin.removed", targetType: "User", targetId: admin.userId, actorId: actor.id, universityId: admin.universityId }, tx);
  });
}

// ---------------------------------------------------------------- Üniversite talepleri

/** Yalnızca reddetme; onay `createUniversity({ requestId })` ile üniversite oluşturulurken olur. */
export async function rejectUniversityRequest(actor: Actor, requestId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.universityRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "REJECTED" } });
    if (count === 0) throw fail("REQUEST_RESOLVED");
    await audit({ action: "university.request.rejected", targetType: "UniversityRequest", targetId: requestId, actorId: actor.id }, tx);
  });
}
