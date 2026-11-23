import "server-only";

import { z } from "zod";

import { applyEventUpdate, assertCancellable, assertPublishable, assertUpdatable, describeValue, eventContentSchema, EVENT_CONTENT_FIELDS, setEventStatus, translateEvent } from "@/modules/event";

import type { DiffRow } from "../domain/diff";
import { approvalError, requireClubContext } from "./common";
import { defineHandler } from "./types";

const eventRef = z.object({ eventId: z.string().min(1).max(40) });
const partialContent = eventContentSchema.partial();

/** EVENT_PUBLISH — içerik etkinlikte; talep süresince etkinlik PENDING (düzenlenemez). */
export const eventPublishHandler = defineHandler({
  type: "EVENT_PUBLISH",
  payloadSchema: eventRef,
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (p) => p.eventId,
  async validateCreate(tx, ctx, p) {
    const clubId = await requireClubContext(tx, ctx);
    await assertPublishable(tx, clubId, p.eventId, new Date());
  },
  afterCreate: (tx, _req, p) => setEventStatus(tx, p.eventId, "DRAFT", "PENDING"),
  apply: (tx, _req, p) => setEventStatus(tx, p.eventId, "PENDING", "PUBLISHED"),
  onReject: (tx, _req, p) => setEventStatus(tx, p.eventId, "PENDING", "DRAFT"),
  onCancel: (tx, _req, p) => setEventStatus(tx, p.eventId, "PENDING", "DRAFT"),
  afterCommit: async (_req, p) => {
    await translateEvent(p.eventId);
  },
  describe: () => [],
});

/** EVENT_UPDATE — yayındaki hal değişmez; değişen alanlar `after`'da (APPROVALS-TICKETS §4). */
export const eventUpdateHandler = defineHandler({
  type: "EVENT_UPDATE",
  payloadSchema: eventRef.extend({ before: partialContent, after: partialContent }),
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (p) => p.eventId,
  async validateCreate(tx, ctx, p) {
    const clubId = await requireClubContext(tx, ctx);
    if (Object.keys(p.after).length === 0) throw approvalError("NO_CHANGES");
    await assertUpdatable(tx, clubId, p.eventId, p.after, new Date());
  },
  apply: (tx, _req, p) => applyEventUpdate(tx, p.eventId, p.after),
  afterCommit: async (_req, p) => {
    await translateEvent(p.eventId);
  },
  describe: (p) => {
    const rows: DiffRow[] = [];
    for (const field of EVENT_CONTENT_FIELDS) {
      if (!(field in p.after)) continue;
      rows.push({ field, before: describeValue(field, p.before[field]), after: describeValue(field, p.after[field]) });
    }
    return rows;
  },
});

/** EVENT_CANCEL — yalnızca Başkan, gerekçe zorunlu. */
export const eventCancelHandler = defineHandler({
  type: "EVENT_CANCEL",
  payloadSchema: eventRef,
  requiresReason: true,
  requiresAttachment: false,
  targetOf: (p) => p.eventId,
  async validateCreate(tx, ctx, p) {
    const clubId = await requireClubContext(tx, ctx);
    await assertCancellable(tx, clubId, p.eventId);
  },
  apply: (tx, _req, p) => setEventStatus(tx, p.eventId, "PUBLISHED", "CANCELLED"),
  describe: () => [],
});
