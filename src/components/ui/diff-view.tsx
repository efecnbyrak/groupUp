import type { ReactNode } from "react";

/**
 * Onay ekranı fark görünümü (DESIGN §6, APPROVALS-TICKETS §6): yalnızca değişen alanlar,
 * eski ↔ yeni. Geniş ekranda iki sütun, mobilde alt alta. Değerler çağırandan biçimlenmiş gelir.
 */
export type DiffViewRow = { key: string; label: string; before: ReactNode; after: ReactNode };

export function DiffView({ rows, labels, empty }: { rows: DiffViewRow[]; labels: { before: string; after: string }; empty: string }) {
  if (rows.length === 0) return <p className="text-(length:--type-body-sm) text-fg-secondary">{empty}</p>;
  return (
    <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-card">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-(--space-2) p-(--space-4)">
          <dt className="text-(length:--type-body-sm) font-semibold text-fg">{row.label}</dt>
          <dd className="grid gap-(--space-2) md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-(--space-1) rounded-control border border-line bg-(--color-danger-subtle) p-(--space-3)">
              <span className="text-(length:--type-caption) font-semibold text-negative">{labels.before}</span>
              <div className="text-(length:--type-body-sm) break-words whitespace-pre-line text-fg">{row.before}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-(--space-1) rounded-control border border-line bg-(--color-success-subtle) p-(--space-3)">
              <span className="text-(length:--type-caption) font-semibold text-positive">{labels.after}</span>
              <div className="text-(length:--type-body-sm) break-words whitespace-pre-line text-fg">{row.after}</div>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
