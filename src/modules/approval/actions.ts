"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/i18n/action-result";
import { filesFromForm } from "@/lib/attachments";
import { requireClubPermission, requirePendingAlumni, requireUniversityAdmin, requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";
import { clubInfoSchema, getClubInfo, getStaffAssignment, storeClubImage } from "@/modules/club";
import { EVENT_CONTENT_FIELDS, eventContentSchema, getEventContent, type EventContent } from "@/modules/event";

import { changedOnly } from "./domain/diff";
import { APPROVAL_ERROR_KEYS as errors } from "./errors";
import { approvalError } from "./handlers/common";
import { approveSchema, memberBanFormSchema, memberRemoveFormSchema, rejectSchema, requestIdSchema, staffAssignFormSchema, staffRemoveFormSchema } from "./schemas";
import { cancelRequest, decideRequest, submitRequest } from "./service";

type Prev = ActionResult | null;
/** Talepler panel sayaçlarını, kuyruk ve kulüp panelini etkiler. */
const refresh = () => revalidatePath("/", "layout");
const president = (clubId: string) => () => requireClubPermission(clubId, "PRESIDENT", { allowAdmin: false });
const limit = (userId: string) => enforceRateLimits([{ key: `approval:create:${userId}`, limit: 60, windowSec: 3600 }]);

// ---------------------------------------------------------------- Admin kararı

export async function approveRequestAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: approveSchema,
    errors,
    run: async (user, data, t) => {
      await decideRequest(user, universityId, data.requestId, "APPROVE", null);
      refresh();
      return { ok: true, message: t("approval.decision.approved") };
    },
  });
}

export async function rejectRequestAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: rejectSchema,
    errors,
    run: async (user, data, t) => {
      await decideRequest(user, universityId, data.requestId, "REJECT", data.reason);
      refresh();
      return { ok: true, message: t("approval.decision.rejected") };
    },
  });
}

export async function cancelRequestAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: requestIdSchema,
    errors,
    run: async (user, data, t) => {
      await cancelRequest(user, data.requestId);
      refresh();
      return { ok: true, message: t("approval.cancelled") };
    },
  });
}

// ---------------------------------------------------------------- Başkan talepleri

export async function requestClubUpdateAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: clubInfoSchema.extend({ clubId: z.string().min(1).max(40) }),
    errors,
    run: async (user, data, t, fd) => {
      await limit(user.id);
      const current = await getClubInfo(clubId);
      const { universityId, name: _name, ...before } = current;
      const images: { logoKey?: string; coverKey?: string } = {};
      for (const kind of ["logo", "cover"] as const) {
        const file = fd.get(kind);
        if (file instanceof File && file.size > 0) images[`${kind}Key`] = await storeClubImage(clubId, kind, Buffer.from(await file.arrayBuffer()));
      }
      const { clubId: _c, ...info } = data;
      const after = changedOnly(before, { ...info, ...images });
      if (Object.keys(after).length === 0) throw approvalError("NO_CHANGES");
      const beforeChanged = Object.fromEntries(Object.keys(after).map((k) => [k, before[k as keyof typeof before]]));
      await submitRequest(user, { type: "CLUB_UPDATE", universityId, clubId, payload: { before: beforeChanged, after } });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

export async function requestStaffAssignAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: staffAssignFormSchema,
    errors,
    run: async (user, data, t) => {
      await limit(user.id);
      const { universityId } = await getClubInfo(clubId);
      const before = await getStaffAssignment(clubId, data.userId);
      await submitRequest(user, { type: "STAFF_ASSIGN", universityId, clubId, payload: { userId: data.userId, title: data.title, permissions: data.permissions, before } });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

export async function requestStaffRemoveAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: staffRemoveFormSchema,
    errors,
    run: async (user, data, t) => {
      await limit(user.id);
      const { universityId } = await getClubInfo(clubId);
      const before = await getStaffAssignment(clubId, data.userId);
      await submitRequest(user, { type: "STAFF_REMOVE", universityId, clubId, payload: { userId: data.userId, before }, reason: data.reason });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

export async function requestMemberRemoveAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: memberRemoveFormSchema,
    errors,
    run: async (user, data, t, fd) => {
      await limit(user.id);
      const { universityId } = await getClubInfo(clubId);
      const files = await filesFromForm(fd, "files");
      await submitRequest(user, { type: "MEMBER_REMOVE", universityId, clubId, payload: { userId: data.userId }, reason: data.reason, files });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

export async function requestMemberBanAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: memberBanFormSchema,
    errors,
    run: async (user, data, t, fd) => {
      await limit(user.id);
      const { universityId } = await getClubInfo(clubId);
      const files = await filesFromForm(fd, "files");
      await submitRequest(user, { type: "MEMBER_BAN", universityId, clubId, payload: { userId: data.userId, until: data.until }, reason: data.reason, files });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

// ---------------------------------------------------------------- Etkinlik talepleri (F6)

const eventManager = (clubId: string) => () => requireClubPermission(clubId, "EVENT_MANAGE", { allowAdmin: false });
const eventIdField = z.string().min(1).max(40);

/** Taslağı onaya gönder (EVENT_PUBLISH). İstemci önce son hali kaydeder. */
export async function submitEventForApprovalAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: eventManager(clubId),
    schema: z.object({ eventId: eventIdField }),
    errors,
    run: async (user, data, t) => {
      await limit(user.id);
      const { universityId } = await getEventContent(clubId, data.eventId);
      await submitRequest(user, { type: "EVENT_PUBLISH", universityId, clubId, payload: { eventId: data.eventId } });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

/** Yayındaki etkinlikte değişiklik (EVENT_UPDATE): yalnızca değişen alanlar, yayındaki hal aynen kalır. */
export async function requestEventUpdateAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: eventManager(clubId),
    schema: z.object({
      eventId: eventIdField,
      data: z
        .string()
        .max(500_000)
        .transform((v, ctx) => {
          try {
            return JSON.parse(v) as unknown;
          } catch {
            ctx.addIssue({ code: "custom", message: "validation.invalid" });
            return z.NEVER;
          }
        })
        .pipe(eventContentSchema),
      reason: z.string().trim().max(500).optional(),
    }),
    errors,
    run: async (user, data, t) => {
      await limit(user.id);
      const current = await getEventContent(clubId, data.eventId);
      const before: Partial<EventContent> = {};
      const after: Partial<EventContent> = {};
      for (const f of EVENT_CONTENT_FIELDS) {
        if (JSON.stringify(current.content[f]) !== JSON.stringify(data.data[f])) {
          (before as Record<string, unknown>)[f] = current.content[f];
          (after as Record<string, unknown>)[f] = data.data[f];
        }
      }
      if (Object.keys(after).length === 0) throw approvalError("NO_CHANGES");
      await submitRequest(user, { type: "EVENT_UPDATE", universityId: current.universityId, clubId, payload: { eventId: data.eventId, before, after }, reason: data.reason });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

/** Etkinlik iptali (EVENT_CANCEL) — yalnızca Başkan, gerekçe zorunlu. */
export async function requestEventCancelAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: president(clubId),
    schema: z.object({ eventId: eventIdField, reason: z.string().trim().min(10, { error: "approval.validation.reasonTooShort" }).max(500, { error: "validation.tooLong" }) }),
    errors,
    run: async (user, data, t) => {
      await limit(user.id);
      const { universityId } = await getEventContent(clubId, data.eventId);
      await submitRequest(user, { type: "EVENT_CANCEL", universityId, clubId, payload: { eventId: data.eventId }, reason: data.reason });
      refresh();
      return { ok: true, message: t("approval.submitted") };
    },
  });
}

// ---------------------------------------------------------------- Mezun belgesi (AUTH-EMAIL §6)

export async function uploadAlumniDocumentAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requirePendingAlumni,
    schema: z.object({}),
    errors,
    run: async (user, _data, t, fd) => {
      await enforceRateLimits([{ key: `alumni-doc:user:${user.id}`, limit: 10, windowSec: 3600 }]);
      const files = await filesFromForm(fd, "document");
      if (files.length === 0) throw approvalError("ATTACHMENT_REQUIRED", { document: "validation.required" });
      if (!user.universityId) throw approvalError("NOT_FOUND");
      await submitRequest(user, { type: "ALUMNI_VERIFY", universityId: user.universityId, clubId: null, payload: {}, files: files.slice(0, 1) });
      revalidatePath("/mezun-dogrulama");
      return { ok: true, message: t("alumni.submitted") };
    },
  });
}
