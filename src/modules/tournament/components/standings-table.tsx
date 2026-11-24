import { Table } from "@/components/ui";

import type { StandingRow } from "../domain/standings";

export interface StandingsTableLabels {
  rank: string;
  participant: string;
  played: string;
  wins: string;
  draws: string;
  losses: string;
  goalsFor: string;
  goalsAgainst: string;
  goalDiff: string;
  points: string;
  form: string;
  formLabels: { W: string; D: string; L: string };
}

/** Puan tablosu (TOURNAMENTS §4): O, G, B, M, A, Y, Av, P + son 5. Hesaplanır, saklanmaz. */
export function StandingsTable({ rows, names, labels, highlightTop }: { rows: StandingRow[]; names: Map<number, string>; labels: StandingsTableLabels; highlightTop?: number }) {
  return (
    <Table
      caption={labels.participant}
      columns={[
        { key: "rank", header: labels.rank, align: "end" },
        { key: "name", header: labels.participant },
        { key: "played", header: labels.played, align: "end", hideBelow: "sm" },
        { key: "wins", header: labels.wins, align: "end", hideBelow: "md" },
        { key: "draws", header: labels.draws, align: "end", hideBelow: "md" },
        { key: "losses", header: labels.losses, align: "end", hideBelow: "md" },
        { key: "goalDiff", header: labels.goalDiff, align: "end", hideBelow: "sm" },
        { key: "points", header: labels.points, align: "end" },
        { key: "form", header: labels.form, hideBelow: "lg" },
      ]}
      rows={rows.map((r, i) => ({
        id: String(r.index),
        cells: {
          rank: i + 1,
          name: (
            <span className={highlightTop && i < highlightTop ? "font-semibold text-positive" : undefined}>{names.get(r.index) ?? "—"}</span>
          ),
          played: r.played,
          wins: r.wins,
          draws: r.draws,
          losses: r.losses,
          goalDiff: r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff,
          points: <span className="font-semibold">{r.points}</span>,
          form: (
            <span className="flex gap-(--space-0-5)">
              {r.form.map((f, j) => (
                <span
                  key={j}
                  title={labels.formLabels[f]}
                  className={
                    f === "W"
                      ? "inline-flex size-(--space-5) items-center justify-center rounded-full bg-(--color-success-subtle) text-(length:--type-caption) font-semibold text-positive"
                      : f === "D"
                        ? "inline-flex size-(--space-5) items-center justify-center rounded-full bg-muted text-(length:--type-caption) font-semibold text-fg-secondary"
                        : "inline-flex size-(--space-5) items-center justify-center rounded-full bg-(--color-danger-subtle) text-(length:--type-caption) font-semibold text-negative"
                  }
                >
                  {f}
                </span>
              ))}
            </span>
          ),
        },
      }))}
    />
  );
}
