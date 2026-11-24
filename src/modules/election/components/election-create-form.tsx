"use client";

import { useState } from "react";

import { Alert, Button, Input, Modal, Select, useOptionalToast } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";
import { fromIstanbulLocalInput } from "@/lib/dates";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export interface ElectionCreateLabels {
  club: string;
  title: string;
  candidacyOpensAt: string;
  candidacyClosesAt: string;
  votingOpensAt: string;
  votingClosesAt: string;
  submit: string;
  saving: string;
  selectPlaceholder: string;
}

/** Admin: seçim oluştur (ELECTIONS §3). 4 tarih için `datetime-local` — ActionForm bu tipi desteklemiyor (event-wizard deseni). */
export function ElectionCreateForm({
  universityId,
  clubs,
  action,
  labels,
  onDone,
}: {
  universityId: string;
  clubs: { id: string; name: string }[];
  action: Action;
  labels: ElectionCreateLabels;
  onDone?: () => void;
}) {
  const toast = useOptionalToast();
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [candidacyOpensAt, setCandidacyOpensAt] = useState("");
  const [candidacyClosesAt, setCandidacyClosesAt] = useState("");
  const [votingOpensAt, setVotingOpensAt] = useState("");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = clubId && title.trim() && candidacyOpensAt && candidacyClosesAt && votingOpensAt && votingClosesAt;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("universityId", universityId);
    fd.set("clubId", clubId);
    fd.set("title", title.trim());
    for (const [key, value] of [
      ["candidacyOpensAt", candidacyOpensAt],
      ["candidacyClosesAt", candidacyClosesAt],
      ["votingOpensAt", votingOpensAt],
      ["votingClosesAt", votingClosesAt],
    ] as const) {
      const d = fromIstanbulLocalInput(value);
      if (d) fd.set(key, d.toISOString());
    }
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
    <div className="flex flex-col gap-(--space-4)">
      {error ? <Alert tone="warning">{error}</Alert> : null}
      <Select id="election-club" label={labels.club} value={clubId} onChange={(e) => setClubId(e.target.value)} options={clubs.map((c) => ({ value: c.id, label: c.name }))} placeholder={labels.selectPlaceholder} />
      <Input id="election-title" label={labels.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <div className="grid gap-(--space-3) sm:grid-cols-2">
        <Input id="election-candidacy-opens" type="datetime-local" label={labels.candidacyOpensAt} value={candidacyOpensAt} onChange={(e) => setCandidacyOpensAt(e.target.value)} />
        <Input id="election-candidacy-closes" type="datetime-local" label={labels.candidacyClosesAt} value={candidacyClosesAt} onChange={(e) => setCandidacyClosesAt(e.target.value)} />
        <Input id="election-voting-opens" type="datetime-local" label={labels.votingOpensAt} value={votingOpensAt} onChange={(e) => setVotingOpensAt(e.target.value)} />
        <Input id="election-voting-closes" type="datetime-local" label={labels.votingClosesAt} value={votingClosesAt} onChange={(e) => setVotingClosesAt(e.target.value)} />
      </div>
      <Button loading={busy} loadingLabel={labels.saving} disabled={!complete} onClick={() => void submit()}>
        {labels.submit}
      </Button>
    </div>
  );
}

/** Tetikleyici buton + modal — admin.seçimler sayfasında kullanılır. */
export function ElectionCreateDialog({
  universityId,
  clubs,
  action,
  triggerLabel,
  dialogTitle,
  closeLabel,
  labels,
}: {
  universityId: string;
  clubs: { id: string; name: string }[];
  action: Action;
  triggerLabel: string;
  dialogTitle: string;
  closeLabel: string;
  labels: ElectionCreateLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={dialogTitle} closeLabel={closeLabel}>
        <ElectionCreateForm universityId={universityId} clubs={clubs} action={action} labels={labels} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
