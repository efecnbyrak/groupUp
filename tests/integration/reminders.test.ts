import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createEventDraft } from "@/modules/event";
import { applyToEvent, sendDeadlineReminders, sendEventReminders } from "@/modules/registration";

import { clubFixture, lastMailTo, resetDatabase } from "./helpers";

const DAY = 86_400_000;

describe("F10 saatlik cron: hatırlatmalar", () => {
  let fx: Awaited<ReturnType<typeof resetDatabase>>;

  beforeEach(async () => {
    fx = await resetDatabase();
  });

  async function publishedEvent(overrides: Record<string, unknown>) {
    const fixture = await clubFixture(fx.university.id, { members: 3 });
    const category = await db.eventCategory.create({ data: { slug: `kat-${Date.now()}-${Math.random()}`, nameTr: "Test", nameEn: "Test" } });
    const { id: eventId } = await createEventDraft(fixture.president, fixture.club.id, { categoryId: category.id, titleTr: "Hackathon" });
    const now = Date.now();
    await db.event.update({
      where: { id: eventId },
      data: {
        status: "PUBLISHED",
        summaryTr: "Özet",
        startAt: new Date(now + 10 * DAY),
        applyOpensAt: new Date(now - DAY),
        capacity: null,
        waitlistEnabled: false,
        autoAccept: true,
        mode: "INDIVIDUAL",
        eligibility: "ALL_MEMBERS",
        publishedAt: new Date(now - DAY),
        ...overrides,
      },
    });
    return { ...fixture, eventId };
  }

  it("deadline-reminder: 24 saat içinde kapanan, başvurmamış üyeye bir kez gider", async () => {
    const now = Date.now();
    const { members, eventId } = await publishedEvent({ applyClosesAt: new Date(now + 24 * 3600_000) });
    const [applied, notApplied1, notApplied2] = members;
    await applyToEvent(applied!, eventId, {});

    const sent = await sendDeadlineReminders(new Date(now));
    expect(sent).toBe(3); // başkan + 2 üye (president de kulüp üyesi sayılır)
    expect(lastMailTo(notApplied1!.email)?.subject).toMatch(/Hackathon/);
    expect(lastMailTo(notApplied2!.email)?.subject).toMatch(/Hackathon/);
    expect(await db.notification.count({ where: { type: "DEADLINE_REMINDER" } })).toBe(3);

    // ikinci çalıştırmada applyReminderSentAt set edildiği için tekrar gönderilmez
    const sentAgain = await sendDeadlineReminders(new Date(now));
    expect(sentAgain).toBe(0);
  });

  it("deadline-reminder penceresi dışındaki etkinliği atlar", async () => {
    const now = Date.now();
    await publishedEvent({ applyClosesAt: new Date(now + 3 * DAY) });
    expect(await sendDeadlineReminders(new Date(now))).toBe(0);
  });

  it("event-reminder: 24 saat içinde başlayan, kabul edilen başvuru sahibine bir kez gider", async () => {
    const now = Date.now();
    const { members, eventId } = await publishedEvent({ startAt: new Date(now + 24 * 3600_000), applyClosesAt: new Date(now + 23 * 3600_000) });
    const [accepted] = members;
    await applyToEvent(accepted!, eventId, {});

    const sent = await sendEventReminders(new Date(now));
    expect(sent).toBe(1);
    expect(lastMailTo(accepted!.email)?.subject).toMatch(/Hackathon/);
    expect(await db.notification.count({ where: { userId: accepted!.id } })).toBe(1);

    expect(await sendEventReminders(new Date(now))).toBe(0);
  });
});
