import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { RichDoc } from "@/lib/rich-text";
import { setTranslatorForTests, type TranslationProvider } from "@/lib/translation";
import { cancelRequest, decideRequest, getRequestDetail, submitRequest } from "@/modules/approval";
import { createEventDraft, getEventContent, listExploreEvents, listFeedEvents, saveEventDraft, storeEventImage, translateEvent, type EventContent } from "@/modules/event";

import { clubFixture, createActiveUser, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const DAY = 86_400_000;
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const doc: RichDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Açıklama ", marks: [{ type: "bold" }] }, { type: "text", text: "metni" }] }] };

beforeEach(async () => {
  fx = await resetDatabase();
});
afterEach(() => setTranslatorForTests(undefined));

async function setup() {
  const fixture = await clubFixture(fx.university.id);
  const parent = await db.eventCategory.create({ data: { slug: "turnuva", nameTr: "Turnuva", nameEn: "Tournament" } });
  const leaf = await db.eventCategory.create({ data: { slug: "satranc", nameTr: "Satranç", nameEn: "Chess", parentId: parent.id } });
  const { id } = await createEventDraft(fixture.president, fixture.club.id, { categoryId: leaf.id, titleTr: "Satranç Turnuvası" });
  return { ...fixture, parent, leaf, eventId: id };
}

async function complete(clubId: string, eventId: string, leafId: string, over: Partial<EventContent> = {}) {
  const cover = await storeEventImage(clubId, eventId, "cover", PNG);
  const now = Date.now();
  const content: EventContent = {
    categoryId: leafId,
    titleTr: "Satranç Turnuvası",
    summaryTr: "Kısa özet",
    descriptionTr: doc,
    coverKey: cover,
    images: [],
    locationName: "Spor salonu",
    locationAddress: null,
    mapUrl: null,
    isOnline: false,
    onlineUrl: null,
    startAt: new Date(now + 10 * DAY),
    endAt: new Date(now + 10 * DAY + 4 * 3600_000),
    applyOpensAt: new Date(now - DAY),
    applyClosesAt: new Date(now + 7 * DAY),
    capacity: 32,
    waitlistEnabled: true,
    autoPromoteWaitlist: true,
    autoAccept: true,
    mode: "INDIVIDUAL",
    teamMinSize: null,
    teamMaxSize: null,
    eligibility: "ALL_MEMBERS",
    ...over,
  };
  await saveEventDraft(clubId, eventId, content);
  return content;
}

const fake = (): TranslationProvider & { calls: number } => {
  const p = {
    name: "deepl" as const,
    calls: 0,
    async translate(input: { texts: string[] }) {
      p.calls++;
      return input.texts.map((t) => `EN ${t}`);
    },
  };
  return p;
};

describe("etkinlik yaşam döngüsü (EVENT_PUBLISH)", () => {
  it("eksik taslak onaya gönderilemez", async () => {
    const { club, president, eventId } = await setup();
    expect(await errorCode(submitRequest(president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: club.id, payload: { eventId } }))).toBe("INCOMPLETE");
  });

  it("taslak → PENDING (kilitli) → onay → PUBLISHED + çeviri; feed ve Keşfet'te görünür", async () => {
    const { club, president, admin, leaf, members, eventId } = await setup();
    await complete(club.id, eventId, leaf.id);
    const { id } = await submitRequest(president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: club.id, payload: { eventId } });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("PENDING");
    expect(await errorCode(saveEventDraft(club.id, eventId, (await getEventContent(club.id, eventId)).content))).toBe("NOT_EDITABLE");

    const translator = fake();
    setTranslatorForTests(translator);
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    const e = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.status).toBe("PUBLISHED");
    expect(e.publishedAt).not.toBeNull();
    expect(e.titleEn).toBe("EN Satranç Turnuvası");
    expect(JSON.stringify(e.descriptionEn)).toContain("EN ");
    // hash değişmedi → tekrar çağrılmaz
    const calls = translator.calls;
    expect(await translateEvent(eventId)).toBe(false);
    expect(translator.calls).toBe(calls);

    const now = new Date();
    expect((await listFeedEvents(members[0]!.id, fx.university.id, now)).map((x) => x.id)).toEqual([eventId]);
    expect((await listExploreEvents(fx.university.id, now)).items.map((x) => x.id)).toEqual([eventId]);
    expect((await listExploreEvents(fx.other.id, now)).items).toHaveLength(0); // tenant izolasyonu
    const outsider = await createActiveUser(fx.university.id, "disari@ogr.test.edu.tr");
    expect(await listFeedEvents(outsider.id, fx.university.id, now)).toHaveLength(0); // üye olmayan feed'de görmez
  });

  it("ret ve geri çekme etkinliği taslağa döndürür", async () => {
    const { club, president, admin, leaf, eventId } = await setup();
    await complete(club.id, eventId, leaf.id);
    const a = await submitRequest(president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: club.id, payload: { eventId } });
    await decideRequest(admin, fx.university.id, a.id, "REJECT", "Afiş eksik, lütfen güncelleyin.");
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("DRAFT");
    const b = await submitRequest(president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: club.id, payload: { eventId } });
    await cancelRequest(president, b.id);
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).status).toBe("DRAFT");
  });

  it("çeviri sağlayıcısı kapalıyken yayın yine yapılır, EN boş kalır", async () => {
    const { club, president, admin, leaf, eventId } = await setup();
    await complete(club.id, eventId, leaf.id);
    const { id } = await submitRequest(president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: club.id, payload: { eventId } });
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ status: "PUBLISHED", titleEn: null });
  });
});

describe("EVENT_UPDATE / EVENT_CANCEL", () => {
  async function published() {
    const s = await setup();
    await complete(s.club.id, s.eventId, s.leaf.id);
    const { id } = await submitRequest(s.president, { type: "EVENT_PUBLISH", universityId: fx.university.id, clubId: s.club.id, payload: { eventId: s.eventId } });
    await decideRequest(s.admin, fx.university.id, id, "APPROVE", null);
    return s;
  }

  it("değişiklik onaya kadar yayındakini değiştirmez; diff görünür; onayda uygulanır", async () => {
    const { club, president, admin, eventId } = await published();
    const req = await submitRequest(president, {
      type: "EVENT_UPDATE",
      universityId: fx.university.id,
      clubId: club.id,
      payload: { eventId, before: { locationName: "Spor salonu", capacity: 32 }, after: { locationName: "Konferans salonu", capacity: 40 } },
    });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).locationName).toBe("Spor salonu");
    const detail = await getRequestDetail(fx.university.id, req.id);
    expect(detail?.diff).toEqual([
      { field: "locationName", before: "Spor salonu", after: "Konferans salonu" },
      { field: "capacity", before: 32, after: 40 },
    ]);
    await decideRequest(admin, fx.university.id, req.id, "APPROVE", null);
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ locationName: "Konferans salonu", capacity: 40, status: "PUBLISHED" });
  });

  it("başka etkinliğin görseli bağlanamaz; geçersiz sonuç reddedilir", async () => {
    const { club, president, eventId } = await published();
    const bad = (after: Partial<EventContent>) => submitRequest(president, { type: "EVENT_UPDATE", universityId: fx.university.id, clubId: club.id, payload: { eventId, before: {}, after } });
    expect(await errorCode(bad({ coverKey: "events/baskaetkinlik/abc.webp" }))).toBe("FILE_INVALID");
    expect(await errorCode(bad({ endAt: new Date(Date.now() - DAY) }))).toBe("INCOMPLETE");
  });

  it("iptal gerekçe ister ve onayla CANCELLED olur; başka kulüp talep edemez", async () => {
    const { club, president, admin, eventId } = await published();
    expect(await errorCode(submitRequest(president, { type: "EVENT_CANCEL", universityId: fx.university.id, clubId: club.id, payload: { eventId } }))).toBe("REASON_REQUIRED");
    const other = await clubFixture(fx.university.id, { prefix: "b", slug: "kulup-b" });
    expect(await errorCode(submitRequest(other.president, { type: "EVENT_CANCEL", universityId: fx.university.id, clubId: other.club.id, payload: { eventId }, reason: "Yanlış kulüp denemesi" }))).toBe("NOT_FOUND");
    const { id } = await submitRequest(president, { type: "EVENT_CANCEL", universityId: fx.university.id, clubId: club.id, payload: { eventId }, reason: "Salon kullanılamıyor, ertelendi." });
    await decideRequest(admin, fx.university.id, id, "APPROVE", null);
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ status: "CANCELLED" });
    expect((await listExploreEvents(fx.university.id, new Date())).items).toHaveLength(0);
  });
});
