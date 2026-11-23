import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { DomainType } from "@/lib/db-types";

import { candidateDomains } from "./domain-match";
import type { UniversityRequestInput } from "./schemas";

export interface ResolvedDomain {
  universityId: string;
  universityName: string;
  domain: string;
  type: DomainType;
}

/**
 * Mailin domainini UniversityDomain'de çözer (AUTH-EMAIL §1.2): tam eşleşme önce,
 * sonra üst domainler. Yalnızca aktif üniversiteler.
 */
export async function resolveEmailDomain(email: string): Promise<ResolvedDomain | null> {
  const candidates = candidateDomains(email);
  if (candidates.length === 0) return null;
  const rows = await db.universityDomain.findMany({
    where: { domain: { in: candidates }, university: { isActive: true } },
    select: { domain: true, type: true, universityId: true, university: { select: { name: true } } },
  });
  // candidates en özelden en genele sıralı → ilk eşleşen en uzun domain.
  for (const candidate of candidates) {
    const row = rows.find((r) => r.domain === candidate);
    if (row) {
      return { universityId: row.universityId, universityName: row.university.name, domain: row.domain, type: row.type };
    }
  }
  return null;
}

export interface FacultyOption {
  id: string;
  nameTr: string;
  nameEn: string | null;
  departments: { id: string; nameTr: string; nameEn: string | null }[];
}

/** Kayıt formu için fakülte + bölüm listesi (tek sorgu). */
export function listFacultiesWithDepartments(universityId: string): Promise<FacultyOption[]> {
  return db.faculty.findMany({
    where: { universityId },
    orderBy: { nameTr: "asc" },
    select: {
      id: true,
      nameTr: true,
      nameEn: true,
      departments: { orderBy: { nameTr: "asc" }, select: { id: true, nameTr: true, nameEn: true } },
    },
  });
}

/** Fakülte üniversiteye, bölüm fakülteye ait mi? (tenant izolasyonu) */
export async function isValidFacultyDepartment(
  universityId: string,
  facultyId: string,
  departmentId: string,
): Promise<boolean> {
  const department = await db.department.findFirst({
    where: { id: departmentId, facultyId, faculty: { universityId } },
    select: { id: true },
  });
  return department !== null;
}

/** "Üniversitem yok" talebi — Süper Admin kuyruğuna düşer (F4'te panel). */
export async function createUniversityRequest(input: UniversityRequestInput): Promise<void> {
  const domain = input.email.slice(input.email.lastIndexOf("@") + 1);
  await db.$transaction(async (tx) => {
    const request = await tx.universityRequest.create({
      data: { email: input.email, name: input.name, domain, note: input.note },
      select: { id: true },
    });
    await audit(
      { action: "university.request.created", targetType: "UniversityRequest", targetId: request.id, meta: { domain } },
      tx,
    );
  });
}

/** Manuel (belge) mezun yolu açık aktif üniversiteler — AUTH-EMAIL §6. */
export function listManualAlumniUniversities(): Promise<{ id: string; name: string }[]> {
  return db.university.findMany({
    where: { isActive: true, alumniVerifyMode: { in: ["MANUAL", "BOTH"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function getManualAlumniUniversity(id: string): Promise<{ id: string; name: string } | null> {
  return db.university.findFirst({ where: { id, isActive: true, alumniVerifyMode: { in: ["MANUAL", "BOTH"] } }, select: { id: true, name: true } });
}
