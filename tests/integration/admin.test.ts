import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  adminStats,
  createDepartment,
  createFaculty,
  deleteDepartment,
  deleteFaculty,
  getAdminUniversity,
  isUniversityAdmin,
  listFacultiesForAdmin,
  listUniversityUsers,
  updateDepartment,
  updateFaculty,
  USER_PAGE_SIZE,
} from "@/modules/university";

import { createActiveUser, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
let actor: { id: string };

beforeEach(async () => {
  fx = await resetDatabase();
  actor = await createActiveUser(fx.university.id, "admin@ogr.test.edu.tr");
  await db.universityAdmin.create({ data: { universityId: fx.university.id, userId: actor.id } });
});

describe("Admin bağlamı", () => {
  it("Admin olduğu üniversiteyi bulur; olmayan için null", async () => {
    expect((await getAdminUniversity(actor.id))?.id).toBe(fx.university.id);
    expect(await isUniversityAdmin(actor.id)).toBe(true);
    const student = await createActiveUser(fx.university.id, "s@ogr.test.edu.tr");
    expect(await getAdminUniversity(student.id)).toBeNull();
    expect(await isUniversityAdmin(student.id)).toBe(false);
  });
});

describe("fakülte / bölüm", () => {
  it("ekler, aynı adı reddeder, günceller ve audit yazar", async () => {
    await createFaculty(actor, fx.university.id, { nameTr: "Hukuk Fakültesi", nameEn: "Faculty of Law" });
    expect(await errorCode(createFaculty(actor, fx.university.id, { nameTr: "Hukuk Fakültesi" }))).toBe("NAME_TAKEN");
    // Aynı ad başka üniversitede serbest.
    await createFaculty(actor, fx.other.id, { nameTr: "Hukuk Fakültesi" });
    const law = await db.faculty.findFirstOrThrow({ where: { universityId: fx.university.id, nameTr: "Hukuk Fakültesi" } });
    await createDepartment(actor, fx.university.id, law.id, { nameTr: "Hukuk" });
    await updateFaculty(actor, fx.university.id, law.id, { nameTr: "Hukuk Fakültesi", nameEn: "Law" });
    expect((await db.faculty.findUniqueOrThrow({ where: { id: law.id } })).nameEn).toBe("Law");
    expect(await db.auditLog.count({ where: { action: { startsWith: "university.faculty." } } })).toBe(3);
  });

  it("tenant izolasyonu: başka üniversitenin fakültesine/bölümüne dokunamaz", async () => {
    const foreign = await db.faculty.create({ data: { universityId: fx.other.id, nameTr: "Yabancı Fakülte", departments: { create: { nameTr: "Yabancı Bölüm" } } }, include: { departments: true } });
    const dep = foreign.departments[0]!;
    expect(await errorCode(updateFaculty(actor, fx.university.id, foreign.id, { nameTr: "Ele geçirildi" }))).toBe("NOT_FOUND");
    expect(await errorCode(deleteFaculty(actor, fx.university.id, foreign.id))).toBe("NOT_FOUND");
    expect(await errorCode(createDepartment(actor, fx.university.id, foreign.id, { nameTr: "Sızma" }))).toBe("NOT_FOUND");
    expect(await errorCode(updateDepartment(actor, fx.university.id, dep.id, { nameTr: "Ele geçirildi" }))).toBe("NOT_FOUND");
    expect(await errorCode(deleteDepartment(actor, fx.university.id, dep.id))).toBe("NOT_FOUND");
    expect((await db.faculty.findUniqueOrThrow({ where: { id: foreign.id } })).nameTr).toBe("Yabancı Fakülte");
    expect((await listFacultiesForAdmin(fx.university.id)).some((f) => f.id === foreign.id)).toBe(false);
  });

  it("profilde kullanılan bölüm ve bölümü olan fakülte silinmez", async () => {
    const user = await createActiveUser(fx.university.id, "u@ogr.test.edu.tr");
    await db.profile.update({ where: { userId: user.id }, data: { facultyId: fx.facultyId, departmentId: fx.departmentId } });
    expect(await errorCode(deleteDepartment(actor, fx.university.id, fx.departmentId))).toBe("IN_USE");
    expect(await errorCode(deleteFaculty(actor, fx.university.id, fx.facultyId))).toBe("IN_USE");
    await db.profile.update({ where: { userId: user.id }, data: { facultyId: null, departmentId: null } });
    await deleteDepartment(actor, fx.university.id, fx.departmentId);
    await deleteFaculty(actor, fx.university.id, fx.facultyId);
    expect(await listFacultiesForAdmin(fx.university.id)).toHaveLength(0);
  });
});

describe("kullanıcı listesi", () => {
  it("yalnızca kendi üniversitesini listeler; arama ve filtre çalışır", async () => {
    await createActiveUser(fx.university.id, "ayse@ogr.test.edu.tr", { firstName: "Ayşe" });
    await createActiveUser(fx.university.id, "mezun@mezun.test.edu.tr", { firstName: "Mehmet", type: "ALUMNI" });
    await createActiveUser(fx.other.id, "yabanci@ogr.baska.edu.tr", { firstName: "Ayşe" });
    const all = await listUniversityUsers(fx.university.id, {});
    expect(all.items.map((u) => u.email).sort()).toEqual(["admin@ogr.test.edu.tr", "ayse@ogr.test.edu.tr", "mezun@mezun.test.edu.tr"]);
    expect((await listUniversityUsers(fx.university.id, { q: "ayş" })).items.map((u) => u.email)).toEqual(["ayse@ogr.test.edu.tr"]);
    expect((await listUniversityUsers(fx.university.id, { type: "ALUMNI" })).items).toHaveLength(1);
    const stats = await adminStats(fx.university.id);
    expect(stats).toMatchObject({ students: 2, alumni: 1, faculties: 1, pendingAlumni: 0 });
  });

  it("cursor ile sayfalar, tekrar/atlama yok", async () => {
    for (let i = 0; i < USER_PAGE_SIZE + 3; i++) await createActiveUser(fx.university.id, `u${i}@ogr.test.edu.tr`);
    const first = await listUniversityUsers(fx.university.id, {});
    expect(first.items).toHaveLength(USER_PAGE_SIZE);
    expect(first.nextCursor).toBeDefined();
    const second = await listUniversityUsers(fx.university.id, { cursor: first.nextCursor });
    expect(second.items).toHaveLength(4); // +1 admin
    expect(second.nextCursor).toBeUndefined();
    const ids = new Set([...first.items, ...second.items].map((u) => u.id));
    expect(ids.size).toBe(USER_PAGE_SIZE + 4);
  });
});
