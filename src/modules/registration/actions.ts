"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import { requireClubPermission, requireUser } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";
import { enforceRateLimits } from "@/lib/rate-limit";

import { applyToEvent, cancelRegistration, decideManyRegistrations, decideRegistration, updateMyAnswers } from "./registrations";
import { storeRegistrationFile } from "./files";
import { applyTemplate, createField, deleteField, reorderField, toggleFieldHidden, updateField } from "./fields";
import { REGISTRATION_ERROR_KEYS as errors } from "./errors";
import {
  applySchema,
  applyTemplateSchema,
  decideManySchema,
  decideSchema,
  formFieldIdSchema,
  formFieldReorderSchema,
  formFieldSchema,
  formFieldUpdateSchema,
  registrationIdSchema,
  teamCreateSchema,
  teamDecideManySchema,
  teamDecideSchema,
  teamIdSchema,
  teamJoinSchema,
  teamMemberRemoveSchema,
  teamTransferSchema,
  uploadRegistrationFileSchema,
} from "./schemas";
import { completeTeam, createTeam, decideManyTeams, decideTeam, disbandTeam, joinTeam, leaveTeam, removeTeamMember, transferCaptain } from "./teams";
import { fail } from "./service";

type Prev = ActionResult | null;
const clubIdOf = (fd: FormData) => String(fd.get("clubId") ?? "");
const manageForm = (clubId: string) => () => requireClubPermission(clubId, "EVENT_MANAGE", { allowAdmin: false });
const manageRegs = (clubId: string) => () => requireClubPermission(clubId, "REGISTRATION_MANAGE", { allowAdmin: false });
const refresh = (eventId: string) => revalidatePath(`/panel/kulup`, "layout") || revalidatePath(`/etkinlikler/${eventId}`);

// ---------------------------------------------------------------- Form oluşturucu (EVENT_MANAGE)

export async function createFormFieldAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: formFieldSchema,
    errors,
    run: async (user, data, t) => {
      await createField(user, clubId, data.eventId, data);
      refresh(data.eventId);
      return { ok: true, message: t("registration.builder.saved") };
    },
  });
}

export async function updateFormFieldAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: formFieldUpdateSchema,
    errors,
    run: async (user, data, t) => {
      await updateField(user, clubId, data.eventId, data.id, data);
      refresh(data.eventId);
      return { ok: true, message: t("registration.builder.saved") };
    },
  });
}

export async function deleteFormFieldAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: formFieldIdSchema,
    errors,
    run: async (user, data) => {
      await deleteField(user, clubId, data.eventId, data.id);
      refresh(data.eventId);
    },
  });
}

export async function reorderFormFieldAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: formFieldReorderSchema,
    errors,
    run: async (_user, data) => {
      await reorderField(clubId, data.eventId, data.id, data.direction);
      refresh(data.eventId);
    },
  });
}

export async function toggleFormFieldAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: formFieldIdSchema,
    errors,
    run: async (_user, data, _t, fd) => {
      const current = fd.get("hidden") === "true";
      await toggleFieldHidden(clubId, data.eventId, data.id, !current);
      refresh(data.eventId);
    },
  });
}

export async function applyFormTemplateAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageForm(clubId),
    schema: applyTemplateSchema,
    errors,
    run: async (user, data, t) => {
      const n = await applyTemplate(user, clubId, data.eventId, data.templateKey);
      refresh(data.eventId);
      return { ok: true, message: t("registration.builder.templateApplied", { count: n }) };
    },
  });
}

/** Form alanı dosya seçeneği önizlemesi için görsel yükleme kullanılmıyor — burada yalnızca başvuru dosyası yüklenir. */
export async function uploadRegistrationFileAction(_prev: ActionResult<{ key: string }> | null, formData: FormData): Promise<ActionResult<{ key: string }>> {
  let out: { key: string } | null = null;
  const result = await runAction(formData, {
    authorize: requireUser,
    schema: uploadRegistrationFileSchema,
    errors,
    run: async (user, data, _t, fd) => {
      await enforceRateLimits([{ key: `registration:upload:${user.id}`, limit: 60, windowSec: 3600 }]);
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) throw fail("FILE_INVALID");
      const maxMb = Number(fd.get("maxMb") ?? 10) || 10;
      const accept = String(fd.get("accept") ?? "pdf,jpg,png,webp").split(",");
      const key = await storeRegistrationFile(data.eventId, user.id, Buffer.from(await file.arrayBuffer()), accept, maxMb);
      out = { key };
    },
  });
  return result.ok && out ? { ok: true, data: out } : (result as ActionResult<{ key: string }>);
}

// ---------------------------------------------------------------- Bireysel başvuru

export async function applyToEventAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: applySchema,
    errors,
    run: async (user, data, t) => {
      await enforceRateLimits([{ key: `registration:apply:${user.id}`, limit: 30, windowSec: 3600 }]);
      await applyToEvent(user, data.eventId, data.answers);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.apply.success") };
    },
  });
}

export async function updateMyAnswersAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: applySchema,
    errors,
    run: async (user, data, t) => {
      await updateMyAnswers(user, data.eventId, data.answers);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      return { ok: true, message: t("registration.apply.updated") };
    },
  });
}

export async function cancelRegistrationAction(_prev: Prev, formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  return runAction(formData, {
    authorize: requireUser,
    schema: registrationIdSchema,
    errors,
    run: async (user, _data, t) => {
      await cancelRegistration(user, eventId);
      revalidatePath(`/etkinlikler/${eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.apply.cancelled") };
    },
  });
}

// ---------------------------------------------------------------- Yönetim (REGISTRATION_MANAGE)

export async function decideRegistrationAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageRegs(clubId),
    schema: decideSchema,
    errors,
    run: async (user, data, t) => {
      await decideRegistration(user, clubId, data.eventId, data.registrationId, data.decision);
      refresh(data.eventId);
      return { ok: true, message: t("registration.manage.decided") };
    },
  });
}

export async function decideManyRegistrationsAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageRegs(clubId),
    schema: decideManySchema,
    errors,
    run: async (user, data, t) => {
      const n = await decideManyRegistrations(user, clubId, data.eventId, data.ids, data.decision);
      refresh(data.eventId);
      return { ok: true, message: t("registration.manage.decidedMany", { count: n }) };
    },
  });
}

// ---------------------------------------------------------------- Takım

export async function createTeamAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamCreateSchema,
    errors,
    run: async (user, data, t) => {
      await enforceRateLimits([{ key: `registration:team:${user.id}`, limit: 20, windowSec: 3600 }]);
      await createTeam(user, data.eventId, data.name, data.teamAnswers, data.memberAnswers);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.team.created") };
    },
  });
}

export async function joinTeamAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamJoinSchema,
    errors,
    run: async (user, data, t) => {
      await enforceRateLimits([{ key: `registration:team-join:${user.id}`, limit: 20, windowSec: 3600 }]);
      await joinTeam(user, data.eventId, data.code, data.memberAnswers);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.team.joined") };
    },
  });
}

export async function leaveTeamAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamIdSchema,
    errors,
    run: async (user, data, t) => {
      await leaveTeam(user, data.eventId, data.teamId);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      return { ok: true, message: t("registration.team.left") };
    },
  });
}

export async function removeTeamMemberAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamMemberRemoveSchema,
    errors,
    run: async (user, data, t) => {
      await removeTeamMember(user, data.eventId, data.teamId, data.userId);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      return { ok: true, message: t("registration.team.memberRemoved") };
    },
  });
}

export async function transferCaptainAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamTransferSchema,
    errors,
    run: async (user, data, t) => {
      await transferCaptain(user, data.eventId, data.teamId, data.userId);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      return { ok: true, message: t("registration.team.captainTransferred") };
    },
  });
}

export async function disbandTeamAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamIdSchema,
    errors,
    run: async (user, data, t) => {
      await disbandTeam(user, data.eventId, data.teamId);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.team.disbanded") };
    },
  });
}

export async function completeTeamAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: requireUser,
    schema: teamIdSchema,
    errors,
    run: async (user, data, t) => {
      await completeTeam(user, data.eventId, data.teamId);
      revalidatePath(`/etkinlikler/${data.eventId}`);
      revalidatePath("/etkinliklerim");
      return { ok: true, message: t("registration.team.completed") };
    },
  });
}

export async function decideTeamAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageRegs(clubId),
    schema: teamDecideSchema,
    errors,
    run: async (user, data, t) => {
      await decideTeam(user, clubId, data.eventId, data.teamId, data.decision);
      refresh(data.eventId);
      return { ok: true, message: t("registration.manage.decided") };
    },
  });
}

export async function decideManyTeamsAction(_prev: Prev, formData: FormData) {
  const clubId = clubIdOf(formData);
  return runAction(formData, {
    authorize: manageRegs(clubId),
    schema: teamDecideManySchema,
    errors,
    run: async (user, data, t) => {
      const n = await decideManyTeams(user, clubId, data.eventId, data.ids, data.decision);
      refresh(data.eventId);
      return { ok: true, message: t("registration.manage.decidedMany", { count: n }) };
    },
  });
}
