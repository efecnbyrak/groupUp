import { z } from "zod";

import { birthDateField, classYearField, genderField, graduationYearField, nameField, phoneField, studentNoField } from "@/lib/person-fields";

/**
 * Profil düzenleme. Fakülte, seçilen bölümden sunucuda türetilir (tek seçim: fakülte → bölüm grupları).
 * Sınıf/mezuniyet yılı zorunluluğu kullanıcı tipine göre serviste kontrol edilir.
 */
export const profileUpdateSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  studentNo: studentNoField,
  departmentId: z.string({ error: "validation.required" }).trim().min(1, { error: "validation.required" }).max(40),
  classYear: classYearField,
  graduationYear: graduationYearField,
  phone: phoneField,
  gender: genderField,
  birthDate: birthDateField,
  bio: z
    .string()
    .trim()
    .max(300, { error: "validation.tooLong" })
    .transform((v) => v || undefined)
    .optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
