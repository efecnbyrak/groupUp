"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/i18n/action-result";
import { requireClubMember, requireClubPermission, requireSuperAdmin, requireUniversityAdmin, requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { assignPresident, createClub, storeClubImage, updateClubDirect } from "./clubs";
import { CLUB_ERROR_KEYS as errors } from "./errors";
import { adminRemoveMember, adminRemoveStaff, createInvite, joinWithInvite, leaveClub, revokeInvite } from "./membership";
import {
  adminClubInfoSchema,
  adminMemberSchema,
  assignPresidentSchema,
  categoryIdSchema,
  clubCategorySchema,
  clubCategoryUpdateSchema,
  clubIdSchema,
  createClubSchema,
  inviteCreateSchema,
  inviteIdSchema,
  joinSchema,
} from "./schemas";
import { createClubCategory, deleteClubCategory, updateClubCategory } from "./service";

type Prev = ActionResult | null;
const refresh = () => revalidatePath("/panel/platform/kategoriler");
/** Kulüp verisi header (Kulüplerim), Keşfet, paneller ve public sayfada görünür → layout geneli yenilenir. */
const refreshAll = () => revalidatePath("/", "layout");

export async function createClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: clubCategorySchema,
    errors,
    run: async (user, data, t) => {
      await createClubCategory(user, data);
      refresh();
      return { ok: true, message: t("platform.categories.created") };
    },
  });
}

export async function updateClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: clubCategoryUpdateSchema,
    errors,
    run: async (user, data) => {
      await updateClubCategory(user, data.id, data);
      refresh();
    },
  });
}

export async function deleteClubCategoryAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireSuperAdmin,
    schema: categoryIdSchema,
    errors,
    run: async (user, data) => {
      await deleteClubCategory(user, data.id);
      refresh();
    },
  });
}

// ---------------------------------------------------------------- Admin (F5)

export async function createClubAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: createClubSchema,
    errors,
    run: async (user, data, t) => {
      if (data.universityId !== universityId) throw new Error("universityId uyuşmuyor");
      await createClub(user, data);
      refreshAll();
      return { ok: true, message: t("club.admin.created") };
    },
  });
}

export async function assignPresidentAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: assignPresidentSchema,
    errors,
    run: async (user, data, t) => {
      await assignPresident(user, universityId, data.clubId, data.email);
      refreshAll();
      return { ok: true, message: t("club.admin.presidentAssigned") };
    },
  });
}

/** Admin: kulüp bilgilerini doğrudan güncelle (görseller opsiyonel dosya alanı). */
export async function updateClubDirectAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: adminClubInfoSchema,
    errors,
    run: async (user, data, t, fd) => {
      const images: { logoKey?: string; coverKey?: string } = {};
      for (const kind of ["logo", "cover"] as const) {
        const file = fd.get(kind);
        if (file instanceof File && file.size > 0) images[`${kind}Key`] = await storeClubImage(data.clubId, kind, Buffer.from(await file.arrayBuffer()));
      }
      const { universityId: _u, clubId, ...info } = data;
      await updateClubDirect(user, universityId, clubId, { ...info, ...images });
      refreshAll();
      return { ok: true, message: t("club.admin.updated") };
    },
  });
}

export async function adminRemoveMemberAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: adminMemberSchema,
    errors,
    run: async (user, data, t) => {
      await adminRemoveMember(user, universityId, data.clubId, data.userId);
      refreshAll();
      return { ok: true, message: t("club.members.removed") };
    },
  });
}

export async function adminRemoveStaffAction(_prev: Prev, formData: FormData) {
  const universityId = String(formData.get("universityId") ?? "");
  return runAction(formData, {
    authorize: () => requireUniversityAdmin(universityId),
    schema: adminMemberSchema,
    errors,
    run: async (user, data, t) => {
      await adminRemoveStaff(user, universityId, data.clubId, data.userId);
      refreshAll();
      return { ok: true, message: t("club.staff.removed") };
    },
  });
}

// ---------------------------------------------------------------- Davet kodları (Başkan / MEMBER_INVITE)

export async function createInviteAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubPermission(clubId, "MEMBER_INVITE", { allowAdmin: false }),
    schema: inviteCreateSchema,
    errors,
    run: async (user, data, t) => {
      await createInvite(user, clubId, data);
      refreshAll();
      return { ok: true, message: t("club.invites.created") };
    },
  });
}

export async function revokeInviteAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubPermission(clubId, "MEMBER_INVITE", { allowAdmin: false }),
    schema: inviteIdSchema,
    errors,
    run: async (user, data, t) => {
      await revokeInvite(user, clubId, data.inviteId);
      refreshAll();
      return { ok: true, message: t("club.invites.revoked") };
    },
  });
}

// ---------------------------------------------------------------- Üyelik (öğrenci)

/** /katil/[kod] — katılım POST ile (GET yalnızca önizler). Başarıda kulüp sayfasına gider. */
export async function joinClubAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: joinSchema,
    errors,
    run: async (user, data) => {
      const { slug } = await joinWithInvite(user, data.code, formData.get("via") === "link" ? "link" : "code");
      refreshAll();
      redirect(`/kulupler/${slug}?katildi=1`);
    },
  });
}

export async function leaveClubAction(_prev: Prev, formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  return runAction(formData, {
    authorize: () => requireClubMember(clubId),
    schema: clubIdSchema,
    errors,
    run: async (user, _data, t) => {
      await leaveClub(user, clubId);
      refreshAll();
      return { ok: true, message: t("club.leave.done") };
    },
  });
}
