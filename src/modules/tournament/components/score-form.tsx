"use client";

import { useState } from "react";

import { Alert, Button, Checkbox, Input, useOptionalToast } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export interface ScoreFormLabels {
  home: string;
  away: string;
  submit: string;
  saving: string;
  cascadeWarning: string;
  cascadeConfirm: string;
}

export interface ScheduleFormLabels {
  scheduledAt: string;
  submit: string;
  saving: string;
}

/** Maç saati belirleme (F10: match-scheduled bildirimi/maili tetikler). */
export function ScheduleMatchForm({
  matchId,
  clubId,
  initialValue,
  action,
  labels,
  onDone,
}: {
  matchId: string;
  clubId: string;
  initialValue?: string;
  action: Action;
  labels: ScheduleFormLabels;
  onDone?: () => void;
}) {
  const toast = useOptionalToast();
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("clubId", clubId);
    fd.set("matchId", matchId);
    fd.set("scheduledAt", value);
    const res = await action(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      onDone?.();
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-(--space-3)">
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Input id={`${matchId}-scheduledAt`} label={labels.scheduledAt} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      <Button size="sm" variant="secondary" loading={busy} loadingLabel={labels.saving} disabled={!value} onClick={() => void submit()}>
        {labels.submit}
      </Button>
    </div>
  );
}

/**
 * Skor girişi (TOURNAMENTS §3): sonraki maç henüz oynanmamışsa doğrudan kaydeder; oynandıysa
 * sunucu DOWNSTREAM_PLAYED döner, kullanıcı "zincirleme sıfırla" onayıyla tekrar gönderir.
 */
export function ScoreForm({
  matchId,
  clubId,
  homeLabel,
  awayLabel,
  initialHome,
  initialAway,
  action,
  labels,
  onDone,
}: {
  matchId: string;
  clubId: string;
  homeLabel: string;
  awayLabel: string;
  initialHome?: number | null;
  initialAway?: number | null;
  action: Action;
  labels: ScoreFormLabels;
  onDone?: () => void;
}) {
  const toast = useOptionalToast();
  const [home, setHome] = useState(initialHome != null ? String(initialHome) : "");
  const [away, setAway] = useState(initialAway != null ? String(initialAway) : "");
  const [needsCascade, setNeedsCascade] = useState(false);
  const [confirmCascade, setConfirmCascade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("clubId", clubId);
    fd.set("matchId", matchId);
    fd.set("homeScore", home);
    fd.set("awayScore", away);
    if (confirmCascade) fd.set("forceCascade", "on");
    const res = await action(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      setNeedsCascade(false);
      setConfirmCascade(false);
      onDone?.();
    } else if (res.fieldErrors?.cascade) {
      setNeedsCascade(true);
      setError(labels.cascadeWarning);
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-(--space-3)">
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <div className="flex items-end gap-(--space-3)">
        <Input id={`${matchId}-home`} label={homeLabel} type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)} />
        <span className="pb-(--space-2) text-fg-secondary">—</span>
        <Input id={`${matchId}-away`} label={awayLabel} type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)} />
      </div>
      {needsCascade ? <Checkbox id={`${matchId}-cascade`} label={labels.cascadeConfirm} checked={confirmCascade} onChange={(e) => setConfirmCascade(e.target.checked)} /> : null}
      <Button size="sm" loading={busy} loadingLabel={labels.saving} disabled={home === "" || away === "" || (needsCascade && !confirmCascade)} onClick={() => void submit()}>
        {labels.submit}
      </Button>
    </div>
  );
}
