import "server-only";

import { z } from "zod";

import { MAX_STAFF, STAFF_PERMISSIONS } from "@/lib/club-roles";
import type { Tx } from "@/lib/db";
import { assertActiveNonPresidentMember, assignStaff, getStaffAssignment, listStaffUserIds, lockClub, removeStaff } from "@/modules/club";

import { diffFields } from "../domain/diff";
import { wouldExceedStaffLimit } from "../domain/staff-limit";
import { approvalError, clubIdOf, requireClubContext } from "./common";
import { defineHandler } from "./types";

const snapshot = z.object({ title: z.string(), permissions: z.array(z.enum(STAFF_PERMISSIONS)) }).nullable();

async function pendingAssignTargets(tx: Tx, clubId: string): Promise<string[]> {
  const rows = await tx.changeRequest.findMany({ where: { clubId, type: "STAFF_ASSIGN", status: "PENDING" }, select: { targetId: true } });
  return rows.map((r) => r.targetId);
}

/** STAFF_ASSIGN — ata veya unvan/yetki güncelle. Ekip sınırı (Başkan + 9) kilit altında sayılır. */
export const staffAssignHandler = defineHandler({
  type: "STAFF_ASSIGN",
  payloadSchema: z.object({ userId: z.string().min(1), title: z.string().min(1).max(60), permissions: z.array(z.enum(STAFF_PERMISSIONS)), before: snapshot }),
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (p) => p.userId,
  async validateCreate(tx, ctx, payload) {
    const clubId = await requireClubContext(tx, ctx);
    await lockClub(tx, clubId);
    await assertActiveNonPresidentMember(clubId, payload.userId, tx);
    const [staff, pending] = await Promise.all([listStaffUserIds(tx, clubId), pendingAssignTargets(tx, clubId)]);
    if (wouldExceedStaffLimit(payload.userId, staff, pending, MAX_STAFF)) throw approvalError("STAFF_LIMIT");
  },
  async apply(tx, request, payload) {
    const clubId = clubIdOf(request);
    await lockClub(tx, clubId);
    const staff = await listStaffUserIds(tx, clubId);
    if (wouldExceedStaffLimit(payload.userId, staff, [], MAX_STAFF)) throw approvalError("STAFF_LIMIT");
    await assignStaff(tx, clubId, payload.userId, payload.title, payload.permissions);
  },
  describe: (p) => diffFields({ title: p.before?.title ?? null, permissions: p.before?.permissions ?? null }, { title: p.title, permissions: p.permissions }),
});

/** STAFF_REMOVE — gerekçe opsiyonel. */
export const staffRemoveHandler = defineHandler({
  type: "STAFF_REMOVE",
  payloadSchema: z.object({ userId: z.string().min(1), before: snapshot }),
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (p) => p.userId,
  async validateCreate(tx, ctx, payload) {
    const clubId = await requireClubContext(tx, ctx);
    if (!(await getStaffAssignment(clubId, payload.userId, tx))) throw approvalError("NOT_FOUND");
  },
  async apply(tx, request, payload) {
    await removeStaff(tx, clubIdOf(request), payload.userId);
  },
  describe: (p) => diffFields({ title: p.before?.title ?? null, permissions: p.before?.permissions ?? null }, { title: null, permissions: null }),
});

export { getStaffAssignment };
