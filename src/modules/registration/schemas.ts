import { z } from "zod";

import { FILE_ACCEPT, FORM_FIELD_TYPES, HELP_MAX, LABEL_MAX, OPTION_LABEL_MAX, OPTION_MAX, TEAM_NAME_MAX } from "./rules";

const id = z.string().trim().min(1).max(40);
const text = (max: number) => z.string().trim().min(1, { error: "validation.required" }).max(max, { error: "validation.tooLong" });
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "validation.tooLong" })
    .nullish()
    .transform((v) => v || null);
const bool = () =>
  z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true");
const optInt = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "validation.number" });
      return z.NEVER;
    }
    return n;
  });

/** "değer|TR etiketi|EN etiketi" satırları (form oluşturucu basit metin girişi). */
function parseOptionsText(raw: string | undefined): { value: string; labelTr: string; labelEn: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, OPTION_MAX)
    .map((line, i) => {
      const [labelTr, labelEn] = line.split("|").map((s) => s.trim());
      const value = `o${i + 1}`;
      return { value, labelTr: (labelTr || line).slice(0, OPTION_LABEL_MAX), labelEn: (labelEn || labelTr || line).slice(0, OPTION_LABEL_MAX) };
    });
}

/** Form alanı oluştur/düzenle — editördeki tek (düz) form, tipe göre hangi alanların kullanılacağı sunucuda belirlenir. */
export const formFieldSchema = z.object({
  eventId: id,
  type: z.enum(FORM_FIELD_TYPES, { error: "validation.required" }),
  labelTr: text(LABEL_MAX),
  helpTr: optText(HELP_MAX),
  required: bool(),
  teamLevel: bool(),
  optionsText: z
    .string()
    .max(4000)
    .optional()
    .transform((v) => parseOptionsText(v)),
  maxLength: optInt,
  min: optInt,
  max: optInt,
  integer: bool(),
  minSelect: optInt,
  maxSelect: optInt,
  maxMb: optInt,
  acceptPdf: bool(),
  acceptImage: bool(),
  showIfFieldId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  showIfValue: optText(200),
});
export type FormFieldInput = z.infer<typeof formFieldSchema>;

export const formFieldUpdateSchema = formFieldSchema.extend({ id });
export const formFieldIdSchema = z.object({ eventId: id, id });
export const formFieldReorderSchema = z.object({ eventId: id, id, direction: z.enum(["up", "down"]) });
export const applyTemplateSchema = z.object({ eventId: id, templateKey: z.string().max(60) });

/** Form: JSON gövdeli cevap bloğu (dinamik alanlar). */
const answersField = z
  .string()
  .max(200_000)
  .transform((v, ctx) => {
    try {
      const parsed: unknown = JSON.parse(v || "{}");
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: "custom", message: "validation.invalid" });
      return z.NEVER;
    }
  });

export const applySchema = z.object({ eventId: id, answers: answersField });
export const registrationIdSchema = z.object({ eventId: id, registrationId: id });
export const decideSchema = z.object({ eventId: id, registrationId: id, decision: z.enum(["ACCEPT", "REJECT"]) });
export const decideManySchema = z.object({
  eventId: id,
  ids: z
    .string()
    .max(10_000)
    .transform((v, ctx) => {
      try {
        const arr: unknown = JSON.parse(v);
        if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) throw new Error();
        return arr as string[];
      } catch {
        ctx.addIssue({ code: "custom", message: "validation.invalid" });
        return z.NEVER;
      }
    }),
  decision: z.enum(["ACCEPT", "REJECT"]),
});

export const teamDecideSchema = z.object({ eventId: id, teamId: id, decision: z.enum(["ACCEPT", "REJECT"]) });
export const teamDecideManySchema = z.object({
  eventId: id,
  ids: z
    .string()
    .max(10_000)
    .transform((v, ctx) => {
      try {
        const arr: unknown = JSON.parse(v);
        if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) throw new Error();
        return arr as string[];
      } catch {
        ctx.addIssue({ code: "custom", message: "validation.invalid" });
        return z.NEVER;
      }
    }),
  decision: z.enum(["ACCEPT", "REJECT"]),
});

export const teamCreateSchema = z.object({ eventId: id, name: text(TEAM_NAME_MAX), teamAnswers: answersField, memberAnswers: answersField });
export const teamJoinSchema = z.object({ eventId: id, code: text(12), memberAnswers: answersField });
export const teamIdSchema = z.object({ eventId: id, teamId: id });
export const teamMemberRemoveSchema = z.object({ eventId: id, teamId: id, userId: id });
export const teamTransferSchema = z.object({ eventId: id, teamId: id, userId: id });

export const uploadRegistrationFileSchema = z.object({ eventId: id, fieldId: id });

export { FILE_ACCEPT };
