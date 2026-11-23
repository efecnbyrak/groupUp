"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/i18n/action-result";
import { filesFromForm } from "@/lib/attachments";
import { requireClubPermission, requireUniversityAdmin, requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";

import { TICKET_ERROR_KEYS as errors } from "./errors";
import { openAdminTicketSchema, openClubTicketSchema, replySchema, ticketIdSchema } from "./schemas";
import { closeTicket, openAdminTicket, openClubTicket, reopenTicket, replyTicket } from "./service";

type Prev = ActionResult | null;
const refresh = () => revalidatePath("/", "layout");
const limit = (userId: string) => enforceRateLimits([{ key: `ticket:user:${userId}`, limit: 60, windowSec: 3600 }]);

/** Kulüp → Admin. Başarıda ticket sayfasına gider (`returnTo` + id). */
export async function openClubTicketAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubPermission(clubId, "TICKET_OPEN", { allowAdmin: false }),
    schema: openClubTicketSchema,
    errors,
    run: async (user, data, _t, fd) => {
      await limit(user.id);
      const { clubId: _c, ...input } = data;
      const id = await openClubTicket(user, clubId, input, await filesFromForm(fd, "files"));
      refresh();
      const returnTo = String(fd.get("returnTo") ?? "");
      redirect(/^\/panel\/kulup\/[a-z0-9-]+\/destek$/.test(returnTo) ? `${returnTo}/${id}` : "/akis");
    },
  });
}

export async function openAdminTicketAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: openAdminTicketSchema,
    errors,
    run: async (user, data, _t, fd) => {
      await limit(user.id);
      const { universityId: _u, ...input } = data;
      const id = await openAdminTicket(user, universityId, input, await filesFromForm(fd, "files"));
      refresh();
      redirect(`/panel/admin/destek/${id}`);
    },
  });
}

export async function replyTicketAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: replySchema,
    errors,
    run: async (user, data, t, fd) => {
      await limit(user.id);
      await replyTicket(user, data.ticketId, data.body, await filesFromForm(fd, "files"));
      refresh();
      return { ok: true, message: t("ticket.sent") };
    },
  });
}

export async function closeTicketAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: ticketIdSchema,
    errors,
    run: async (user, data, t) => {
      await closeTicket(user, data.ticketId);
      refresh();
      return { ok: true, message: t("ticket.closedDone") };
    },
  });
}

export async function reopenTicketAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: ticketIdSchema,
    errors,
    run: async (user, data, t) => {
      await reopenTicket(user, data.ticketId);
      refresh();
      return { ok: true, message: t("ticket.reopened") };
    },
  });
}
