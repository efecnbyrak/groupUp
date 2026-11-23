import "server-only";

import { z } from "zod";

import { assertActiveNonPresidentMember, banMember, removeMember } from "@/modules/club";

import { clubIdOf, requireClubContext } from "./common";
import { defineHandler } from "./types";

/** MEMBER_REMOVE — gerekçe + kanıt zorunlu; onayda Membership REMOVED (tekrar katılabilir). */
export const memberRemoveHandler = defineHandler({
  type: "MEMBER_REMOVE",
  payloadSchema: z.object({ userId: z.string().min(1) }),
  requiresReason: true,
  requiresAttachment: true,
  targetOf: (p) => p.userId,
  async validateCreate(tx, ctx, payload) {
    const clubId = await requireClubContext(tx, ctx);
    await assertActiveNonPresidentMember(clubId, payload.userId, tx);
  },
  async apply(tx, request, payload) {
    await removeMember(tx, clubIdOf(request), payload.userId);
  },
  describe: () => [{ field: "membership", before: "ACTIVE", after: "REMOVED" }],
});

/** MEMBER_BAN — `{userId, until?}`; until null = süresiz. Engellenen koda rağmen katılamaz. */
export const memberBanHandler = defineHandler({
  type: "MEMBER_BAN",
  payloadSchema: z.object({ userId: z.string().min(1), until: z.iso.date().nullable() }),
  requiresReason: true,
  requiresAttachment: true,
  targetOf: (p) => p.userId,
  async validateCreate(tx, ctx, payload) {
    const clubId = await requireClubContext(tx, ctx);
    await assertActiveNonPresidentMember(clubId, payload.userId, tx);
  },
  async apply(tx, request, payload) {
    // Bitiş günü dahil: ertesi gün 00:00 (İstanbul, UTC+3) itibarıyla engel kalkar.
    const until = payload.until ? new Date(`${payload.until}T21:00:00.000Z`) : null;
    await banMember(tx, clubIdOf(request), payload.userId, until);
  },
  describe: (p) => [
    { field: "membership", before: "ACTIVE", after: "BANNED" },
    { field: "bannedUntil", before: null, after: p.until },
  ],
});
