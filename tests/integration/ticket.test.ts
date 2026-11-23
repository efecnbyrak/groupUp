import { beforeEach, describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/authz";
import { db } from "@/lib/db";
import { closeTicket, getTicketForUser, listAdminInbox, listPlatformTickets, openAdminTicket, openClubTicket, reopenTicket, replyTicket, ticketSide } from "@/modules/ticket";

import { clubFixture, createActiveUser, errorCode, resetDatabase, sessionUserOf } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const input = { category: "TECHNICAL" as const, subject: "Davet linki açılmıyor", body: "Merhaba, link hata veriyor.", changeRequestId: null };

beforeEach(async () => {
  fx = await resetDatabase();
});

describe("ticket", () => {
  it("kulüp → Admin: OPEN → ANSWERED → OPEN → CLOSED → 7 gün içinde yeniden aç", async () => {
    const { club, president, admin } = await clubFixture(fx.university.id, { members: 0 });
    const id = await openClubTicket(president, club.id, input, [{ name: "ekran.png", body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]) }]);
    const P = sessionUserOf(president);
    const A = sessionUserOf(admin);
    expect(await ticketSide(P, { scope: "CLUB_TO_ADMIN", universityId: fx.university.id, clubId: club.id })).toBe("requester");
    expect((await listAdminInbox(fx.university.id)).items.map((t) => t.id)).toEqual([id]);

    await replyTicket(A, id, "Bakıyoruz.");
    expect((await db.ticket.findUniqueOrThrow({ where: { id } })).status).toBe("ANSWERED");
    await replyTicket(P, id, "Teşekkürler.");
    expect((await db.ticket.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
    await closeTicket(A, id);
    expect(await errorCode(replyTicket(P, id, "Ek"))).toBe("CLOSED");
    await reopenTicket(P, id);
    expect((await db.ticket.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");

    await closeTicket(P, id);
    expect(await errorCode(reopenTicket(P, id, new Date(Date.now() + 8 * 24 * 3600 * 1000)))).toBe("REOPEN_EXPIRED");
    const view = await getTicketForUser(P, id);
    expect(view?.messages).toHaveLength(3);
    expect(view?.messages[0]?.attachments[0]?.url).toMatch(/^\/api\/files\/private/);
  });

  it("tenant: başka üniversite Admini, sıradan üye ve Süper Admin kulüp ticketını göremez", async () => {
    const { club, president, members } = await clubFixture(fx.university.id, { members: 1 });
    const id = await openClubTicket(president, club.id, input);
    const foreignAdmin = await createActiveUser(fx.other.id, "fa@ogr.baska.edu.tr");
    await db.universityAdmin.create({ data: { universityId: fx.other.id, userId: foreignAdmin.id } });
    const superAdmin = await createActiveUser(null, "root@groupup.local", { platformRole: "SUPER_ADMIN" });
    expect(await getTicketForUser(sessionUserOf(foreignAdmin), id)).toBeNull();
    expect(await getTicketForUser(sessionUserOf(members[0]!), id)).toBeNull();
    expect(await getTicketForUser(sessionUserOf({ ...superAdmin, platformRole: "SUPER_ADMIN" }), id)).toBeNull();
    await expect(replyTicket(sessionUserOf(foreignAdmin), id, "x")).rejects.toThrow(ForbiddenError);
    expect(await db.ticketMessage.count({ where: { ticketId: id } })).toBe(1);
  });

  it("TICKET_OPEN yetkili görevli talep eden taraftadır; yetkisiz görevli erişemez", async () => {
    const { club, members } = await clubFixture(fx.university.id, { members: 2 });
    await db.staffAssignment.create({ data: { clubId: club.id, userId: members[0]!.id, title: "Destek", permissions: ["TICKET_OPEN"] } });
    await db.staffAssignment.create({ data: { clubId: club.id, userId: members[1]!.id, title: "Davet", permissions: ["MEMBER_INVITE"] } });
    const ref = { scope: "CLUB_TO_ADMIN" as const, universityId: fx.university.id, clubId: club.id };
    expect(await ticketSide(sessionUserOf(members[0]!), ref)).toBe("requester");
    expect(await ticketSide(sessionUserOf(members[1]!), ref)).toBeNull();
  });

  it("Admin → Platform: Süper Admin yanıtlar; diğer üniversite Admini göremez", async () => {
    const { admin } = await clubFixture(fx.university.id, { members: 0 });
    const id = await openAdminTicket(admin, fx.university.id, input);
    const superAdmin = sessionUserOf({ ...(await createActiveUser(null, "root@groupup.local", { platformRole: "SUPER_ADMIN" })), platformRole: "SUPER_ADMIN" });
    expect((await listPlatformTickets()).items.map((t) => t.id)).toEqual([id]);
    await replyTicket(superAdmin, id, "İnceliyoruz.");
    expect((await db.ticket.findUniqueOrThrow({ where: { id } })).status).toBe("ANSWERED");
    const foreignAdmin = await createActiveUser(fx.other.id, "fa@ogr.baska.edu.tr");
    await db.universityAdmin.create({ data: { universityId: fx.other.id, userId: foreignAdmin.id } });
    expect(await getTicketForUser(sessionUserOf(foreignAdmin), id)).toBeNull();
  });
});
