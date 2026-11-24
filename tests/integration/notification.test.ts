import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { cleanupDeletedUserAttachments, cleanupExpiredSessions } from "@/modules/identity";
import { listNotifications, markAllNotificationsRead, markNotificationRead, notify, notifyMany, recentNotifications } from "@/modules/notification";
import { completePastEvents } from "@/modules/event";

import { clubFixture, createActiveUser, resetDatabase } from "./helpers";

describe("notification (F10)", () => {
  let universityId: string;

  beforeEach(async () => {
    const fx = await resetDatabase();
    universityId = fx.university.id;
  });

  it("notify/notifyMany satır yazar; recentNotifications okunmamış sayısını verir", async () => {
    const user = await createActiveUser(universityId, "bildirim@ogr.test.edu.tr");
    await notify({ userId: user.id, type: "SYSTEM", titleTr: "Başlık", titleEn: "Title", bodyTr: "Metin", bodyEn: "Text", href: "/akis" });
    const other = await createActiveUser(universityId, "bildirim2@ogr.test.edu.tr");
    await notifyMany([user.id, other.id], { type: "SYSTEM", titleTr: "Toplu", titleEn: "Bulk" });

    const { items, unreadCount } = await recentNotifications(user.id);
    expect(items).toHaveLength(2);
    expect(unreadCount).toBe(2);

    const otherRecent = await recentNotifications(other.id);
    expect(otherRecent.unreadCount).toBe(1);
  });

  it("markNotificationRead tek satırı okur; başkasının bildirimini okuyamaz", async () => {
    const user = await createActiveUser(universityId, "bildirim3@ogr.test.edu.tr");
    const other = await createActiveUser(universityId, "bildirim4@ogr.test.edu.tr");
    await notify({ userId: user.id, type: "SYSTEM", titleTr: "A", titleEn: "A" });
    const [row] = (await listNotifications(user.id)).items;

    await markNotificationRead(other.id, row!.id);
    expect((await recentNotifications(user.id)).unreadCount).toBe(1);

    await markNotificationRead(user.id, row!.id);
    expect((await recentNotifications(user.id)).unreadCount).toBe(0);
  });

  it("markAllNotificationsRead tüm okunmamışları işaretler", async () => {
    const user = await createActiveUser(universityId, "bildirim5@ogr.test.edu.tr");
    await notify({ userId: user.id, type: "SYSTEM", titleTr: "A", titleEn: "A" });
    await notify({ userId: user.id, type: "SYSTEM", titleTr: "B", titleEn: "B" });
    await markAllNotificationsRead(user.id);
    expect((await recentNotifications(user.id)).unreadCount).toBe(0);
  });

  it("listNotifications cursor pagination ile sayfalar", async () => {
    const user = await createActiveUser(universityId, "bildirim6@ogr.test.edu.tr");
    for (let i = 0; i < 25; i++) await notify({ userId: user.id, type: "SYSTEM", titleTr: `N${i}`, titleEn: `N${i}` });
    const first = await listNotifications(user.id);
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listNotifications(user.id, first.nextCursor!);
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
  });
});

describe("F10 cron temizliği", () => {
  let universityId: string;

  beforeEach(async () => {
    const fx = await resetDatabase();
    universityId = fx.university.id;
  });

  it("cleanupExpiredSessions süresi geçmiş oturum/token'ları siler, geçerli olanı bırakır", async () => {
    const user = await createActiveUser(universityId, "oturum@ogr.test.edu.tr");
    const now = new Date();
    await db.session.create({ data: { userId: user.id, tokenHash: "expired", expiresAt: new Date(now.getTime() - 1000) } });
    await db.session.create({ data: { userId: user.id, tokenHash: "valid", expiresAt: new Date(now.getTime() + 1000 * 60 * 60) } });
    await db.emailToken.create({ data: { email: user.email, purpose: "VERIFY_EMAIL", codeHash: "x", expiresAt: new Date(now.getTime() - 1000) } });

    const result = await cleanupExpiredSessions(now);
    expect(result.sessions).toBe(1);
    expect(result.tokens).toBe(1);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("cleanupDeletedUserAttachments: silinmiş kullanıcının eski eki silinir, aktif kullanıcınınki ve yeni silinen korunur", async () => {
    const now = new Date();
    const old = 40;
    const deletedOld = await createActiveUser(universityId, "silinmis-eski@ogr.test.edu.tr");
    await db.user.update({ where: { id: deletedOld.id }, data: { status: "DELETED", deletedAt: new Date(now.getTime() - old * 24 * 60 * 60 * 1000) } });
    await db.attachment.create({ data: { storageKey: "private/eski.pdf", fileName: "eski.pdf", mimeType: "application/pdf", sizeBytes: 10, isPrivate: true, uploadedById: deletedOld.id } });

    const deletedRecent = await createActiveUser(universityId, "silinmis-yeni@ogr.test.edu.tr");
    await db.user.update({ where: { id: deletedRecent.id }, data: { status: "DELETED", deletedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } });
    await db.attachment.create({ data: { storageKey: "private/yeni.pdf", fileName: "yeni.pdf", mimeType: "application/pdf", sizeBytes: 10, isPrivate: true, uploadedById: deletedRecent.id } });

    const active = await createActiveUser(universityId, "aktif@ogr.test.edu.tr");
    await db.attachment.create({ data: { storageKey: "private/aktif.pdf", fileName: "aktif.pdf", mimeType: "application/pdf", sizeBytes: 10, isPrivate: true, uploadedById: active.id } });

    const removed = await cleanupDeletedUserAttachments(now);
    expect(removed).toBe(1);
    const remaining = await db.attachment.findMany({ select: { storageKey: true } });
    expect(remaining.map((r) => r.storageKey).sort()).toEqual(["private/aktif.pdf", "private/yeni.pdf"]);
  });

  it("completePastEvents: bitişi geçmiş yayındaki etkinlik COMPLETED olur, gelecekteki değişmez", async () => {
    const fixture = await clubFixture(universityId);
    const category = await db.eventCategory.create({ data: { slug: `kat-${Date.now()}`, nameTr: "Test", nameEn: "Test" } });
    const now = new Date();
    const past = await db.event.create({
      data: { universityId, clubId: fixture.club.id, categoryId: category.id, slug: "gecmis", status: "PUBLISHED", titleTr: "Geçmiş", summaryTr: "x", descriptionTr: {}, startAt: new Date(now.getTime() - 2 * 3600_000), endAt: new Date(now.getTime() - 3600_000), createdById: fixture.president.id },
    });
    const future = await db.event.create({
      data: { universityId, clubId: fixture.club.id, categoryId: category.id, slug: "gelecek", status: "PUBLISHED", titleTr: "Gelecek", summaryTr: "x", descriptionTr: {}, startAt: new Date(now.getTime() + 3600_000), createdById: fixture.president.id },
    });

    const count = await completePastEvents(now);
    expect(count).toBe(1);
    expect((await db.event.findUniqueOrThrow({ where: { id: past.id } })).status).toBe("COMPLETED");
    expect((await db.event.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("PUBLISHED");
  });
});
