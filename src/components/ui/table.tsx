"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "./cn";
import { sortRows, type SortDirection, type SortValue } from "./table-sort";

export type TableColumn = { key: string; header: string; sortable?: boolean; align?: "start" | "end"; hideBelow?: "sm" | "md" | "lg" };
export type TableRow = { id: string; cells: Record<string, ReactNode>; sort?: Record<string, SortValue> };

const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/**
 * Veri tablosu: sütun başlığıyla sıralama (`aria-sort`), isteğe bağlı satır seçimi,
 * yapışkan başlık, dar ekranda yatay kaydırma + önemsiz sütunları gizleme.
 * Hücreler sunucuda render edilmiş ReactNode olabilir.
 */
export function Table({
  caption,
  columns,
  rows,
  selectable,
  selectAllLabel,
  selectRowLabel,
  onSelectionChange,
  empty,
}: {
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
  selectable?: boolean;
  selectAllLabel?: string;
  selectRowLabel?: string;
  onSelectionChange?: (ids: string[]) => void;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string | null; dir: SortDirection }>({ key: null, dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  const updateSelection = (next: Set<string>) => {
    setSelected(next);
    onSelectionChange?.([...next]);
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const checkboxClass = "size-(--icon-size-sm) cursor-pointer accent-(--color-primary)";
  const cellPad = "px-(--space-3) py-(--space-2)";

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full border-collapse text-(length:--type-body-sm)">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-(--z-raised) bg-canvas-subtle">
          <tr>
            {selectable ? (
              <th scope="col" className={cn(cellPad, "w-(--touch-target-min)")}>
                <input
                  type="checkbox"
                  aria-label={selectAllLabel}
                  checked={allSelected}
                  onChange={() => updateSelection(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className={checkboxClass}
                />
              </th>
            ) : null}
            {columns.map((c) => {
              const activeSort = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={activeSort ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(cellPad, "font-semibold text-fg-secondary whitespace-nowrap", c.align === "end" ? "text-right" : "text-left", c.hideBelow && hide[c.hideBelow])}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-(--space-1) rounded-control hover:text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-(--color-focus)"
                    >
                      {c.header}
                      {activeSort ? (
                        sort.dir === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-(--icon-size-sm)" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-(--icon-size-sm)" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden="true" className="size-(--icon-size-sm) opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-(--space-6)">
                {empty}
              </td>
            </tr>
          ) : null}
          {sorted.map((row) => (
            <tr key={row.id} aria-selected={selectable ? selected.has(row.id) : undefined} className="border-t border-line hover:bg-canvas-subtle aria-selected:bg-brand-subtle">
              {selectable ? (
                <td className={cellPad}>
                  <input
                    type="checkbox"
                    aria-label={selectRowLabel}
                    checked={selected.has(row.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      updateSelection(next);
                    }}
                    className={checkboxClass}
                  />
                </td>
              ) : null}
              {columns.map((c) => (
                <td key={c.key} className={cn(cellPad, "text-fg", c.align === "end" && "text-right tabular-nums", c.hideBelow && hide[c.hideBelow])}>
                  {row.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
