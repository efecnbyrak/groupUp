import { beforeEach, describe, expect, it } from "vitest";

import { getClubAccess } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  assignPresident,
  createClub,
  createInvite,
  deleteClubCategory,
  joinWithInvite,
  leaveClub,
  listClubs,
  listMyClubs,
  previewInvite,
  revokeInvite,
} from "@/modules/club";

import { clubFixture, createActiveUser, errorCode, resetDatabase, sessionUserOf } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;

beforeEach(async () => {
  fx = await resetDatabase();
});

describe("kulüp açma + başkan", () => {
  it("Admin kulüp açar; başkan otomatik üye ve audit yazılır", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    const row = await db.club.findUniqueOrThrow({ where: { id: club.id } });
    expect(row.presidentId).toBe(president.id);
    expect(await db.membership.findFirst({ where: { clubId: club.id, userId: president.id, status: "ACTIVE" } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "club.club.created", targetId: club.id } })).toBe(1);
  });

  it("başkan: başka üniversite, mezun veya ikinci kulüp olamaz; slug benzersiz", async () => {
    const { admin, president, category } = await clubFixture(fx.university.id, { members: 0 });
    const base = { universityId: fx.university.id, name: "İkinci Kulüp", categoryId: category.id, shortDescTr: "Açıklama" };
    expect(await errorCode(createClub(admin, { ...base, presidentEmail: president.email }))).toBe("ALREADY_PRESIDENT");
    const foreign = await createActiveUser(fx.other.id, "x@ogr.baska.edu.tr");
    expect(await errorCode(createClub(admin, { ...base, presidentEmail: foreign.email }))).toBe("PRESIDENT_INVALID");
    const alumni = await createActiveUser(fx.university.id, "m@mezun.test.edu.tr", { type: "ALUMNI" });
    expect(await errorCode(createClub(admin, { ...base, presidentEmail: alumni.email }))).toBe("PRESIDENT_INVALID");
    const other = await createActiveUser(fx.university.id, "y@ogr.test.edu.tr");
    expect(await errorCode(createClub(admin, { ...base, slug: "kulup-k", presidentEmail: other.email }))).toBe("SLUG_TAKEN");
  });

  it("başkan değişimi: eski başkan üye kalır, yeni başkanın görevliliği kalkar", async () => {
    const { admin, president, club, members } = await clubFixture(fx.university.id);
    await db.staffAssignment.create({ data: { clubId: club.id, userId: members[0]!.id, title: "Sayman", permissions: [] } });
    await assignPresident(admin, fx.university.id, club.id, members[0]!.email);
    expect((await db.club.findUniqueOrThrow({ where: { id: club.id } })).presidentId).toBe(members[0]!.id);
    expect(await db.staffAssignment.count({ where: { clubId: club.id, userId: members[0]!.id } })).toBe(0);
    expect((await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: president.id } })).status).toBe("ACTIVE");
    expect(await errorCode(assignPresident(admin, fx.other.id, club.id, members[1]!.email))).toBe("NOT_FOUND");
  });

  it("kullanılan kategori silinemez", async () => {
    const { admin, category } = await clubFixture(fx.university.id, { members: 0 });
    expect(await errorCode(deleteClubCategory(admin, category.id))).toBe("IN_USE");
  });
});

describe("davet kodu ile katılım", () => {
  it("kod geçerli → üye; sayaç artar; tekrar katılım ALREADY_MEMBER; ayrılınca tekrar katılabilir", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    const invite = await createInvite(president, club.id, { expiresIn: "30", maxUses: null });
    const student = await createActiveUser(fx.university.id, "s@ogr.test.edu.tr");
    expect(await joinWithInvite(student, invite.code.toLowerCase())).toMatchObject({ clubId: club.id });
    expect((await db.clubInvite.findUniqueOrThrow({ where: { id: invite.id } })).usedCount).toBe(1);
    expect(await errorCode(joinWithInvite(student, invite.code))).toBe("ALREADY_MEMBER");
    await leaveClub(student, club.id);
    await joinWithInvite(student, invite.code);
    expect((await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: student.id } })).status).toBe("ACTIVE");
    expect((await listMyClubs(student.id)).map((c) => c.role)).toEqual(["MEMBER"]);
  });

  it("süre, limit ve iptal kontrolü", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    const limited = await createInvite(president, club.id, { expiresIn: "7", maxUses: 1 });
    const a = await createActiveUser(fx.university.id, "a@ogr.test.edu.tr");
    const b = await createActiveUser(fx.university.id, "b@ogr.test.edu.tr");
    await joinWithInvite(a, limited.code);
    expect(await errorCode(joinWithInvite(b, limited.code))).toBe("INVITE_INVALID");
    expect((await previewInvite(limited.code))?.state).toBe("USED_UP");

    const expired = await createInvite(president, club.id, { expiresIn: "7", maxUses: null }, new Date(Date.now() - 8 * 24 * 3600 * 1000));
    expect(await errorCode(joinWithInvite(b, expired.code))).toBe("INVITE_INVALID");
    expect((await previewInvite(expired.code))?.state).toBe("EXPIRED");

    const revoked = await createInvite(president, club.id, { expiresIn: "never", maxUses: null });
    await revokeInvite(president, club.id, revoked.id);
    expect(await errorCode(joinWithInvite(b, revoked.code))).toBe("INVITE_INVALID");
    expect(await errorCode(joinWithInvite(b, "ZZZZZZZZ"))).toBe("INVITE_INVALID");
    expect(await errorCode(joinWithInvite(b, "kısa"))).toBe("INVITE_INVALID");
  });

  it("tenant: başka üniversitenin öğrencisi katılamaz", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    const invite = await createInvite(president, club.id, { expiresIn: "30", maxUses: null });
    const foreign = await createActiveUser(fx.other.id, "f@ogr.baska.edu.tr");
    expect(await errorCode(joinWithInvite(foreign, invite.code))).toBe("OTHER_UNIVERSITY");
  });

  it("engelli üye katılamaz, süre dolunca katılabilir; çıkarılan üye katılabilir", async () => {
    const { club, president, members } = await clubFixture(fx.university.id, { members: 2 });
    const invite = await createInvite(president, club.id, { expiresIn: "30", maxUses: null });
    await db.membership.updateMany({ where: { clubId: club.id, userId: members[0]!.id }, data: { status: "BANNED", bannedUntil: null } });
    expect(await errorCode(joinWithInvite(members[0]!, invite.code))).toBe("BANNED");
    await db.membership.updateMany({ where: { clubId: club.id, userId: members[0]!.id }, data: { bannedUntil: new Date(Date.now() - 1000) } });
    expect(await errorCode(joinWithInvite(members[0]!, invite.code))).toBe("NO_ERROR");
    await db.membership.updateMany({ where: { clubId: club.id, userId: members[1]!.id }, data: { status: "REMOVED" } });
    expect(await errorCode(joinWithInvite(members[1]!, invite.code))).toBe("NO_ERROR");
  });

  it("başkan ayrılamaz", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    expect(await errorCode(leaveClub(president, club.id))).toBe("PRESIDENT_CANNOT_LEAVE");
  });
});

describe("kulüp yetkisi ve listeleme (tenant)", () => {
  it("getClubAccess: rol, yetki; başka üniversitenin kullanıcısı rol alamaz; Admin yalnız kendi üniversitesinde", async () => {
    const { club, president, admin, members } = await clubFixture(fx.university.id);
    await db.staffAssignment.create({ data: { clubId: club.id, userId: members[0]!.id, title: "Davet", permissions: ["MEMBER_INVITE"] } });
    expect(await getClubAccess(sessionUserOf(president), club.id)).toMatchObject({ role: "PRESIDENT", isAdmin: false });
    expect(await getClubAccess(sessionUserOf(members[0]!), club.id)).toMatchObject({ role: "STAFF", permissions: ["MEMBER_INVITE"] });
    expect(await getClubAccess(sessionUserOf(members[1]!), club.id)).toMatchObject({ role: "MEMBER" });
    expect(await getClubAccess(sessionUserOf(admin), club.id)).toMatchObject({ role: null, isAdmin: true });
    const foreignAdmin = await createActiveUser(fx.other.id, "fa@ogr.baska.edu.tr");
    await db.universityAdmin.create({ data: { universityId: fx.other.id, userId: foreignAdmin.id } });
    expect(await getClubAccess(sessionUserOf(foreignAdmin), club.id)).toMatchObject({ role: null, isAdmin: false });
  });

  it("listClubs yalnızca kendi üniversitesi", async () => {
    await clubFixture(fx.university.id, { members: 0, prefix: "a" });
    await clubFixture(fx.other.id, { members: 0, prefix: "b", slug: "baska-kulup" });
    expect((await listClubs(fx.university.id)).items.map((c) => c.slug)).toEqual(["kulup-a"]);
    expect((await listClubs(fx.other.id)).items.map((c) => c.slug)).toEqual(["baska-kulup"]);
  });
});
