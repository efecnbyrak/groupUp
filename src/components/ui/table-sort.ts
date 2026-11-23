export type SortDirection = "asc" | "desc";
export type SortValue = string | number | null | undefined;

/** Kararlı sıralama; boş değerler her iki yönde de sona gider, metinler Türkçe kurallarıyla. */
export function sortRows<T extends { sort?: Record<string, SortValue> }>(rows: readonly T[], key: string | null, dir: SortDirection): T[] {
  if (!key) return [...rows];
  const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row.sort?.[key];
      const y = b.row.sort?.[key];
      const xEmpty = x === null || x === undefined || x === "";
      const yEmpty = y === null || y === undefined || y === "";
      if (xEmpty || yEmpty) return xEmpty === yEmpty ? a.index - b.index : xEmpty ? 1 : -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
      return (dir === "asc" ? cmp : -cmp) || a.index - b.index;
    })
    .map(({ row }) => row);
}
