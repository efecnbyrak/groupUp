/** Onay ekranı fark görünümü: yalnızca değişen alanlar (APPROVALS-TICKETS §4). Saf TS. */
export type DiffValue = string | number | boolean | null | readonly string[];

export interface DiffRow {
  field: string;
  before: DiffValue;
  after: DiffValue;
}

const norm = (v: unknown): DiffValue => {
  if (v === undefined || v === null || v === "") return null;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return JSON.stringify(v);
};

const same = (a: DiffValue, b: DiffValue) => JSON.stringify(a) === JSON.stringify(b);

/** `keys` verilirse o sırayla; yoksa iki nesnenin birleşik anahtarları. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, keys?: readonly string[]): DiffRow[] {
  const fields = keys ?? [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const rows: DiffRow[] = [];
  for (const field of fields) {
    if (!(field in after)) continue;
    const b = norm(before[field]);
    const a = norm(after[field]);
    if (!same(a, b)) rows.push({ field, before: b, after: a });
  }
  return rows;
}

/** Yalnızca değişen alanları içeren `after` (kuyrukta gereksiz talebi engellemek için). */
export function changedOnly<T extends Record<string, unknown>>(before: Record<string, unknown>, after: T): Partial<T> {
  const out: Partial<T> = {};
  for (const row of diffFields(before, after)) out[row.field as keyof T] = after[row.field] as T[keyof T];
  return out;
}
