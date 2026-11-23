"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Alert, Badge, Button, CopyButton, Input, useOptionalToast, type BadgeTone } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

import { DynamicField, type DynamicFieldLabels } from "./dynamic-field";
import type { FieldDef } from "../rules";

type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type UploadAction = (prev: ActionResult<{ key: string }> | null, fd: FormData) => Promise<ActionResult<{ key: string }>>;

export interface MyRegistration {
  id: string;
  status: string;
  answers: Record<string, unknown>;
  waitlistPos: number | null;
}

export interface MyTeam {
  id: string;
  name: string;
  code: string;
  status: string;
  lockedAt: string | null;
  captainId: string;
  members: { userId: string; name: string; isMe: boolean }[];
}

export interface EventPanelLabels extends DynamicFieldLabels {
  submit: string;
  cancel: string;
  cancelApplication: string;
  cancelConfirm: string;
  editAnswers: string;
  save: string;
  myAnswers: string;
  status: Record<string, string>;
  /** "{pos}" yer tutucusunu içerir, istemci değiştirir. */
  waitlistPosition: string;
  createTeam: string;
  teamName: string;
  teamDetails: string;
  yourDetails: string;
  createSubmit: string;
  joinTeam: string;
  code: string;
  joinSubmit: string;
  members: string;
  captain: string;
  you: string;
  remove: string;
  transferCaptain: string;
  disband: string;
  disbandConfirm: string;
  complete: string;
  completeHint: string;
  leaveTeam: string;
  leaveConfirm: string;
  codeHint: string;
  codeCopy: string;
  codeCopied: string;
  notOpen: string;
}

const STATUS_TONE: Record<string, BadgeTone> = { APPLIED: "warning", ACCEPTED: "success", WAITLISTED: "info", REJECTED: "danger", CANCELLED: "neutral" };

function splitAnswers(fields: FieldDef[], all: Record<string, unknown>) {
  const team: Record<string, unknown> = {};
  const member: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.id in all) (f.teamLevel ? team : member)[f.id] = all[f.id];
  }
  return { team, member };
}

async function run(action: FormAction, fd: FormData, toast: ReturnType<typeof useOptionalToast>, onOk: () => void) {
  const res = await action(null, fd);
  if (res.ok) {
    if (res.message) toast?.show(res.message, "success");
    onOk();
    return null;
  }
  return res;
}

export function EventRegistrationPanel({
  eventId,
  mode,
  open,
  fields,
  myRegistration,
  myTeam,
  teamMin,
  teamMax,
  labels,
  applyAction,
  updateAnswersAction,
  cancelAction,
  createTeamAction,
  joinTeamAction,
  leaveTeamAction,
  removeTeamMemberAction,
  transferCaptainAction,
  disbandTeamAction,
  completeTeamAction,
  uploadAction,
}: {
  eventId: string;
  mode: "INDIVIDUAL" | "TEAM";
  open: boolean;
  fields: FieldDef[];
  myRegistration: MyRegistration | null;
  myTeam: MyTeam | null;
  teamMin: number;
  teamMax: number;
  labels: EventPanelLabels;
  applyAction: FormAction;
  updateAnswersAction: FormAction;
  cancelAction: FormAction;
  createTeamAction: FormAction;
  joinTeamAction: FormAction;
  leaveTeamAction: FormAction;
  removeTeamMemberAction: FormAction;
  transferCaptainAction: FormAction;
  disbandTeamAction: FormAction;
  completeTeamAction: FormAction;
  uploadAction: UploadAction;
}) {
  const router = useRouter();
  const toast = useOptionalToast();
  const refresh = () => router.refresh();

  if (mode === "INDIVIDUAL") {
    return (
      <IndividualPanel
        eventId={eventId}
        open={open}
        fields={fields}
        myRegistration={myRegistration}
        labels={labels}
        applyAction={applyAction}
        updateAnswersAction={updateAnswersAction}
        cancelAction={cancelAction}
        uploadAction={uploadAction}
        onDone={refresh}
        toast={toast}
      />
    );
  }

  if (myTeam) {
    return (
      <TeamCard
        eventId={eventId}
        team={myTeam}
        teamMin={teamMin}
        open={open}
        labels={labels}
        leaveTeamAction={leaveTeamAction}
        removeTeamMemberAction={removeTeamMemberAction}
        transferCaptainAction={transferCaptainAction}
        disbandTeamAction={disbandTeamAction}
        completeTeamAction={completeTeamAction}
        onDone={refresh}
        toast={toast}
      />
    );
  }

  if (!open) return <p className="text-(length:--type-body-sm) text-fg-secondary">{labels.notOpen}</p>;

  return (
    <TeamEntry
      eventId={eventId}
      fields={fields}
      teamMax={teamMax}
      labels={labels}
      createTeamAction={createTeamAction}
      joinTeamAction={joinTeamAction}
      uploadAction={uploadAction}
      onDone={refresh}
      toast={toast}
    />
  );
}

function IndividualPanel({
  eventId,
  open,
  fields,
  myRegistration,
  labels,
  applyAction,
  updateAnswersAction,
  cancelAction,
  uploadAction,
  onDone,
  toast,
}: {
  eventId: string;
  open: boolean;
  fields: FieldDef[];
  myRegistration: MyRegistration | null;
  labels: EventPanelLabels;
  applyAction: FormAction;
  updateAnswersAction: FormAction;
  cancelAction: FormAction;
  uploadAction: UploadAction;
  onDone: () => void;
  toast: ReturnType<typeof useOptionalToast>;
}) {
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>(myRegistration?.answers ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (myRegistration && !editing) {
    return (
      <div className="flex flex-col gap-(--space-3)">
        <p className="flex items-center gap-(--space-2)">
          <Badge tone={STATUS_TONE[myRegistration.status] ?? "neutral"}>{labels.status[myRegistration.status] ?? myRegistration.status}</Badge>
          {myRegistration.status === "WAITLISTED" && myRegistration.waitlistPos ? <span className="text-(length:--type-body-sm) text-fg-secondary">{labels.waitlistPosition.replace("{pos}", String(myRegistration.waitlistPos))}</span> : null}
        </p>
        {myRegistration.status !== "CANCELLED" && myRegistration.status !== "REJECTED" && open ? (
          <div className="flex flex-wrap gap-(--space-2)">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {labels.editAnswers}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              loadingLabel={labels.uploading}
              onClick={async () => {
                if (!window.confirm(labels.cancelConfirm)) return;
                setBusy(true);
                const fd = new FormData();
                fd.set("eventId", eventId);
                fd.set("registrationId", myRegistration.id);
                const err = await run(cancelAction, fd, toast, onDone);
                if (err) toast?.show(err.error, "danger");
                setBusy(false);
              }}
            >
              {labels.cancelApplication}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!open && !myRegistration) return <p className="text-(length:--type-body-sm) text-fg-secondary">{labels.notOpen}</p>;

  const submit = async () => {
    setBusy(true);
    setGlobalError(null);
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("answers", JSON.stringify(answers));
    const action = myRegistration ? updateAnswersAction : applyAction;
    const res = await action(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      setErrors({});
      setEditing(false);
      onDone();
    } else {
      setGlobalError(res.error);
      setErrors(res.fieldErrors ?? {});
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-(--space-3)">
      {globalError ? <Alert tone="danger">{globalError}</Alert> : null}
      {fields.map((f) => (
        <DynamicField key={f.id} field={f} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} error={errors[f.id]} eventId={eventId} uploadAction={uploadAction} labels={labels} />
      ))}
      <div className="flex gap-(--space-2)">
        <Button loading={busy} loadingLabel={labels.uploading} onClick={() => void submit()}>
          {myRegistration ? labels.save : labels.submit}
        </Button>
        {editing ? (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            {labels.cancel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TeamEntry({
  eventId,
  fields,
  teamMax,
  labels,
  createTeamAction,
  joinTeamAction,
  uploadAction,
  onDone,
  toast,
}: {
  eventId: string;
  fields: FieldDef[];
  teamMax: number;
  labels: EventPanelLabels;
  createTeamAction: FormAction;
  joinTeamAction: FormAction;
  uploadAction: UploadAction;
  onDone: () => void;
  toast: ReturnType<typeof useOptionalToast>;
}) {
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { team: teamFields, member: memberFields } = useMemo(
    () => ({ team: fields.filter((f) => f.teamLevel), member: fields.filter((f) => !f.teamLevel) }),
    [fields],
  );
  const split = () => splitAnswers(fields, answers);

  if (mode === "none") {
    return (
      <div className="flex flex-wrap gap-(--space-2)">
        <Button onClick={() => setMode("create")}>{labels.createTeam}</Button>
        <Button variant="secondary" onClick={() => setMode("join")}>
          {labels.joinTeam}
        </Button>
      </div>
    );
  }

  const submitCreate = async () => {
    setBusy(true);
    setGlobalError(null);
    const { team, member } = split();
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("name", name);
    fd.set("teamAnswers", JSON.stringify(team));
    fd.set("memberAnswers", JSON.stringify(member));
    const res = await createTeamAction(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      onDone();
    } else {
      setGlobalError(res.error);
      setErrors(res.fieldErrors ?? {});
    }
    setBusy(false);
  };

  const submitJoin = async () => {
    setBusy(true);
    setGlobalError(null);
    const { member } = split();
    const fd = new FormData();
    fd.set("eventId", eventId);
    fd.set("code", code);
    fd.set("memberAnswers", JSON.stringify(member));
    const res = await joinTeamAction(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      onDone();
    } else {
      setGlobalError(res.error);
      setErrors(res.fieldErrors ?? {});
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-(--space-3)">
      {globalError ? <Alert tone="danger">{globalError}</Alert> : null}
      {mode === "create" ? (
        <>
          <Input id="takim-adi" label={labels.teamName} required value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          {teamFields.length ? (
            <div className="flex flex-col gap-(--space-3)">
              <p className="text-(length:--type-caption) font-semibold text-fg-secondary">{labels.teamDetails}</p>
              {teamFields.map((f) => (
                <DynamicField key={f.id} field={f} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} error={errors[f.id]} eventId={eventId} uploadAction={uploadAction} labels={labels} />
              ))}
            </div>
          ) : null}
          {memberFields.length ? (
            <div className="flex flex-col gap-(--space-3)">
              <p className="text-(length:--type-caption) font-semibold text-fg-secondary">{labels.yourDetails}</p>
              {memberFields.map((f) => (
                <DynamicField key={f.id} field={f} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} error={errors[f.id]} eventId={eventId} uploadAction={uploadAction} labels={labels} />
              ))}
            </div>
          ) : null}
          <div className="flex gap-(--space-2)">
            <Button loading={busy} loadingLabel={labels.uploading} disabled={!name.trim()} onClick={() => void submitCreate()}>
              {labels.createSubmit}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>
              {labels.cancel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Input id="takim-kodu" label={labels.code} required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} />
          {memberFields.length ? (
            <div className="flex flex-col gap-(--space-3)">
              {memberFields.map((f) => (
                <DynamicField key={f.id} field={f} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} error={errors[f.id]} eventId={eventId} uploadAction={uploadAction} labels={labels} />
              ))}
            </div>
          ) : null}
          <div className="flex gap-(--space-2)">
            <Button loading={busy} loadingLabel={labels.uploading} disabled={!code.trim()} onClick={() => void submitJoin()}>
              {labels.joinSubmit}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>
              {labels.cancel}
            </Button>
          </div>
        </>
      )}
      <p className="text-(length:--type-caption) text-fg-secondary">{labels.codeHint.replace("{max}", String(teamMax))}</p>
    </div>
  );
}

function TeamCard({
  eventId,
  team,
  teamMin,
  open,
  labels,
  leaveTeamAction,
  removeTeamMemberAction,
  transferCaptainAction,
  disbandTeamAction,
  completeTeamAction,
  onDone,
  toast,
}: {
  eventId: string;
  team: MyTeam;
  teamMin: number;
  open: boolean;
  labels: EventPanelLabels;
  leaveTeamAction: FormAction;
  removeTeamMemberAction: FormAction;
  transferCaptainAction: FormAction;
  disbandTeamAction: FormAction;
  completeTeamAction: FormAction;
  onDone: () => void;
  toast: ReturnType<typeof useOptionalToast>;
}) {
  const [busy, setBusy] = useState(false);
  const isCaptain = team.members.some((m) => m.isMe && m.userId === team.captainId);
  const locked = Boolean(team.lockedAt);

  const act = async (action: FormAction, fd: FormData) => {
    setBusy(true);
    fd.set("eventId", eventId);
    const res = await action(null, fd);
    if (res.ok) {
      if (res.message) toast?.show(res.message, "success");
      onDone();
    } else {
      toast?.show(res.error, "danger");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-(--space-3)">
      <div className="flex flex-wrap items-center gap-(--space-2)">
        <span className="font-semibold text-fg">{team.name}</span>
        <Badge tone={STATUS_TONE[team.status] ?? "neutral"}>{labels.status[team.status] ?? team.status}</Badge>
      </div>
      {!locked ? (
        <div className="flex items-center gap-(--space-2)">
          <code className="rounded-control bg-muted px-(--space-2) py-(--space-1) font-mono text-(length:--type-body)">{team.code}</code>
          <CopyButton value={team.code} label={labels.codeCopy} copiedLabel={labels.codeCopied} />
        </div>
      ) : null}
      <ul className="flex flex-col gap-(--space-1)">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-(--space-2) text-(length:--type-body-sm)">
            <span>
              {m.name} {m.isMe ? `(${labels.you})` : ""} {m.userId === team.captainId ? <Badge tone="info">{labels.captain}</Badge> : null}
            </span>
            {isCaptain && !locked && m.userId !== team.captainId ? (
              <span className="flex gap-(--space-1)">
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(removeTeamMemberAction, (() => { const fd = new FormData(); fd.set("teamId", team.id); fd.set("userId", m.userId); return fd; })())}>
                  {labels.remove}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(transferCaptainAction, (() => { const fd = new FormData(); fd.set("teamId", team.id); fd.set("userId", m.userId); return fd; })())}>
                  {labels.transferCaptain}
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {!locked && open ? (
        <div className="flex flex-wrap gap-(--space-2)">
          {isCaptain ? (
            <>
              <Button
                size="sm"
                disabled={busy || team.members.length < teamMin}
                loading={busy}
                loadingLabel={labels.uploading}
                onClick={() => void act(completeTeamAction, (() => { const fd = new FormData(); fd.set("teamId", team.id); return fd; })())}
              >
                {labels.complete}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(labels.disbandConfirm)) return;
                  void act(disbandTeamAction, (() => { const fd = new FormData(); fd.set("teamId", team.id); return fd; })());
                }}
              >
                {labels.disband}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(labels.leaveConfirm)) return;
                void act(leaveTeamAction, (() => { const fd = new FormData(); fd.set("teamId", team.id); return fd; })());
              }}
            >
              {labels.leaveTeam}
            </Button>
          )}
        </div>
      ) : null}
      {isCaptain && !locked && team.members.length < teamMin ? <p className="text-(length:--type-caption) text-fg-secondary">{labels.completeHint}</p> : null}
    </div>
  );
}
