import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { cancelRequest, decideRequest, getRequestDetail, listClubRequests, listQueue, pendingCount, submitRequest } from "@/modules/approval";
import { createInvite, joinWithInvite } from "@/modules/club";

import { clubFixture, createActiveUser, errorCode, lastMailTo, mailbox, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const PDF = Buffer.from("%PDF-1.7\n%%EOF");
const REASON = "Etkinlik kurallarını tekrar tekrar ihlal etti.";

beforeEach(async () => {
  fx = await resetDatabase();
});

const staffPayload = (userId: string, title = "Sayman", permissions: string[] = ["MEMBER_INVITE"]) => ({ userId, title, permissions, before: null });

describe("STAFF_ASSIGN / STAFF_REMOVE", () => {
  it("talep → kuyruk → onay → görevli; idempotent; mail ve audit", async () => {
    const { club, president, admin, members } = await clubFixture(fx.university.id);
    const { id } = await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id) });
    expect(await pendingCount(fx.university.id)).toBe(1);
    expect((await listQueue(fx.university.id)).items[0]).toMatchObject({ id, type: "STAFF_ASSIGN" });
    expect(await db.staffAssignment.count({ where: { clubId: club.id } })).toBe(0); // doğrudan uygulanmaz

    mailbox().length = 0;
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    expect(await db.staffAssignment.findFirstOrThrow({ where: { clubId: club.id, userId: members[0]!.id } })).toMatchObject({ title: "Sayman", permissions: ["MEMBER_INVITE"] });
    expect(lastMailTo(president.email)?.subject).toMatch(/onaylandı/);
    expect(await errorCode(decideRequest(admin, fx.university.id, id, "APPROVE", null))).toBe("ALREADY_DECIDED");
    expect(await errorCode(decideRequest(admin, fx.university.id, id, "REJECT", REASON))).toBe("ALREADY_DECIDED");
    expect(await db.auditLog.count({ where: { targetId: id, action: { startsWith: "approval.request." } } })).toBe(2); // created + approved

    const removal = await submitRequest(president, { type: "STAFF_REMOVE", universityId: fx.university.id, clubId: club.id, payload: { userId: members[0]!.id, before: { title: "Sayman", permissions: ["MEMBER_INVITE"] } } });
    await decideRequest(admin, fx.university.id, removal.id, "APPROVE", null);
    expect(await db.staffAssignment.count({ where: { clubId: club.id } })).toBe(0);
  });

  it("aynı hedef için tek PENDING: ikinci talep ilkini günceller", async () => {
    const { club, president, members } = await clubFixture(fx.university.id);
    const a = await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id, "Birinci") });
    const b = await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id, "İkinci") });
    expect(b).toEqual({ id: a.id, updated: true });
    const row = await db.changeRequest.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.payload).toMatchObject({ title: "İkinci" });
    expect(await db.changeRequest.count()).toBe(1);
  });

  it("ekip sınırı: 9 görevli (bekleyenler dahil) — 10. talep reddedilir", async () => {
    const { club, president, members } = await clubFixture(fx.university.id, { members: 10 });
    for (let i = 0; i < 7; i++) await db.staffAssignment.create({ data: { clubId: club.id, userId: members[i]!.id, title: `G${i}`, permissions: [] } });
    await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[7]!.id) });
    await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[8]!.id) });
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[9]!.id) }))).toBe("STAFF_LIMIT");
    // mevcut görevlinin güncellemesi yer tutmaz
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id, "Yeni unvan") }))).toBe("NO_ERROR");
  });

  it("eşzamanlı talepler sınırı aşamaz (kulüp satırı kilidi)", async () => {
    const { club, president, members } = await clubFixture(fx.university.id, { members: 11 });
    for (let i = 0; i < 8; i++) await db.staffAssignment.create({ data: { clubId: club.id, userId: members[i]!.id, title: `G${i}`, permissions: [] } });
    const results = await Promise.all(
      [8, 9, 10].map((i) => errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[i]!.id) }))),
    );
    expect(results.filter((r) => r === "NO_ERROR")).toHaveLength(1);
    expect(await db.changeRequest.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("görevli üye olmalı; başkan görevli olamaz", async () => {
    const { club, president } = await clubFixture(fx.university.id, { members: 0 });
    const outsider = await createActiveUser(fx.university.id, "o@ogr.test.edu.tr");
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(outsider.id) }))).toBe("NOT_MEMBER");
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(president.id) }))).toBe("IS_PRESIDENT");
  });
});

describe("MEMBER_REMOVE / MEMBER_BAN", () => {
  it("gerekçe + kanıt zorunlu; onayda REMOVED; ret gerekçesi (10–500) maille gider", async () => {
    const { club, president, admin, members } = await clubFixture(fx.university.id);
    const base = { type: "MEMBER_REMOVE" as const, universityId: fx.university.id, clubId: club.id, payload: { userId: members[0]!.id } };
    expect(await errorCode(submitRequest(president, { ...base, reason: REASON }))).toBe("ATTACHMENT_REQUIRED");
    expect(await errorCode(submitRequest(president, { ...base, files: [{ name: "k.pdf", body: PDF }] }))).toBe("REASON_REQUIRED");
    const { id } = await submitRequest(president, { ...base, reason: REASON, files: [{ name: "k.pdf", body: PDF }] });
    const detail = await getRequestDetail(fx.university.id, id);
    expect(detail?.attachments[0]?.url).toMatch(/^\/api\/files\/private\?key=/);
    expect(detail?.target?.id).toBe(members[0]!.id);

    mailbox().length = 0;
    await decideRequest(admin, fx.university.id, id, "REJECT", "Kanıt yetersiz, tutanak ekleyin.");
    expect(lastMailTo(president.email)?.text).toContain("Kanıt yetersiz, tutanak ekleyin.");
    expect((await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: members[0]!.id } })).status).toBe("ACTIVE");

    const again = await submitRequest(president, { ...base, reason: REASON, files: [{ name: "tutanak.pdf", body: PDF }] });
    await decideRequest(admin, fx.university.id, again.id, "APPROVE", null);
    expect((await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: members[0]!.id } })).status).toBe("REMOVED");
  });

  it("engel: süreli engel tarihi uygulanır, engelli koda rağmen katılamaz", async () => {
    const { club, president, admin, members } = await clubFixture(fx.university.id);
    const { id } = await submitRequest(president, {
      type: "MEMBER_BAN",
      universityId: fx.university.id,
      clubId: club.id,
      payload: { userId: members[1]!.id, until: "2099-01-31" },
      reason: REASON,
      files: [{ name: "k.pdf", body: PDF }],
    });
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    const m = await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: members[1]!.id } });
    expect(m.status).toBe("BANNED");
    expect(m.bannedUntil?.toISOString()).toBe("2099-01-31T21:00:00.000Z");
    const invite = await createInvite(president, club.id, { expiresIn: "30", maxUses: null });
    expect(await errorCode(joinWithInvite(members[1]!, invite.code))).toBe("BANNED");
  });
});

describe("CLUB_UPDATE", () => {
  it("yalnızca değişen alanlar; onayda uygulanır; boş değişiklik reddedilir", async () => {
    const { club, president, admin } = await clubFixture(fx.university.id, { members: 0 });
    expect(await errorCode(submitRequest(president, { type: "CLUB_UPDATE", universityId: fx.university.id, clubId: club.id, payload: { before: {}, after: {} } }))).toBe("NO_CHANGES");
    const { id } = await submitRequest(president, {
      type: "CLUB_UPDATE",
      universityId: fx.university.id,
      clubId: club.id,
      payload: { before: { shortDescTr: "Kısa açıklama", instagram: null }, after: { shortDescTr: "Yeni kısa açıklama", instagram: "kulupk" } },
    });
    const detail = await getRequestDetail(fx.university.id, id);
    expect(detail?.diff.map((d) => d.field)).toEqual(["shortDescTr", "instagram"]);
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    expect(await db.club.findUniqueOrThrow({ where: { id: club.id } })).toMatchObject({ shortDescTr: "Yeni kısa açıklama", instagram: "kulupk" });
  });
});

describe("iptal ve tenant izolasyonu", () => {
  it("talep sahibi geri çeker; başkası çekemez", async () => {
    const { club, president, members } = await clubFixture(fx.university.id);
    const { id } = await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id) });
    expect(await errorCode(cancelRequest(members[1]!, id))).toBe("NOT_OWNER");
    await cancelRequest(president, id);
    expect((await db.changeRequest.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
    expect(await errorCode(cancelRequest(president, id))).toBe("ALREADY_DECIDED");
  });

  it("başka üniversitenin Admini kuyruğu/detayı göremez, karar veremez; kulüp başka üniversiteye talep açamaz", async () => {
    const { club, president, members } = await clubFixture(fx.university.id);
    const other = await clubFixture(fx.other.id, { prefix: "b", slug: "baska-kulup", members: 1 });
    const { id } = await submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(members[0]!.id) });
    expect((await listQueue(fx.other.id)).items).toHaveLength(0);
    expect(await getRequestDetail(fx.other.id, id)).toBeNull();
    expect(await errorCode(decideRequest(other.admin, fx.other.id, id, "APPROVE", null))).toBe("NOT_FOUND");
    // kulüp bağlamı üniversiteyle eşleşmeli
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.other.id, clubId: club.id, payload: staffPayload(members[0]!.id) }))).toBe("WRONG_CLUB");
    // başka kulübün üyesi bu kulüpte görevli yapılamaz
    expect(await errorCode(submitRequest(president, { type: "STAFF_ASSIGN", universityId: fx.university.id, clubId: club.id, payload: staffPayload(other.members[0]!.id) }))).toBe("NOT_MEMBER");
    expect((await listClubRequests(other.club.id)).items).toHaveLength(0);
  });
});
