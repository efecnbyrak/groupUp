import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createClubCategory, deleteClubCategory, listClubCategories, updateClubCategory } from "@/modules/club";
import { createEventCategory, deleteEventCategory, listEventCategoryTree } from "@/modules/event";
import {
  addDomain,
  assignAdmin,
  createUniversity,
  createUniversityRequest,
  listUniversityRequests,
  rejectUniversityRequest,
  removeAdmin,
  removeDomain,
  resolveEmailDomain,
  setUniversityActive,
  updateUniversity,
} from "@/modules/university";

import { createActiveUser, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
let actor: { id: string };

beforeEach(async () => {
  fx = await resetDatabase();
  actor = await createActiveUser(null, "super@groupup.local", { platformRole: "SUPER_ADMIN" });
});

const auditCount = (action: string) => db.auditLog.count({ where: { action } });

describe("üniversite", () => {
  it("addan slug üretir, aynı slug'ı reddeder ve audit yazar", async () => {
    const { id } = await createUniversity(actor, { name: "Örnek Üniversitesi", alumniVerifyMode: "BOTH" });
    const uni = await db.university.findUniqueOrThrow({ where: { id } });
    expect(uni.slug).toBe("ornek-universitesi");
    expect(await errorCode(createUniversity(actor, { name: "Örnek Üniversitesi", alumniVerifyMode: "BOTH" }))).toBe("SLUG_TAKEN");
    expect(await auditCount("university.created")).toBe(1);
  });

  it("günceller; başka üniversitenin slug'ına geçemez", async () => {
    await updateUniversity(actor, { universityId: fx.university.id, name: "Yeni Ad", city: "Ankara", alumniVerifyMode: "MANUAL" });
    const uni = await db.university.findUniqueOrThrow({ where: { id: fx.university.id } });
    expect(uni).toMatchObject({ name: "Yeni Ad", slug: "yeni-ad", city: "Ankara", alumniVerifyMode: "MANUAL" });
    expect(await errorCode(updateUniversity(actor, { universityId: fx.university.id, name: "x", slug: "baska", alumniVerifyMode: "BOTH" }))).toBe("SLUG_TAKEN");
    expect(await errorCode(updateUniversity(actor, { universityId: "yok", name: "x", alumniVerifyMode: "BOTH" }))).toBe("NOT_FOUND");
  });

  it("kapatılan üniversitenin domaini kayıtta çözümlenmez", async () => {
    expect(await resolveEmailDomain("a@ogr.test.edu.tr")).not.toBeNull();
    await setUniversityActive(actor, fx.university.id, false);
    expect(await resolveEmailDomain("a@ogr.test.edu.tr")).toBeNull();
    await setUniversityActive(actor, fx.university.id, true);
    expect(await resolveEmailDomain("a@ogr.test.edu.tr")).not.toBeNull();
  });

  it("talepten oluşturunca talep APPROVED olur; ikinci kez kullanılamaz", async () => {
    await createUniversityRequest({ email: "kisi@yeni.edu.tr", name: "Yeni Üniversite" });
    const [request] = await listUniversityRequests("PENDING");
    await createUniversity(actor, { name: "Yeni Üniversite", alumniVerifyMode: "BOTH", requestId: request!.id });
    expect((await db.universityRequest.findUniqueOrThrow({ where: { id: request!.id } })).status).toBe("APPROVED");
    expect(await errorCode(createUniversity(actor, { name: "Başka", alumniVerifyMode: "BOTH", requestId: request!.id }))).toBe("REQUEST_RESOLVED");
    expect(await db.university.count({ where: { name: "Başka" } })).toBe(0); // transaction geri alındı
  });

  it("talep reddedilir; sonuçlanmış talep tekrar reddedilemez", async () => {
    await createUniversityRequest({ email: "kisi@yeni.edu.tr", name: "Yeni Üniversite" });
    const [request] = await listUniversityRequests("PENDING");
    await rejectUniversityRequest(actor, request!.id);
    expect(await listUniversityRequests("PENDING")).toHaveLength(0);
    expect((await listUniversityRequests("RESOLVED"))[0]?.status).toBe("REJECTED");
    expect(await errorCode(rejectUniversityRequest(actor, request!.id))).toBe("REQUEST_RESOLVED");
  });
});

describe("domain", () => {
  it("normalize ederek ekler; geçersiz ve çakışan domaini reddeder", async () => {
    await addDomain(actor, { universityId: fx.university.id, domain: " @Ogrenci.Test.edu.tr ", type: "STUDENT" });
    expect((await resolveEmailDomain("x@ogrenci.test.edu.tr"))?.universityId).toBe(fx.university.id);
    expect(await errorCode(addDomain(actor, { universityId: fx.university.id, domain: "geçersiz domain", type: "STUDENT" }))).toBe("DOMAIN_INVALID");
    expect(await errorCode(addDomain(actor, { universityId: fx.other.id, domain: "ogr.test.edu.tr", type: "STUDENT" }))).toBe("DOMAIN_TAKEN");
    expect(await errorCode(addDomain(actor, { universityId: "yok", domain: "yeni.edu.tr", type: "STUDENT" }))).toBe("NOT_FOUND");
  });

  it("kaldırılan domainle kayıt çözümlenmez; audit yazılır", async () => {
    const row = await db.universityDomain.findUniqueOrThrow({ where: { domain: "mezun.test.edu.tr" } });
    await removeDomain(actor, row.id);
    expect(await resolveEmailDomain("a@mezun.test.edu.tr")).toBeNull();
    expect(await auditCount("university.domain.removed")).toBe(1);
  });
});

describe("Admin atama", () => {
  it("üniversitenin aktif kullanıcısını atar, çift atamayı engeller, kaldırır", async () => {
    const user = await createActiveUser(fx.university.id, "admin@ogr.test.edu.tr");
    await assignAdmin(actor, fx.university.id, user.email);
    expect(await errorCode(assignAdmin(actor, fx.university.id, user.email))).toBe("ALREADY_ADMIN");
    const admin = await db.universityAdmin.findFirstOrThrow({ where: { userId: user.id } });
    expect(admin.createdById).toBe(actor.id);
    await removeAdmin(actor, admin.id);
    expect(await db.universityAdmin.count()).toBe(0);
    expect(await auditCount("university.admin.assigned")).toBe(1);
    expect(await auditCount("university.admin.removed")).toBe(1);
  });

  it("başka üniversitenin, olmayan veya aktif olmayan kullanıcıyı atamaz", async () => {
    const other = await createActiveUser(fx.other.id, "b@ogr.baska.edu.tr");
    expect(await errorCode(assignAdmin(actor, fx.university.id, other.email))).toBe("USER_OTHER_UNIVERSITY");
    expect(await errorCode(assignAdmin(actor, fx.university.id, "yok@ogr.test.edu.tr"))).toBe("USER_NOT_FOUND");
    const pending = await createActiveUser(fx.university.id, "p@ogr.test.edu.tr");
    await db.user.update({ where: { id: pending.id }, data: { status: "SUSPENDED" } });
    expect(await errorCode(assignAdmin(actor, fx.university.id, pending.email))).toBe("USER_NOT_FOUND");
  });
});

describe("kategoriler", () => {
  it("kulüp kategorisi: slug üretimi, çakışma, güncelleme, silme", async () => {
    await createClubCategory(actor, { nameTr: "Bilim-Teknoloji", nameEn: "Science", order: 2 });
    await createClubCategory(actor, { nameTr: "Spor", nameEn: "Sports", order: 1, icon: "trophy" });
    const list = await listClubCategories();
    expect(list.map((c) => c.slug)).toEqual(["spor", "bilim-teknoloji"]);
    expect(await errorCode(createClubCategory(actor, { nameTr: "Spor", nameEn: "x", order: 0 }))).toBe("SLUG_TAKEN");
    await updateClubCategory(actor, list[0]!.id, { nameTr: "Spor", nameEn: "Sport", order: 5, slug: "spor" });
    expect((await db.clubCategory.findUniqueOrThrow({ where: { id: list[0]!.id } })).nameEn).toBe("Sport");
    await deleteClubCategory(actor, list[0]!.id);
    expect(await listClubCategories()).toHaveLength(1);
  });

  it("etkinlik kategorisi: iki seviye; alt kategorisi olan silinmez", async () => {
    await createEventCategory(actor, { nameTr: "Turnuva", nameEn: "Tournament", order: 0 });
    const [parent] = await listEventCategoryTree();
    await createEventCategory(actor, { nameTr: "Futbol", nameEn: "Football", order: 0, parentId: parent!.id });
    const child = await db.eventCategory.findUniqueOrThrow({ where: { slug: "futbol" } });
    expect(await errorCode(createEventCategory(actor, { nameTr: "Halı saha", nameEn: "x", order: 0, parentId: child.id }))).toBe("PARENT_INVALID");
    expect(await errorCode(deleteEventCategory(actor, parent!.id))).toBe("IN_USE");
    await deleteEventCategory(actor, child.id);
    await deleteEventCategory(actor, parent!.id);
    expect(await listEventCategoryTree()).toHaveLength(0);
  });
});
