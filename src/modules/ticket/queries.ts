import "server-only";

import { signedAttachmentUrl } from "@/lib/attachments";
import type { SessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import type { TicketStatus } from "@/lib/db-types";

import { ticketSide } from "./service";

export const TICKET_PAGE_SIZE = 25;
const person = { id: true, email: true, profile: { select: { firstName: true, lastName: true, avatarKey: true } } } as const;
const listSelect = {
  id: true,
  scope: true,
  category: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  club: { select: { id: true, name: true, slug: true } },
  _count: { select: { messages: true } },
} as const;

type Where = { universityId?: string; clubId?: string; scope?: "CLUB_TO_ADMIN" | "ADMIN_TO_PLATFORM" };

async function list(where: Where, status: TicketStatus | undefined, cursor: string | undefined) {
  const rows = await db.ticket.findMany({
    where: { ...where, ...(status ? { status } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: TICKET_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: listSelect,
  });
  const hasMore = rows.length > TICKET_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, TICKET_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

/** Kulüp paneli "Destek". */
export const listClubTickets = (clubId: string, status?: TicketStatus, cursor?: string) => list({ clubId, scope: "CLUB_TO_ADMIN" }, status, cursor);
/** Admin paneli: kulüplerden gelenler. */
export const listAdminInbox = (universityId: string, status?: TicketStatus, cursor?: string) => list({ universityId, scope: "CLUB_TO_ADMIN" }, status, cursor);
/** Admin paneli: Süper Admin'e açtıkları. */
export const listAdminOutbox = (universityId: string, status?: TicketStatus, cursor?: string) => list({ universityId, scope: "ADMIN_TO_PLATFORM" }, status, cursor);
/** Platform paneli. */
export const listPlatformTickets = (status?: TicketStatus, cursor?: string) => list({ scope: "ADMIN_TO_PLATFORM" }, status, cursor);

export function openTicketCount(where: Where & { status?: TicketStatus }) {
  return db.ticket.count({ where: { ...where, status: where.status ?? "OPEN" } });
}

/** Ticket + mesajlar (+ imzalı ek adresleri). Erişimi yoksa null (sayfa 404 gösterir). */
export async function getTicketForUser(user: SessionUser, ticketId: string) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ...listSelect,
      universityId: true,
      clubId: true,
      closedAt: true,
      changeRequestId: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
        select: { id: true, body: true, createdAt: true, authorId: true, attachments: { select: { id: true, fileName: true, sizeBytes: true, storageKey: true } } },
      },
    },
  });
  if (!ticket) return null;
  const side = await ticketSide(user, ticket);
  if (!side) return null;
  const authors = new Map((await db.user.findMany({ where: { id: { in: [...new Set(ticket.messages.map((m) => m.authorId))] } }, select: person })).map((u) => [u.id, u]));
  return {
    ...ticket,
    side,
    messages: ticket.messages.map((m) => ({
      ...m,
      author: authors.get(m.authorId) ?? null,
      attachments: m.attachments.map(({ storageKey, ...a }) => ({ ...a, url: signedAttachmentUrl(storageKey) })),
    })),
  };
}
