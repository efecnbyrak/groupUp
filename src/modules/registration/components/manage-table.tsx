"use client";

import { useMemo, useState } from "react";

import { Badge, Button, Select, Table, useOptionalToast, type BadgeTone, type SelectOption, type TableRow } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

type Decision = "ACCEPT" | "REJECT";
type DecideAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type DecideManyAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export interface ManageRow {
  id: string;
  name: string;
  email: string;
  team: string | null;
  status: string;
  appliedAt: string;
}

export interface ManageTableLabels {
  name: string;
  status: string;
  team: string;
  appliedAt: string;
  actions: string;
  accept: string;
  reject: string;
  bulkAccept: string;
  bulkReject: string;
  all: string;
  selected: string;
  statusLabels: Record<string, string>;
}

const STATUS_TONE: Record<string, BadgeTone> = { APPLIED: "warning", ACCEPTED: "success", WAITLISTED: "info", REJECTED: "danger", CANCELLED: "neutral" };

export function RegistrationManageTable({
  clubId,
  eventId,
  rows,
  labels,
  decideAction,
  decideManyAction,
  idField = "registrationId",
}: {
  clubId: string;
  eventId: string;
  rows: ManageRow[];
  labels: ManageTableLabels;
  decideAction: DecideAction;
  decideManyAction: DecideManyAction;
  /** Tekil kararın FormData alan adı ("registrationId" veya "teamId"); toplu karar her zaman "ids". */
  idField?: "registrationId" | "teamId";
}) {
  const toast = useOptionalToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows), [rows, statusFilter]);

  const statusOptions: SelectOption[] = [
    { value: "", label: labels.all },
    ...Object.entries(labels.statusLabels).map(([value, label]) => ({ value, label })),
  ];

  const decide = async (ids: string[], decision: Decision) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("clubId", clubId);
      fd.set("eventId", eventId);
      fd.set("decision", decision);
      let res: ActionResult;
      if (ids.length === 1) {
        fd.set(idField, ids[0]!);
        res = await decideAction(null, fd);
      } else {
        fd.set("ids", JSON.stringify(ids));
        res = await decideManyAction(null, fd);
      }
      if (res.ok) {
        toast?.show(res.message ?? "", "success");
        setSelected([]);
      } else {
        toast?.show(res.error, "danger");
      }
    } finally {
      setBusy(false);
    }
  };

  const tableRows: TableRow[] = filtered.map((r) => ({
    id: r.id,
    cells: {
      name: (
        <span className="flex flex-col">
          <span className="font-medium">{r.name}</span>
          <span className="text-(length:--type-caption) text-fg-secondary">{r.email}</span>
        </span>
      ),
      team: r.team ?? "—",
      status: <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{labels.statusLabels[r.status] ?? r.status}</Badge>,
      appliedAt: r.appliedAt,
      actions: (
        <span className="inline-flex gap-(--space-2)">
          <Button size="sm" variant="secondary" disabled={busy || r.status === "ACCEPTED"} onClick={() => void decide([r.id], "ACCEPT")}>
            {labels.accept}
          </Button>
          <Button size="sm" variant="danger" disabled={busy || r.status === "REJECTED"} onClick={() => void decide([r.id], "REJECT")}>
            {labels.reject}
          </Button>
        </span>
      ),
    },
  }));

  return (
    <div className="flex flex-col gap-(--space-4)">
      <div className="flex flex-wrap items-end justify-between gap-(--space-3)">
        <div className="max-w-(--content-width-sm)">
          <Select id="durum-filtre" label={labels.status} options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        </div>
        {selected.length > 0 ? (
          <div className="flex items-center gap-(--space-2)">
            <span className="text-(length:--type-body-sm) text-fg-secondary">{labels.selected.replace("{count}", String(selected.length))}</span>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(selected, "ACCEPT")}>
              {labels.bulkAccept}
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void decide(selected, "REJECT")}>
              {labels.bulkReject}
            </Button>
          </div>
        ) : null}
      </div>
      <Table
        caption={labels.name}
        selectable
        selectAllLabel={labels.all}
        selectRowLabel={labels.name}
        onSelectionChange={setSelected}
        columns={[
          { key: "name", header: labels.name },
          { key: "team", header: labels.team },
          { key: "status", header: labels.status },
          { key: "appliedAt", header: labels.appliedAt, hideBelow: "md" },
          { key: "actions", header: labels.actions, align: "end" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
