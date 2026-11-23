"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/i18n/action-result";
import { requireSuperAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { UNIVERSITY_ERROR_KEYS as errors } from "./errors";
import {
  addDomain,
  assignAdmin,
  createUniversity,
  rejectUniversityRequest,
  removeAdmin,
  removeDomain,
  setUniversityActive,
  updateUniversity,
} from "./platform-service";
import { assignAdminSchema, domainSchema, idSchema, universityActiveSchema, universitySchema, universityUpdateSchema } from "./schemas";

/** Platform paneli action'ları: `requireSuperAdmin()` → zod → servis → revalidate. */
const PANEL = "/panel/platform";
const authorize = requireSuperAdmin;
const refresh = () => revalidatePath(PANEL, "layout");
type Prev = ActionResult | null;

export async function createUniversityAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: universitySchema,
    errors,
    run: async (user, data) => {
      const { id } = await createUniversity(user, data);
      refresh();
      redirect(`${PANEL}/universiteler/${id}`);
    },
  });
}

export async function updateUniversityAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: universityUpdateSchema,
    errors,
    run: async (user, data, t) => {
      await updateUniversity(user, data);
      refresh();
      return { ok: true, message: t("platform.saved") };
    },
  });
}

export async function setUniversityActiveAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: universityActiveSchema,
    errors,
    run: async (user, data) => {
      await setUniversityActive(user, data.universityId, data.active);
      refresh();
    },
  });
}

export async function addDomainAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: domainSchema,
    errors,
    run: async (user, data, t) => {
      await addDomain(user, data);
      refresh();
      return { ok: true, message: t("platform.domains.added") };
    },
  });
}

export async function removeDomainAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: idSchema,
    errors,
    run: async (user, data) => {
      await removeDomain(user, data.id);
      refresh();
    },
  });
}

export async function assignAdminAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: assignAdminSchema,
    errors,
    run: async (user, data, t) => {
      await assignAdmin(user, data.universityId, data.email);
      refresh();
      return { ok: true, message: t("platform.admins.assigned") };
    },
  });
}

export async function removeAdminAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: idSchema,
    errors,
    run: async (user, data) => {
      await removeAdmin(user, data.id);
      refresh();
    },
  });
}

export async function rejectUniversityRequestAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize,
    schema: idSchema,
    errors,
    run: async (user, data) => {
      await rejectUniversityRequest(user, data.id);
      refresh();
    },
  });
}
