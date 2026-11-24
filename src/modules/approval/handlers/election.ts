import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { setPresidentFromElection, listActiveMemberIds } from "@/modules/club";
import { finalizeElection, voidElectionResult } from "@/modules/election";
import { getMailRecipient } from "@/modules/identity";
import { notify, sendEmailSafe } from "@/modules/notification";
import { db } from "@/lib/db";

import type { DiffRow } from "../domain/diff";
import { approvalError, clubIdOf, requireClubContext } from "./common";
import { defineHandler } from "./types";

const countsSchema = z.record(z.string(), z.number());

/**
 * ELECTION_RESULT — cron route (`/api/cron/hourly`) oy sayımını hesaplayıp bu talebi oluşturur
 * (election → approval bağımlılığı yok: cron route app katmanında her iki modülü de import eder).
 * Admin onaylarsa kazanan Başkan olur; reddederse seçim iptal (CANCELLED) — ELECTIONS §2.
 */
export const electionResultHandler = defineHandler({
  type: "ELECTION_RESULT",
  payloadSchema: z.object({
    electionId: z.string().min(1),
    winnerUserId: z.string().min(1).nullable(),
    tie: z.boolean(),
    counts: countsSchema,
    totalBallots: z.number().int().min(0),
  }),
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (p) => p.electionId,
  async validateCreate(tx, ctx, p) {
    const clubId = await requireClubContext(tx, ctx);
    const election = await tx.election.findFirst({ where: { id: p.electionId, clubId, status: "CLOSED" }, select: { id: true } });
    if (!election) throw approvalError("NOT_FOUND");
  },
  async apply(tx, request, p) {
    if (p.winnerUserId) await setPresidentFromElection(tx, clubIdOf(request), p.winnerUserId);
    await finalizeElection(tx, p.electionId, p.winnerUserId);
  },
  async onReject(tx, _request, p) {
    await voidElectionResult(tx, p.electionId);
  },
  describe: (p) => {
    const rows: DiffRow[] = [
      { field: "tie", before: null, after: p.tie },
      { field: "totalBallots", before: null, after: p.totalBallots },
    ];
    if (p.winnerUserId) rows.push({ field: "winnerUserId", before: null, after: p.winnerUserId });
    return rows;
  },
  async afterCommit(request, p) {
    const clubId = clubIdOf(request);
    const club = await db.club.findUnique({ where: { id: clubId }, select: { name: true, slug: true } });
    if (!club) return;
    const winnerProfile = p.winnerUserId ? await db.profile.findUnique({ where: { userId: p.winnerUserId }, select: { firstName: true, lastName: true } }) : null;
    const winnerName = winnerProfile ? `${winnerProfile.firstName} ${winnerProfile.lastName}` : null;
    const memberIds = await listActiveMemberIds(clubId);
    const url = `${env.APP_URL}/kulupler/${club.slug}`;
    for (const userId of memberIds) {
      const recipient = await getMailRecipient(db, userId);
      if (!recipient) continue;
      await sendEmailSafe(recipient.email, "election-result", recipient.locale, { name: recipient.name, clubName: club.name, winnerName, url });
      await notify({ userId, type: "ELECTION", titleTr: "Seçim sonuçlandı", titleEn: "Election decided", bodyTr: club.name, bodyEn: club.name, href: `/kulupler/${club.slug}` });
    }
  },
});
