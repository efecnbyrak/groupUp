import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createEventDraft } from "@/modules/event";
import {
  applyToEvent,
  buildExportRows,
  cancelRegistration,
  createField,
  decideRegistration,
  createTeam,
  completeTeam,
  disbandTeam,
  joinTeam,
  leaveTeam,
  listRegistrationsForManage,
  removeTeamMember,
  snapshotProfile,
  toCsv,
  transferCaptain,
} from "@/modules/registration";

import { clubFixture, createActiveUser, errorCode, lastMailTo, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const DAY = 86_400_000;

beforeEach(async () => {
  fx = await resetDatabase();
  setupCount = 0;
});

let setupCount = 0;
async function setup(overrides: Record<string, unknown> = {}, memberCount = 5) {
  const fixture = await clubFixture(fx.university.id, { members: memberCount, prefix: `k${setupCount++}` });
  const category = await db.eventCategory.create({ data: { slug: `kat-${Date.now()}`, nameTr: "Turnuva", nameEn: "Tournament" } });
  const { id: eventId } = await createEventDraft(fixture.president, fixture.club.id, { categoryId: category.id, titleTr: "Satranç Turnuvası" });
  const now = Date.now();
  await db.event.update({
    where: { id: eventId },
    data: {
      status: "PUBLISHED",
      summaryTr: "Kısa özet",
      locationName: "Salon",
      startAt: new Date(now + 10 * DAY),
      endAt: new Date(now + 10 * DAY + 4 * 3600_000),
      applyOpensAt: new Date(now - DAY),
      applyClosesAt: new Date(now + 5 * DAY),
      capacity: 2,
      waitlistEnabled: true,
      autoPromoteWaitlist: true,
      autoAccept: true,
      mode: "INDIVIDUAL",
      eligibility: "ALL_MEMBERS",
      publishedAt: new Date(now - DAY),
      ...overrides,
    },
  });
  return { ...fixture, eventId };
}

describe("başvuru formu", () => {
  it("zorunlu alan boşsa INVALID_ANSWERS", async () => {
    const { club, eventId, president } = await setup();
    await createField(president, club.id, eventId, {
      type: "SHORT_TEXT",
      labelTr: "Forma bedeni",
      helpTr: null,
      required: true,
      teamLevel: false,
      optionsText: [],
      integer: false,
      acceptPdf: false,
      acceptImage: false,
      showIfFieldId: null,
      showIfValue: null,
    });
    const err = await errorCode(applyToEvent(president, eventId, {}));
    expect(err).toBe("INVALID_ANSWERS");
  });
});

describe("bireysel başvuru: kontenjan, yedek liste, otomatik terfi", () => {
  it("kontenjan dolunca yedek listeye düşer, iptalde sıradaki otomatik kabul edilir", async () => {
    const { club, eventId, members } = await setup();
    const a = await applyToEvent(members[0]!, eventId, {});
    const b = await applyToEvent(members[1]!, eventId, {});
    expect(a.status).toBe("ACCEPTED");
    expect(b.status).toBe("ACCEPTED");

    const c = await applyToEvent(members[2]!, eventId, {});
    expect(c.status).toBe("WAITLISTED");

    expect(await errorCode(applyToEvent(members[0]!, eventId, {}))).toBe("ALREADY_APPLIED");

    await cancelRegistration(members[0]!, eventId);
    const promoted = await db.registration.findUniqueOrThrow({ where: { id: c.id } });
    expect(promoted.status).toBe("ACCEPTED");
    expect(promoted.waitlistPos).toBeNull();
    expect(lastMailTo((await db.user.findUniqueOrThrow({ where: { id: members[2]!.id } })).email)?.subject).toMatch(/kabul edildi/i);

    const manage = await listRegistrationsForManage(club.id, eventId);
    expect(manage?.items.map((r) => r.status).sort()).toEqual(["ACCEPTED", "ACCEPTED", "CANCELLED"]);
  });

  it("yedek liste kapalıysa kontenjan dolunca başvuru engellenir (FULL)", async () => {
    const { eventId, members } = await setup({ waitlistEnabled: false });
    await applyToEvent(members[0]!, eventId, {});
    await applyToEvent(members[1]!, eventId, {});
    expect(await errorCode(applyToEvent(members[2]!, eventId, {}))).toBe("FULL");
  });

  it("autoAccept kapalıysa kontenjan varken bile APPLIED kalır (yöneticinin kararına kadar)", async () => {
    const { eventId, members } = await setup({ autoAccept: false, capacity: 10 });
    const reg = await applyToEvent(members[0]!, eventId, {});
    expect(reg.status).toBe("APPLIED");
  });

  it("kulüp üyesi olmayan başvuramaz, uygunluk şartı tutmazsa reddedilir", async () => {
    const { eventId } = await setup({ eligibility: "ALUMNI_ONLY" });
    const outsider = await createActiveUser(fx.university.id, "disaridan@ogr.test.edu.tr");
    expect(await errorCode(applyToEvent(outsider, eventId, {}))).toBe("NOT_CLUB_MEMBER");

    const { members } = await setup({ eligibility: "ALUMNI_ONLY" }, 1);
    expect(await errorCode(applyToEvent(members[0]!, eventId, {}))).toBe("NOT_CLUB_MEMBER");
  });

  it("süresi geçmiş veya henüz açılmamış başvuru REGISTRATION_CLOSED verir", async () => {
    const now = Date.now();
    const { eventId, members } = await setup({ applyOpensAt: new Date(now + DAY), applyClosesAt: new Date(now + 2 * DAY) });
    expect(await errorCode(applyToEvent(members[0]!, eventId, {}))).toBe("REGISTRATION_CLOSED");
  });

  it("staff manuel karar verir (REGISTRATION_MANAGE), kontenjanı aşabilir", async () => {
    const { club, eventId, members } = await setup({ capacity: 1 });
    const a = await applyToEvent(members[0]!, eventId, {});
    const b = await applyToEvent(members[1]!, eventId, {});
    expect(a.status).toBe("ACCEPTED");
    expect(b.status).toBe("WAITLISTED");
    await decideRegistration(members[0]!, club.id, eventId, b.id, "ACCEPT");
    const row = await db.registration.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("ACCEPTED");
  });
});

describe("dışa aktarım (xlsx/csv)", () => {
  it("snapshot + cevap + takım + durum sütunlarını içerir", async () => {
    const { club, eventId, members } = await setup();
    await createField(members[0]!, club.id, eventId, {
      type: "NUMBER",
      labelTr: "Forma no",
      helpTr: null,
      required: true,
      teamLevel: false,
      optionsText: [],
      integer: true,
      acceptPdf: false,
      acceptImage: false,
      showIfFieldId: null,
      showIfValue: null,
    });
    const fields = await db.eventFormField.findMany({ where: { eventId } });
    const fieldId = fields[0]!.id;
    await applyToEvent(members[0]!, eventId, { [fieldId]: 9 });

    const { columns, rows } = await buildExportRows(eventId);
    expect(columns.map((c) => c.key)).toContain(fieldId);
    expect(rows).toHaveLength(1);
    expect(rows[0]![fieldId]).toBe("9");
    expect(rows[0]!.status).toBe("Kabul edildi");

    const csv = toCsv(columns, rows);
    expect(csv).toContain("Kabul edildi");
  });

  it("snapshotProfile fakülte/bölüm adlarını ve iletişim bilgilerini dondurur", async () => {
    const { members } = await setup();
    const snap = await snapshotProfile(db, members[0]!.id);
    expect(snap.adSoyad).toBeTruthy();
    expect(snap.eposta).toBe(members[0]!.email);
  });
});

describe("takım kaydı", () => {
  async function teamSetup(overrides: Record<string, unknown> = {}) {
    return setup({ mode: "TEAM", teamMinSize: 2, teamMaxSize: 3, capacity: 1, ...overrides }, 6);
  }

  it("kaptan kurar, üye kodla katılır, min boyuta ulaşınca tamamlanır", async () => {
    const { eventId, members } = await teamSetup();
    const team = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    expect(team.code).toHaveLength(6);
    expect(await errorCode(completeTeam(members[0]!, eventId, team.id))).toBe("TEAM_TOO_SMALL");

    await joinTeam(members[1]!, eventId, team.code, {});
    await completeTeam(members[0]!, eventId, team.id);
    const row = await db.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(row.status).toBe("ACCEPTED");
    expect(row.lockedAt).not.toBeNull();
    const regs = await db.registration.findMany({ where: { teamId: team.id } });
    expect(regs.every((r) => r.status === "ACCEPTED")).toBe(true);
  });

  it("kilitli takıma yeni üye katılamaz; takım dolunca TEAM_FULL", async () => {
    const { eventId, members } = await teamSetup({ teamMaxSize: 2 });
    const team = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    await joinTeam(members[1]!, eventId, team.code, {});
    expect(await errorCode(joinTeam(members[2]!, eventId, team.code, {}))).toBe("TEAM_FULL");
  });

  it("geçersiz kod CODE_INVALID verir", async () => {
    const { eventId, members } = await teamSetup();
    expect(await errorCode(joinTeam(members[0]!, eventId, "ZZZZZZ", {}))).toBe("CODE_INVALID");
  });

  it("bir kişi aynı etkinlikte iki takıma giremez", async () => {
    const { eventId, members } = await teamSetup();
    const team = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    expect(await errorCode(createTeam(members[0]!, eventId, "Takım B", {}, {}))).toBe("ALREADY_APPLIED");
    await joinTeam(members[1]!, eventId, team.code, {});
    expect(await errorCode(joinTeam(members[1]!, eventId, team.code, {}))).toBe("ALREADY_APPLIED");
  });

  it("kaptan üye çıkarabilir ama kendini çıkaramaz; üye kendi ayrılabilir", async () => {
    const { eventId, members } = await teamSetup();
    const team = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    await joinTeam(members[1]!, eventId, team.code, {});
    expect(await errorCode(removeTeamMember(members[0]!, eventId, team.id, members[0]!.id))).toBe("CANNOT_REMOVE_CAPTAIN");
    await removeTeamMember(members[0]!, eventId, team.id, members[1]!.id);
    expect(await db.teamMember.count({ where: { teamId: team.id } })).toBe(1);

    await joinTeam(members[1]!, eventId, team.code, {});
    await leaveTeam(members[1]!, eventId, team.id);
    expect(await db.registration.count({ where: { teamId: team.id, userId: members[1]!.id } })).toBe(0);
  });

  it("kaptanlık devredilebilir, takım dağıtılabilir", async () => {
    const { eventId, members } = await teamSetup();
    const team = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    await joinTeam(members[1]!, eventId, team.code, {});
    await transferCaptain(members[0]!, eventId, team.id, members[1]!.id);
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).captainId).toBe(members[1]!.id);
    expect(await errorCode(disbandTeam(members[0]!, eventId, team.id))).toBe("NOT_CAPTAIN");
    await disbandTeam(members[1]!, eventId, team.id);
    expect(await db.team.count({ where: { id: team.id } })).toBe(0);
  });

  it("kontenjan (takım sayısı) dolunca sonraki takım yedek listeye düşer", async () => {
    const { eventId, members } = await teamSetup({ capacity: 1 });
    const t1 = await createTeam(members[0]!, eventId, "Takım A", {}, {});
    await joinTeam(members[1]!, eventId, t1.code, {});
    await completeTeam(members[0]!, eventId, t1.id);

    const t2 = await createTeam(members[2]!, eventId, "Takım B", {}, {});
    await joinTeam(members[3]!, eventId, t2.code, {});
    await completeTeam(members[2]!, eventId, t2.id);
    expect((await db.team.findUniqueOrThrow({ where: { id: t2.id } })).status).toBe("WAITLISTED");
  });
});
