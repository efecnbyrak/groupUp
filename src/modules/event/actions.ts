"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";
import { z } from "zod";

import { runAction } from "@/i18n/action-result";
import { requireClubPermission, requireSuperAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";
import { publicFileUrl } from "@/lib/storage";

import { createAnnouncement, deleteAnnouncement } from "./announcements";
import { EVENT_ERROR_KEYS as errors } from "./errors";
import { createEventDraft, deleteEventDraft, saveEventDraft, storeEventImage } from "./events";
import { announcementSchema, eventCategoryIdSchema, eventCategorySchema, eventCategoryUpdateSchema, eventCreateSchema, eventImageSchema, eventSaveSchema } from "./schemas";
import { createEventCategory, deleteEventCategory, fail, updateEventCategory } from "./service";

type Prev = ActionResult | null;
const clubIdOf = (fd: FormData) => String(fd.get("clubId") ?? "");
const manage = (clubId: string) => () => requireClubPermission(clubId, "EVENT_MANAGE", { allowAdmin: false });
const refresh = () => revalidatePath("/panel/platform/kategoriler");

export async function createEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategorySchema,
    errors,
    run: async (user, data, t) => {
      await createEventCategory(user, data);
      refresh();
      return { ok: true, message: t("platform.categories.created") };
    },
  });
}

export async function updateEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategoryUpdateSchema,
    errors,
    run: async (user, data) => {
      await updateEventCategory(user, data);
      refresh();
    },
  });
}

export async function deleteEventCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: eventCategoryIdSchema,
    errors,
    run: async (user, data) => {
      await deleteEventCategory(user, data.id);
      refresh();
    },
  });
}

// ---------------------------------------------------------------- Etkinlik taslağı (EVENT_MANAGE)

const refreshClub = () => revalidatePath("/panel/kulup", "layout");

export async function createEventAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  let target: string | null = null;
  const result = await runAction(formData, {
    authorize: manage(clubId),
    schema: eventCreateSchema,
    errors,
    run: async (user, data) => {
      await enforceRateLimits([{ key: `event:create:${user.id}`, limit: 30, windowSec: 3600 }]);
      const { id } = await createEventDraft(user, clubId, data);
      refreshClub();
      target = id;
    },
  });
  if (target) redirect(`${String(formData.get("returnTo") ?? "")}/${target}`);
  return result;
}

/** Otomatik kayıt (debounce 2 sn) ve "Kaydet". */
export async function saveEventDraftAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manage(clubId),
    schema: eventSaveSchema,
    errors,
    run: async (_user, data, t) => {
      await saveEventDraft(clubId, data.eventId, data.data);
      return { ok: true, message: t("event.editor.saved") };
    },
  });
}

export async function deleteEventDraftAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  let back: string | null = null;
  const result = await runAction(formData, {
    authorize: manage(clubId),
    schema: z.object({ eventId: z.string().min(1).max(40), returnTo: z.string().max(200) }),
    errors,
    run: async (user, data) => {
      await deleteEventDraft(user, clubId, data.eventId);
      refreshClub();
      back = data.returnTo;
    },
  });
  if (back) redirect(back);
  return result;
}

/** Görsel yükle → { key, url }. İçerik taslağa/talebe sihirbaz durumu ile bağlanır. */
export async function uploadEventImageAction(_prev: ActionResult<{ key: string; url: string }> | null, formData: FormData): Promise<ActionResult<{ key: string; url: string }>> {
  const clubId = clubIdOf(formData);
  let out: { key: string; url: string } | null = null;
  const result = await runAction(formData, {
    authorize: manage(clubId),
    schema: eventImageSchema,
    errors,
    run: async (user, data, _t, fd) => {
      await enforceRateLimits([{ key: `event:upload:${user.id}`, limit: 120, windowSec: 3600 }]);
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) throw fail("FILE_INVALID");
      const key = await storeEventImage(clubId, data.eventId, data.kind, Buffer.from(await file.arrayBuffer()));
      out = { key, url: publicFileUrl(key) ?? "" };
    },
  });
  return result.ok && out ? { ok: true, data: out } : (result as ActionResult<{ key: string; url: string }>);
}

// ---------------------------------------------------------------- Duyurular (ANNOUNCEMENT_POST)

export async function createAnnouncementAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: () => requireClubPermission(clubId, "ANNOUNCEMENT_POST", { allowAdmin: false }),
    schema: announcementSchema,
    errors,
    run: async (user, data, t) => {
      await enforceRateLimits([{ key: `announcement:create:${user.id}`, limit: 30, windowSec: 3600 }]);
      await createAnnouncement(user, clubId, data);
      revalidatePath("/", "layout");
      return { ok: true, message: t("event.announcements.created") };
    },
  });
}

export async function deleteAnnouncementAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: () => requireClubPermission(clubId, "ANNOUNCEMENT_POST", { allowAdmin: false }),
    schema: z.object({ id: z.string().min(1).max(40) }),
    errors,
    run: async (user, data, t) => {
      await deleteAnnouncement(user, clubId, data.id);
      revalidatePath("/", "layout");
      return { ok: true, message: t("event.announcements.deleted") };
    },
  });
}
