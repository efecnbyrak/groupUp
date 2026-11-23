import "server-only";

import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/lib/db-types";

import type { FieldConfig, FieldDef, FieldOption, FormFieldType } from "./rules";
import { FILE_ACCEPT } from "./rules";
import { fail } from "./service";
import { findTemplate } from "./templates";

interface Actor {
  id: string;
}

const fieldSelect = {
  id: true,
  eventId: true,
  type: true,
  order: true,
  labelTr: true,
  labelEn: true,
  helpTr: true,
  helpEn: true,
  required: true,
  teamLevel: true,
  hidden: true,
  options: true,
  config: true,
  showIfFieldId: true,
  showIfValue: true,
} as const satisfies Prisma.EventFormFieldSelect;

type Row = Prisma.EventFormFieldGetPayload<{ select: typeof fieldSelect }>;

export function toFieldDef(row: Row): FieldDef {
  return {
    id: row.id,
    type: row.type,
    order: row.order,
    labelTr: row.labelTr,
    required: row.required,
    teamLevel: row.teamLevel,
    hidden: row.hidden,
    options: (row.options as FieldOption[] | null) ?? null,
    config: (row.config as FieldConfig | null) ?? null,
    showIfFieldId: row.showIfFieldId,
    showIfValue: row.showIfValue,
  };
}

/** Kulübe ait etkinlik (tenant + kulüp kapsamı). */
async function loadEventInClub(client: Tx | typeof db, clubId: string, eventId: string) {
  const e = await client.event.findFirst({ where: { id: eventId, clubId, club: { deletedAt: null } }, select: { id: true, universityId: true, status: true, mode: true } });
  if (!e) throw fail("NOT_FOUND");
  return e;
}

/** Form oluşturucu: tüm alanlar (gizli dahil), sıralı. */
export async function listFields(clubId: string, eventId: string): Promise<Row[]> {
  await loadEventInClub(db, clubId, eventId);
  return db.eventFormField.findMany({ where: { eventId }, orderBy: { order: "asc" }, select: fieldSelect });
}

/** Başvuru formu / içerik: yalnızca gizli olmayanlar. */
export async function listVisibleFields(eventId: string): Promise<Row[]> {
  return db.eventFormField.findMany({ where: { eventId, hidden: false }, orderBy: { order: "asc" }, select: fieldSelect });
}

function buildConfig(input: {
  type: FormFieldType;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  minSelect?: number;
  maxSelect?: number;
  maxMb?: number;
  acceptPdf?: boolean;
  acceptImage?: boolean;
}): FieldConfig | null {
  const cfg: FieldConfig = {};
  if (input.type === "SHORT_TEXT" && input.maxLength) cfg.maxLength = Math.min(input.maxLength, 2000);
  if (input.type === "LONG_TEXT" && input.maxLength) cfg.maxLength = Math.min(input.maxLength, 10_000);
  if (input.type === "NUMBER") {
    if (input.min !== undefined) cfg.min = input.min;
    if (input.max !== undefined) cfg.max = input.max;
    if (input.integer) cfg.integer = true;
  }
  if (input.type === "MULTI_CHOICE") {
    if (input.minSelect !== undefined) cfg.minSelect = input.minSelect;
    if (input.maxSelect !== undefined) cfg.maxSelect = input.maxSelect;
  }
  if (input.type === "FILE") {
    const accept: ("pdf" | "jpg" | "png" | "webp")[] = [];
    if (input.acceptPdf) accept.push("pdf");
    if (input.acceptImage) accept.push("jpg", "png", "webp");
    cfg.accept = accept.length ? accept : [...FILE_ACCEPT];
    cfg.maxMb = Math.min(input.maxMb ?? 10, 10);
  }
  return Object.keys(cfg).length ? cfg : null;
}

export interface FieldInput {
  type: FormFieldType;
  labelTr: string;
  helpTr: string | null;
  required: boolean;
  teamLevel: boolean;
  optionsText: { value: string; labelTr: string; labelEn: string }[];
  maxLength?: number;
  min?: number;
  max?: number;
  integer: boolean;
  minSelect?: number;
  maxSelect?: number;
  maxMb?: number;
  acceptPdf: boolean;
  acceptImage: boolean;
  showIfFieldId: string | null;
  showIfValue: string | null;
}

const CHOICE_TYPES = new Set(["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"]);

export async function createField(actor: Actor, clubId: string, eventId: string, input: FieldInput): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const event = await loadEventInClub(tx, clubId, eventId);
    if (event.status === "CANCELLED" || event.status === "COMPLETED") throw fail("NOT_EDITABLE");
    if (input.showIfFieldId) {
      const ref = await tx.eventFormField.findFirst({ where: { id: input.showIfFieldId, eventId }, select: { id: true } });
      if (!ref) throw fail("NOT_FOUND", { showIfFieldId: "validation.invalid" });
    }
    const max = await tx.eventFormField.aggregate({ where: { eventId }, _max: { order: true } });
    const row = await tx.eventFormField.create({
      data: {
        eventId,
        type: input.type,
        order: (max._max.order ?? -1) + 1,
        labelTr: input.labelTr,
        helpTr: input.helpTr,
        required: input.required,
        teamLevel: event.mode === "TEAM" ? input.teamLevel : false,
        options: (CHOICE_TYPES.has(input.type) ? input.optionsText : []) as unknown as Prisma.InputJsonValue,
        config: (buildConfig(input) ?? {}) as unknown as Prisma.InputJsonValue,
        showIfFieldId: input.showIfFieldId,
        showIfValue: (input.showIfValue ?? null) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await audit({ action: "registration.field.created", targetType: "EventFormField", targetId: row.id, actorId: actor.id, universityId: event.universityId, meta: { eventId, type: input.type } }, tx);
    return row;
  });
}

export async function updateField(actor: Actor, clubId: string, eventId: string, fieldId: string, input: FieldInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEventInClub(tx, clubId, eventId);
    if (event.status === "CANCELLED" || event.status === "COMPLETED") throw fail("NOT_EDITABLE");
    const existing = await tx.eventFormField.findFirst({ where: { id: fieldId, eventId }, select: { id: true } });
    if (!existing) throw fail("NOT_FOUND");
    if (input.showIfFieldId === fieldId) throw fail("NOT_FOUND", { showIfFieldId: "validation.invalid" });
    const { count } = await tx.eventFormField.updateMany({
      where: { id: fieldId, eventId },
      data: {
        labelTr: input.labelTr,
        helpTr: input.helpTr,
        required: input.required,
        teamLevel: event.mode === "TEAM" ? input.teamLevel : false,
        options: (CHOICE_TYPES.has(input.type) ? input.optionsText : []) as unknown as Prisma.InputJsonValue,
        config: (buildConfig({ ...input, type: input.type }) ?? {}) as unknown as Prisma.InputJsonValue,
        showIfFieldId: input.showIfFieldId,
        showIfValue: (input.showIfValue ?? null) as unknown as Prisma.InputJsonValue,
      },
    });
    if (count === 0) throw fail("NOT_FOUND");
    await audit({ action: "registration.field.updated", targetType: "EventFormField", targetId: fieldId, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
  });
}

export async function reorderField(clubId: string, eventId: string, fieldId: string, direction: "up" | "down"): Promise<void> {
  await db.$transaction(async (tx) => {
    await loadEventInClub(tx, clubId, eventId);
    const fields = await tx.eventFormField.findMany({ where: { eventId }, orderBy: { order: "asc" }, select: { id: true, order: true } });
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) throw fail("NOT_FOUND");
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fields.length) return;
    const a = fields[idx]!;
    const b = fields[swapIdx]!;
    await tx.eventFormField.update({ where: { id: a.id }, data: { order: b.order } });
    await tx.eventFormField.update({ where: { id: b.id }, data: { order: a.order } });
  });
}

export async function toggleFieldHidden(clubId: string, eventId: string, fieldId: string, hidden: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    await loadEventInClub(tx, clubId, eventId);
    const { count } = await tx.eventFormField.updateMany({ where: { id: fieldId, eventId }, data: { hidden } });
    if (count === 0) throw fail("NOT_FOUND");
  });
}

/** Etkinlikte hiç başvuru/takım yoksa alan tamamen silinir; varsa yalnızca gizlenir (veri kaybı olmaz). */
export async function deleteField(actor: Actor, clubId: string, eventId: string, fieldId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await loadEventInClub(tx, clubId, eventId);
    const field = await tx.eventFormField.findFirst({ where: { id: fieldId, eventId }, select: { id: true } });
    if (!field) throw fail("NOT_FOUND");
    const used = (await tx.registration.count({ where: { eventId } })) > 0 || (await tx.team.count({ where: { eventId } })) > 0;
    if (used) {
      await tx.eventFormField.update({ where: { id: fieldId }, data: { hidden: true } });
      return;
    }
    await tx.eventFormField.delete({ where: { id: fieldId } });
    await audit({ action: "registration.field.deleted", targetType: "EventFormField", targetId: fieldId, actorId: actor.id, universityId: event.universityId, meta: { eventId } }, tx);
  });
}

/** Hazır şablon: eksik olan alanları (aynı etiket yoksa) sona ekler. */
export async function applyTemplate(actor: Actor, clubId: string, eventId: string, templateKey: string): Promise<number> {
  const template = findTemplate(templateKey);
  if (!template) throw fail("NOT_FOUND");
  return db.$transaction(async (tx) => {
    const event = await loadEventInClub(tx, clubId, eventId);
    if (event.status === "CANCELLED" || event.status === "COMPLETED") throw fail("NOT_EDITABLE");
    const existing = await tx.eventFormField.findMany({ where: { eventId }, select: { labelTr: true, order: true } });
    const labels = new Set(existing.map((f) => f.labelTr));
    let order = existing.reduce((m, f) => Math.max(m, f.order), -1) + 1;
    let created = 0;
    for (const f of template.fields) {
      if (labels.has(f.labelTr)) continue;
      await tx.eventFormField.create({
        data: {
          eventId,
          type: f.type,
          order: order++,
          labelTr: f.labelTr,
          labelEn: f.labelEn,
          required: f.required,
          teamLevel: event.mode === "TEAM" ? Boolean(f.teamLevel) : false,
          options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : undefined,
          config: f.config ? (f.config as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
      created++;
    }
    if (created) await audit({ action: "registration.field.template", targetType: "Event", targetId: eventId, actorId: actor.id, universityId: event.universityId, meta: { templateKey, created } }, tx);
    return created;
  });
}
