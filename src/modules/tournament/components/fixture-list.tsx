"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

import type { MatchView } from "../queries";
import { ScheduleMatchForm, ScoreForm, type ScheduleFormLabels, type ScoreFormLabels } from "./score-form";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export interface FixtureListLabels extends ScoreFormLabels, ScheduleFormLabels {
  pending: string;
  /** "{n}" yer tutucusunu içerir ("Tur {n}"), istemci değiştirir. */
  roundLabel: string;
}

const STATUS_TONE: Record<string, BadgeTone> = { COMPLETED: "success", WALKOVER: "info", POSTPONED: "warning" };

/** Lig/grup fikstürü (TOURNAMENTS §6): tarih/tur gruplu liste, tıklanınca skor formu açılır. */
export function FixtureList({
  matches,
  names,
  canManage,
  clubId,
  recordScoreAction,
  scheduleMatchAction,
  labels,
}: {
  matches: MatchView[];
  names: Map<string, string>;
  canManage?: boolean;
  clubId?: string;
  recordScoreAction?: Action;
  scheduleMatchAction?: Action;
  labels: FixtureListLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : "—");

  const byRound = new Map<number, MatchView[]>();
  for (const m of matches) byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);

  return (
    <div className="flex flex-col gap-(--space-6)">
      {[...byRound.entries()].map(([round, rows]) => (
        <section key={round} className="flex flex-col gap-(--space-2)">
          <h3 className="text-(length:--type-body-sm) font-semibold text-fg-secondary">{labels.roundLabel.replace("{n}", String(round))}</h3>
          <ul className="flex flex-col gap-(--space-2)">
            {rows.map((m) => {
              const editable = canManage && m.homeId && m.awayId && recordScoreAction;
              return (
                <li key={m.id} className="rounded-card border border-line bg-card p-(--space-3)">
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setOpen((cur) => (cur === m.id ? null : m.id))}
                    className="flex w-full flex-wrap items-center justify-between gap-(--space-2) text-left"
                  >
                    <span className="flex min-w-0 items-center gap-(--space-2) text-(length:--type-body-sm)">
                      <span className="min-w-0 truncate">{name(m.homeId)}</span>
                      {m.homeScore !== null ? <span className="font-semibold tabular-nums">{m.homeScore}</span> : null}
                      <span className="text-fg-tertiary">—</span>
                      {m.awayScore !== null ? <span className="font-semibold tabular-nums">{m.awayScore}</span> : null}
                      <span className="min-w-0 truncate">{name(m.awayId)}</span>
                    </span>
                    <Badge tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status === "PENDING" ? labels.pending : m.status}</Badge>
                  </button>
                  {open === m.id && editable ? (
                    <div className="mt-(--space-3) border-t border-line pt-(--space-3)">
                      <ScoreForm
                        matchId={m.id}
                        clubId={clubId!}
                        homeLabel={name(m.homeId)}
                        awayLabel={name(m.awayId)}
                        initialHome={m.homeScore}
                        initialAway={m.awayScore}
                        action={recordScoreAction!}
                        labels={labels}
                        onDone={() => {
                          setOpen(null);
                          router.refresh();
                        }}
                      />
                      {scheduleMatchAction ? (
                        <div className="mt-(--space-3) border-t border-line pt-(--space-3)">
                          <ScheduleMatchForm matchId={m.id} clubId={clubId!} action={scheduleMatchAction} labels={labels} onDone={() => router.refresh()} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
