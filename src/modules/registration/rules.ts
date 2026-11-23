/**
 * Başvuru formu, kontenjan ve takım kuralları (EVENTS-FORMS-I18N §4–6) — saf TS, unit test edilir.
 */

export const LABEL_MAX = 120;
export const HELP_MAX = 300;
export const OPTION_MAX = 20;
export const OPTION_LABEL_MAX = 80;
export const SHORT_TEXT_MAX = 500;
export const LONG_TEXT_MAX = 5000;
export const TEAM_NAME_MAX = 50;
export const FILE_ACCEPT = ["pdf", "jpg", "png", "webp"] as const;
export type FileExt = (typeof FILE_ACCEPT)[number];

export const FORM_FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "DROPDOWN",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "FILE",
  "CONSENT",
  "SECTION",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Bu tipler seçenek listesi ister. */
export const CHOICE_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN"] as const;
/** Bu tipler cevap gerektirmez (yalnızca görsel/bilgi). */
export const ANSWERLESS_TYPES = ["SECTION"] as const;

export interface FieldOption {
  value: string;
  labelTr: string;
  labelEn: string;
}

export interface FieldConfig {
  maxLength?: number;
  pattern?: "email" | "phone" | "url";
  min?: number;
  max?: number;
  integer?: boolean;
  accept?: FileExt[];
  maxMb?: number;
  minSelect?: number;
  maxSelect?: number;
}

export interface FieldDef {
  id: string;
  type: FormFieldType;
  order: number;
  labelTr: string;
  required: boolean;
  teamLevel: boolean;
  hidden: boolean;
  options: FieldOption[] | null;
  config: FieldConfig | null;
  showIfFieldId: string | null;
  showIfValue: unknown;
}

const PATTERNS: Record<NonNullable<FieldConfig["pattern"]>, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[0-9 ()-]{7,20}$/,
  url: /^https?:\/\/.+/i,
};

/** Koşullu görünürlük: referans alan değeri `showIfValue`'ya eşitse gösterilir. Döngü/eksik referans → görünür kabul edilir (veri kaybı olmasın). */
export function isFieldVisible(field: FieldDef, answers: Record<string, unknown>): boolean {
  if (!field.showIfFieldId) return true;
  const ref = answers[field.showIfFieldId];
  return JSON.stringify(ref) === JSON.stringify(field.showIfValue);
}

export interface ValidationResult {
  errors: Record<string, string>;
  clean: Record<string, unknown>;
}

/**
 * Dinamik alan cevaplarını doğrular (`EventFormField[]` tanımına göre). `scope` yalnızca
 * `teamLevel` alanlarını (takım kurarken) veya yalnızca bireysel alanları (katılırken/üye
 * eklerken) seçer; `"all"` her ikisini birden ister (form oluşturucu önizlemesi).
 */
export function validateAnswers(
  fields: FieldDef[],
  rawAnswers: Record<string, unknown>,
  scope: "team" | "individual" | "all" = "all",
  fileKeyPrefix?: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  const clean: Record<string, unknown> = {};
  const visible = fields.filter((f) => !f.hidden && !(ANSWERLESS_TYPES as readonly string[]).includes(f.type));
  const scoped = scope === "all" ? visible : visible.filter((f) => (scope === "team" ? f.teamLevel : !f.teamLevel));

  for (const field of scoped) {
    if (!isFieldVisible(field, rawAnswers)) continue;
    const raw = rawAnswers[field.id];
    const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (field.required) errors[field.id] = "validation.required";
      continue;
    }
    const cfg = field.config ?? {};
    switch (field.type) {
      case "SHORT_TEXT":
      case "LONG_TEXT": {
        if (typeof raw !== "string") {
          errors[field.id] = "validation.invalid";
          break;
        }
        const max = cfg.maxLength ?? (field.type === "SHORT_TEXT" ? SHORT_TEXT_MAX : LONG_TEXT_MAX);
        if (raw.length > max) errors[field.id] = "validation.tooLong";
        else if (cfg.pattern && !PATTERNS[cfg.pattern].test(raw)) errors[field.id] = `validation.${cfg.pattern}`;
        else clean[field.id] = raw;
        break;
      }
      case "NUMBER": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isNaN(n)) errors[field.id] = "validation.number";
        else if (cfg.integer && !Number.isInteger(n)) errors[field.id] = "validation.number";
        else if (cfg.min !== undefined && n < cfg.min) errors[field.id] = "validation.number";
        else if (cfg.max !== undefined && n > cfg.max) errors[field.id] = "validation.number";
        else clean[field.id] = n;
        break;
      }
      case "DATE": {
        const d = raw instanceof Date ? raw : new Date(String(raw));
        if (Number.isNaN(d.getTime())) errors[field.id] = "validation.date";
        else clean[field.id] = d.toISOString().slice(0, 10);
        break;
      }
      case "BOOLEAN":
      case "CONSENT": {
        if (typeof raw !== "boolean") errors[field.id] = "validation.invalid";
        else if (field.type === "CONSENT" && field.required && !raw) errors[field.id] = "validation.required";
        else clean[field.id] = raw;
        break;
      }
      case "SINGLE_CHOICE":
      case "DROPDOWN": {
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (typeof raw !== "string" || !allowed.has(raw)) errors[field.id] = "validation.invalid";
        else clean[field.id] = raw;
        break;
      }
      case "MULTI_CHOICE": {
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string" && allowed.has(v))) {
          errors[field.id] = "validation.invalid";
          break;
        }
        const values = [...new Set(raw as string[])];
        if (cfg.minSelect !== undefined && values.length < cfg.minSelect) errors[field.id] = "validation.invalid";
        else if (cfg.maxSelect !== undefined && values.length > cfg.maxSelect) errors[field.id] = "validation.invalid";
        else clean[field.id] = values;
        break;
      }
      case "FILE": {
        const prefix = fileKeyPrefix ?? "registrations/";
        if (typeof raw !== "string" || !raw.startsWith(prefix)) errors[field.id] = "validation.invalid";
        else clean[field.id] = raw;
        break;
      }
      case "SECTION":
        break;
    }
  }
  return { errors, clean };
}

// ---------------------------------------------------------------- Kontenjan / yedek liste

export type CapacityDecision = { status: "ACCEPTED" | "APPLIED" | "WAITLISTED" } | { status: "BLOCKED" };

/** Başvuru/takım kontenjan kararı (§5 adım 3, §6 adım 4). `taken`: ACCEPTED + APPLIED sayısı. */
export function decideCapacity(input: { capacity: number | null; waitlistEnabled: boolean; autoAccept: boolean; taken: number }): CapacityDecision {
  const hasRoom = input.capacity === null || input.taken < input.capacity;
  if (hasRoom) return { status: input.autoAccept ? "ACCEPTED" : "APPLIED" };
  return input.waitlistEnabled ? { status: "WAITLISTED" } : { status: "BLOCKED" };
}

/** Takım boyutu şartları (§6). */
export function teamSizeProblem(memberCount: number, min: number, max: number): "TEAM_TOO_SMALL" | "TEAM_FULL" | null {
  if (memberCount >= max) return "TEAM_FULL";
  if (memberCount < min) return "TEAM_TOO_SMALL";
  return null;
}

export function canCompleteTeam(memberCount: number, min: number): boolean {
  return memberCount >= min;
}

// ---------------------------------------------------------------- Dışa aktarım (xlsx/csv)

export interface ExportColumn {
  key: string;
  header: string;
}

export interface ExportRowSource {
  snapshot: Record<string, unknown>;
  answers: Record<string, unknown>;
  teamName: string | null;
  status: string;
  createdAt: Date;
}

/** Profil + form alanları + takım + durum sütunları (§5 adım 5). Saf: sunucu xlsx/csv'ye çevirir. */
export function buildExportColumns(fields: FieldDef[], snapshotKeys: { key: string; header: string }[], locale: string): ExportColumn[] {
  return [
    ...snapshotKeys,
    { key: "team", header: locale === "en" ? "Team" : "Takım" },
    ...fields
      .filter((f) => !(ANSWERLESS_TYPES as readonly string[]).includes(f.type))
      .sort((a, b) => a.order - b.order)
      .map((f) => ({ key: f.id, header: f.labelTr })),
    { key: "status", header: locale === "en" ? "Status" : "Durum" },
    { key: "createdAt", header: locale === "en" ? "Applied at" : "Başvuru tarihi" },
  ];
}

function cellValue(field: FieldDef | undefined, raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (!field) return String(raw);
  if (field.type === "MULTI_CHOICE" && Array.isArray(raw)) {
    const byValue = new Map((field.options ?? []).map((o) => [o.value, o.labelTr]));
    return raw.map((v) => byValue.get(String(v)) ?? String(v)).join(", ");
  }
  if ((field.type === "SINGLE_CHOICE" || field.type === "DROPDOWN") && typeof raw === "string") {
    return field.options?.find((o) => o.value === raw)?.labelTr ?? raw;
  }
  if (field.type === "BOOLEAN" || field.type === "CONSENT") return raw ? "Evet" : "Hayır";
  return String(raw);
}

export function buildExportRow(fields: FieldDef[], columns: ExportColumn[], row: ExportRowSource, statusLabel: string): Record<string, string> {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const out: Record<string, string> = {};
  for (const col of columns) {
    if (col.key === "team") out[col.key] = row.teamName ?? "";
    else if (col.key === "status") out[col.key] = statusLabel;
    else if (col.key === "createdAt") out[col.key] = row.createdAt.toISOString().slice(0, 10);
    else if (col.key in row.snapshot) out[col.key] = String(row.snapshot[col.key] ?? "");
    else out[col.key] = cellValue(byId.get(col.key), row.answers[col.key]);
  }
  return out;
}
