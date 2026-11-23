"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/i18n/action-result";
import { requireUniversityAdmin } from "@/lib/authz";
import type { ActionResult } from "@/lib/errors";

import { createDepartment, createFaculty, deleteDepartment, deleteFaculty, updateDepartment, updateFaculty } from "./admin-service";
import { UNIVERSITY_ERROR_KEYS as errors } from "./errors";
import { departmentSchema, departmentUpdateSchema, facultySchema, facultyUpdateSchema, idSchema } from "./schemas";

/**
 * Admin paneli action'ları. Form gizli `universityId` taşır; ilk iş onunla
 * `requireUniversityAdmin`, servis tüm sorguları bu üniversiteyle kapsamlar.
 */
type Prev = ActionResult | null;
const universityIdOf = (formData: FormData) => String(formData.get("universityId") ?? "");
const refresh = () => revalidatePath("/panel/admin", "layout");

function gate(formData: FormData) {
  const universityId = universityIdOf(formData);
  return async () => ({ user: await requireUniversityAdmin(universityId), universityId });
}

export async function createFacultyAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: facultySchema,
    errors,
    run: async ({ user, universityId }, data, t) => {
      await createFaculty(user, universityId, data);
      refresh();
      return { ok: true, message: t("admin.faculties.created") };
    },
  });
}

export async function updateFacultyAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: facultyUpdateSchema,
    errors,
    run: async ({ user, universityId }, data) => {
      await updateFaculty(user, universityId, data.id, data);
      refresh();
    },
  });
}

export async function deleteFacultyAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: idSchema,
    errors,
    run: async ({ user, universityId }, data) => {
      await deleteFaculty(user, universityId, data.id);
      refresh();
    },
  });
}

export async function createDepartmentAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: departmentSchema,
    errors,
    run: async ({ user, universityId }, data) => {
      await createDepartment(user, universityId, data.facultyId, data);
      refresh();
    },
  });
}

export async function updateDepartmentAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: departmentUpdateSchema,
    errors,
    run: async ({ user, universityId }, data) => {
      await updateDepartment(user, universityId, data.id, data);
      refresh();
    },
  });
}

export async function deleteDepartmentAction(_prev: Prev, formData: FormData) {
  return runAction(formData, {
    authorize: gate(formData),
    schema: idSchema,
    errors,
    run: async ({ user, universityId }, data) => {
      await deleteDepartment(user, universityId, data.id);
      refresh();
    },
  });
}
