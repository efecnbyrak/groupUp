import "server-only";

import { discardPrivateFiles, storePrivateFiles, type IncomingFile, type StoredAttachment } from "@/lib/attachments";
import { audit } from "@/lib/audit";
import { ForbiddenError, getClubAccess, isUniversityAdmin, type SessionUser } from "@/lib/authz";
import { hasClubPermission } from "@/lib/club-roles";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { attachToTicketMessage } from "@/modules/approval";

import { canClose, canReopen, statusAfterMessage, type TicketSide } from "./rules";
import type { OpenTicketInput } from "./schemas";

export type TicketErrorCode = "NOT_FOUND" | "CLOSED" | "REOPEN_EXPIRED" | "NOT_CLOSED";
const fail = (code: TicketErrorCode) => new ServiceError(code);

interface TicketRef {
  scope: "CLUB_TO_ADMIN" | "ADMIN_TO_PLATFORM";
  universityId: string;
  clubId: string | null;
}

/**
 * Kullanıcının ticket'taki tarafı: talep eden (kulüp ekibi / üniversite Admini) veya yanıtlayan
 * (üniversite Admini / Süper Admin). Erişimi yoksa null. Süper Admin CLUB_TO_ADMIN'i görmez.
 */
export async function ticketSide(user: SessionUser, ticket: TicketRef): Promise<TicketSide | null> {
  if (ticket.scope === "ADMIN_TO_PLATFORM") {
    if (user.platformRole === "SUPER_ADMIN") return "responder";
    return (await isUniversityAdmin(user, ticket.universityId)) ? "requester" : null;
  }
  if (!ticket.clubId) return null;
  const access = await getClubAccess(user, ticket.clubId);
  if (access && hasClubPermission({ ...access, isAdmin: false }, "TICKET_OPEN")) return "requester";
  if (user.platformRole !== "SUPER_ADMIN" && (await isUniversityAdmin(user, ticket.universityId))) return "responder";
  return null;
}

async function withFiles<T>(files: IncomingFile[], ownerId: string, run: (stored: StoredAttachment[]) => Promise<T>): Promise<T> {
  const stored = files.length ? await storePrivateFiles(files, "tickets", ownerId) : [];
  try {
    return await run(stored);
  } catch (err) {
    await discardPrivateFiles(stored);
    throw err;
  }
}

async function open(actor: { id: string }, ref: TicketRef, input: OpenTicketInput, files: IncomingFile[]): Promise<string> {
  return withFiles(files, actor.id, (stored) =>
    db.$transaction(async (tx) => {
      // Bağlantılı talep aynı üniversitede olmalı (tenant izolasyonu).
      const changeRequestId = input.changeRequestId && (await tx.changeRequest.findFirst({ where: { id: input.changeRequestId, universityId: ref.universityId }, select: { id: true } })) ? input.changeRequestId : null;
      const ticket = await tx.ticket.create({
        data: { ...ref, category: input.category, subject: input.subject, openedById: actor.id, changeRequestId },
        select: { id: true },
      });
      const message = await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorId: actor.id, body: input.body }, select: { id: true } });
      await attachToTicketMessage(tx, message.id, actor.id, stored);
      await audit({ action: "ticket.ticket.opened", targetType: "Ticket", targetId: ticket.id, actorId: actor.id, universityId: ref.universityId, meta: { scope: ref.scope, clubId: ref.clubId } }, tx);
      return ticket.id;
    }),
  );
}

/** Kulüp → Admin (Başkan / TICKET_OPEN görevli; yetki action'da). */
export async function openClubTicket(actor: { id: string }, clubId: string, input: OpenTicketInput, files: IncomingFile[] = []): Promise<string> {
  const club = await db.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { universityId: true } });
  if (!club) throw fail("NOT_FOUND");
  return open(actor, { scope: "CLUB_TO_ADMIN", universityId: club.universityId, clubId }, input, files);
}

/** Admin → Platform. */
export async function openAdminTicket(actor: { id: string }, universityId: string, input: OpenTicketInput, files: IncomingFile[] = []): Promise<string> {
  return open(actor, { scope: "ADMIN_TO_PLATFORM", universityId, clubId: null }, input, files);
}

async function loadForUser(user: SessionUser, ticketId: string) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, scope: true, universityId: true, clubId: true, status: true, closedAt: true } });
  if (!ticket) throw fail("NOT_FOUND");
  const side = await ticketSide(user, ticket);
  if (!side) throw new ForbiddenError();
  return { ticket, side };
}

export async function replyTicket(user: SessionUser, ticketId: string, body: string, files: IncomingFile[] = []): Promise<void> {
  const { ticket, side } = await loadForUser(user, ticketId);
  const next = statusAfterMessage(ticket.status, side);
  if (!next) throw fail("CLOSED");
  await withFiles(files, user.id, (stored) =>
    db.$transaction(async (tx) => {
      const { count } = await tx.ticket.updateMany({ where: { id: ticketId, status: { not: "CLOSED" } }, data: { status: next } });
      if (count === 0) throw fail("CLOSED");
      const message = await tx.ticketMessage.create({ data: { ticketId, authorId: user.id, body }, select: { id: true } });
      await attachToTicketMessage(tx, message.id, user.id, stored);
    }),
  );
}

export async function closeTicket(user: SessionUser, ticketId: string): Promise<void> {
  const { ticket } = await loadForUser(user, ticketId);
  if (!canClose(ticket.status)) throw fail("CLOSED");
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data: { status: "CLOSED", closedAt: new Date() } });
    await audit({ action: "ticket.ticket.closed", targetType: "Ticket", targetId: ticketId, actorId: user.id, universityId: ticket.universityId }, tx);
  });
}

export async function reopenTicket(user: SessionUser, ticketId: string, now = new Date()): Promise<void> {
  const { ticket } = await loadForUser(user, ticketId);
  if (ticket.status !== "CLOSED") throw fail("NOT_CLOSED");
  if (!canReopen(ticket.status, ticket.closedAt, now)) throw fail("REOPEN_EXPIRED");
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticketId }, data: { status: "OPEN", closedAt: null } });
    await audit({ action: "ticket.ticket.reopened", targetType: "Ticket", targetId: ticketId, actorId: user.id, universityId: ticket.universityId }, tx);
  });
}
