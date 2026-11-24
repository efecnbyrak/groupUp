"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Button, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

import type { MatchView } from "../queries";
import { ScheduleMatchForm, ScoreForm, type ScheduleFormLabels, type ScoreFormLabels } from "./score-form";

const BOX_W = 200;
const BOX_H = 64;
const COL_GAP = 56;
const MIN_ROW_GAP = 16;

interface Box {
  match: MatchView;
  x: number;
  y: number;
}

/** Her round1 maçını (H+gap) aralıklarla, sonraki round'ları çocuklarının orta noktasına yerleştirir. */
function layout(matchesByRound: MatchView[][]): { boxes: Box[]; width: number; height: number } {
  const boxes: Box[] = [];
  const centerY = new Map<string, number>();
  const unit = BOX_H + MIN_ROW_GAP;

  matchesByRound[0]?.forEach((m, i) => {
    const y = i * unit;
    boxes.push({ match: m, x: 0, y });
    centerY.set(m.id, y + BOX_H / 2);
  });

  for (let r = 1; r < matchesByRound.length; r++) {
    const round = matchesByRound[r]!;
    for (const m of round) {
      if (m.groupKey) continue; // 3.lük ayrı yerleştirilir
      const feeders = matchesByRound[r - 1]!.filter((p) => p.nextMatchId === m.id);
      const ys = feeders.map((f) => centerY.get(f.id) ?? 0);
      const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
      boxes.push({ match: m, x: r * (BOX_W + COL_GAP), y: y - BOX_H / 2 });
      centerY.set(m.id, y);
    }
    const third = round.find((m) => m.groupKey === "THIRD_PLACE");
    if (third) {
      const lastRound1Y = boxes.filter((b) => b.x === (r - 1) * (BOX_W + COL_GAP)).reduce((max, b) => Math.max(max, b.y), 0);
      const y = lastRound1Y + unit * 1.5;
      boxes.push({ match: third, x: r * (BOX_W + COL_GAP), y });
      centerY.set(third.id, y + BOX_H / 2);
    }
  }

  const width = matchesByRound.length * BOX_W + Math.max(0, matchesByRound.length - 1) * COL_GAP;
  const height = Math.max(...boxes.map((b) => b.y + BOX_H), BOX_H) + MIN_ROW_GAP;
  return { boxes, width, height };
}

export interface BracketLabels {
  bye: string;
  tbd: string;
  thirdPlace: string;
  close: string;
}

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Tek eleme braketi (TOURNAMENTS §6): SVG bağlantı çizgileri, HTML maç kutuları (erişilebilirlik
 * için), mobilde yatay kaydırma. Kütüphanesiz. `canManage` ise maça tıklayınca alttaki panelde
 * skor girişi açılır (kutu küçük olduğundan formu doğrudan içine sığdırmak yerine).
 */
export function BracketView({
  matches,
  names,
  labels,
  canManage,
  clubId,
  recordScoreAction,
  scoreLabels,
  scheduleMatchAction,
  scheduleLabels,
}: {
  matches: MatchView[];
  names: Map<string, string>;
  labels: BracketLabels;
  canManage?: boolean;
  clubId?: string;
  recordScoreAction?: Action;
  scoreLabels?: ScoreFormLabels;
  scheduleMatchAction?: Action;
  scheduleLabels?: ScheduleFormLabels;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const rounds = useMemo(() => {
    const maxRound = Math.max(...matches.map((m) => m.round), 1);
    const byRound: MatchView[][] = [];
    for (let r = 1; r <= maxRound; r++) byRound.push(matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position));
    return byRound;
  }, [matches]);

  const { boxes, width, height } = useMemo(() => layout(rounds), [rounds]);
  const byId = new Map(boxes.map((b) => [b.match.id, b]));
  const name = (id: string | null) => (id ? (names.get(id) ?? "—") : null);
  const editable = (m: MatchView) => canManage && m.homeId && m.awayId && m.status !== "BYE";
  const selectedMatch = selected ? matches.find((m) => m.id === selected) : null;

  return (
    <div className="flex flex-col gap-(--space-4)">
      <div className="-mx-(--gutter) overflow-x-auto px-(--gutter) pb-(--space-4)">
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="absolute top-0 left-0" aria-hidden="true">
            {boxes.map((b) => {
              if (!b.match.nextMatchId || b.match.groupKey) return null;
              const next = byId.get(b.match.nextMatchId);
              if (!next) return null;
              const x1 = b.x + BOX_W;
              const y1 = b.y + BOX_H / 2;
              const x2 = next.x;
              const y2 = next.y + BOX_H / 2;
              const midX = x1 + (x2 - x1) / 2;
              return <path key={b.match.id} d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} fill="none" stroke="var(--color-border-strong)" strokeWidth={2} />;
            })}
          </svg>
          {boxes.map((b) => {
            const canEdit = editable(b.match);
            return (
              <button
                key={b.match.id}
                type="button"
                disabled={!canEdit}
                onClick={() => setSelected(b.match.id)}
                className={cn(
                  "absolute flex flex-col gap-(--space-1) rounded-control border bg-card p-(--space-2) text-left shadow-(--elevation-sm)",
                  b.match.groupKey ? "border-dashed border-line" : "border-line",
                  canEdit && "cursor-pointer hover:border-brand",
                  selected === b.match.id && "outline-(length:--focus-ring-width) outline-(--color-focus)",
                )}
                style={{ left: b.x, top: b.y, width: BOX_W }}
              >
                {b.match.groupKey === "THIRD_PLACE" ? <span className="text-(length:--type-caption) font-semibold text-fg-secondary">{labels.thirdPlace}</span> : null}
                <MatchSide name={name(b.match.homeId)} score={b.match.homeScore} winner={b.match.winnerId === b.match.homeId} tbd={labels.tbd} />
                <MatchSide name={name(b.match.awayId)} score={b.match.awayScore} winner={b.match.winnerId === b.match.awayId} tbd={labels.tbd} />
                {b.match.status === "BYE" ? <Badge tone="neutral">{labels.bye}</Badge> : null}
              </button>
            );
          })}
        </div>
      </div>
      {selectedMatch && recordScoreAction && scoreLabels && clubId ? (
        <div className="max-w-(--content-width-sm) rounded-card border border-line bg-card p-(--space-4)">
          <div className="mb-(--space-3) flex items-center justify-between">
            <p className="font-semibold text-fg">
              {name(selectedMatch.homeId)} — {name(selectedMatch.awayId)}
            </p>
            <Button variant="ghost" size="sm" aria-label={labels.close} onClick={() => setSelected(null)}>
              ✕
            </Button>
          </div>
          <ScoreForm
            matchId={selectedMatch.id}
            clubId={clubId}
            homeLabel={name(selectedMatch.homeId) ?? ""}
            awayLabel={name(selectedMatch.awayId) ?? ""}
            initialHome={selectedMatch.homeScore}
            initialAway={selectedMatch.awayScore}
            action={recordScoreAction}
            labels={scoreLabels}
            onDone={() => {
              setSelected(null);
              router.refresh();
            }}
          />
          {scheduleMatchAction && scheduleLabels && selectedMatch.homeId && selectedMatch.awayId ? (
            <div className="mt-(--space-3) border-t border-line pt-(--space-3)">
              <ScheduleMatchForm matchId={selectedMatch.id} clubId={clubId} action={scheduleMatchAction} labels={scheduleLabels} onDone={() => router.refresh()} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MatchSide({ name, score, winner, tbd }: { name: string | null; score: number | null; winner: boolean; tbd: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-(--space-2) text-(length:--type-body-sm)", winner && "font-semibold text-fg", !name && "text-fg-tertiary italic")}>
      <span className="min-w-0 truncate">{name ?? tbd}</span>
      {score !== null ? <span className="shrink-0 tabular-nums">{score}</span> : null}
    </div>
  );
}
