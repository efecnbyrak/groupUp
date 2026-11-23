import "server-only";

import ExcelJS from "exceljs";

import { db } from "@/lib/db";

import { toFieldDef } from "./fields";
import { buildExportColumns, buildExportRow, type ExportRowSource, type FieldDef } from "./rules";
import { SNAPSHOT_COLUMNS } from "./registrations";

const STATUS_LABEL_TR: Record<string, string> = {
  APPLIED: "Değerlendiriliyor",
  ACCEPTED: "Kabul edildi",
  WAITLISTED: "Yedek listede",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

export interface ExportInput {
  fields: FieldDef[];
  rows: ExportRowSource[];
  locale?: string;
}

async function buildExportData(eventId: string): Promise<ExportInput> {
  const fieldRows = await db.eventFormField.findMany({ where: { eventId }, orderBy: { order: "asc" } });
  const fields = fieldRows.map(toFieldDef);
  const regs = await db.registration.findMany({
    where: { eventId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    select: { status: true, answers: true, profileSnapshot: true, createdAt: true, team: { select: { name: true } } },
  });
  const rows: ExportRowSource[] = regs.map((r) => ({
    snapshot: (r.profileSnapshot as Record<string, unknown>) ?? {},
    answers: (r.answers as Record<string, unknown>) ?? {},
    teamName: r.team?.name ?? null,
    status: r.status,
    createdAt: r.createdAt,
  }));
  return { fields, rows };
}

export async function buildExportRows(eventId: string): Promise<{ columns: { key: string; header: string }[]; rows: Record<string, string>[] }> {
  const { fields, rows } = await buildExportData(eventId);
  const columns = buildExportColumns(fields, SNAPSHOT_COLUMNS, "tr");
  return { columns, rows: rows.map((r) => buildExportRow(fields, columns, r, STATUS_LABEL_TR[r.status] ?? r.status)) };
}

export function toCsv(columns: { key: string; header: string }[], rows: Record<string, string>[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = columns.map((c) => esc(c.header)).join(",");
  const lines = rows.map((r) => columns.map((c) => esc(r[c.key] ?? "")).join(","));
  return ["﻿" + header, ...lines].join("\r\n");
}

export async function toXlsx(columns: { key: string; header: string }[], rows: Record<string, string>[], sheetName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, Math.min(40, c.header.length + 4)) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
