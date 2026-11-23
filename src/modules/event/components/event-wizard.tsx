"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Alert, Button, ButtonLink, Card, Checkbox, Input, RichTextEditor, Select, Textarea, cn, useOptionalToast, type SelectOption } from "@/components/ui";
import { fromIstanbulLocalInput } from "@/lib/dates";
import type { ActionResult } from "@/lib/errors";
import type { RichDoc } from "@/lib/rich-text/doc";

import { EVENT_GALLERY_MAX, EVENT_SUMMARY_MAX, EVENT_TITLE_MAX, submitProblems } from "../rules";
import type { WizardKey, WizardLabels } from "./wizard-labels";

type Action<T = undefined> = (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;

export interface WizardState {
  categoryId: string;
  titleTr: string;
  summaryTr: string;
  descriptionTr: RichDoc;
  coverKey: string | null;
  images: { key: string; alt: string | null }[];
  isOnline: boolean;
  locationName: string;
  locationAddress: string;
  mapUrl: string;
  onlineUrl: string;
  /** İstanbul yerel "YYYY-MM-DDTHH:mm" */
  startAt: string;
  endAt: string;
  applyOpensAt: string;
  applyClosesAt: string;
  capacity: string;
  waitlistEnabled: boolean;
  autoPromoteWaitlist: boolean;
  autoAccept: boolean;
  mode: "INDIVIDUAL" | "TEAM";
  teamMinSize: string;
  teamMaxSize: string;
  eligibility: "ALL_MEMBERS" | "STUDENTS_ONLY" | "ALUMNI_ONLY";
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

/** Sunucu şemasına (`eventContentSchema`) giden JSON. */
function toPayload(s: WizardState) {
  const date = (v: string) => fromIstanbulLocalInput(v)?.toISOString() ?? null;
  return {
    categoryId: s.categoryId,
    titleTr: s.titleTr,
    summaryTr: s.summaryTr,
    descriptionTr: s.descriptionTr,
    coverKey: s.coverKey,
    images: s.images,
    isOnline: s.isOnline,
    locationName: s.locationName || null,
    locationAddress: s.locationAddress || null,
    mapUrl: s.mapUrl || null,
    onlineUrl: s.onlineUrl || null,
    startAt: date(s.startAt),
    endAt: date(s.endAt),
    applyOpensAt: date(s.applyOpensAt),
    applyClosesAt: date(s.applyClosesAt),
    capacity: num(s.capacity),
    waitlistEnabled: s.waitlistEnabled,
    autoPromoteWaitlist: s.autoPromoteWaitlist,
    autoAccept: s.autoAccept,
    mode: s.mode,
    teamMinSize: s.mode === "TEAM" ? num(s.teamMinSize) : null,
    teamMaxSize: s.mode === "TEAM" ? num(s.teamMaxSize) : null,
    eligibility: s.eligibility,
  };
}

type Props = {
  clubId: string;
  eventId: string;
  /** draft: otomatik kayıt + onaya gönder; update: yayındaki etkinlik için EVENT_UPDATE; readonly */
  mode: "draft" | "update" | "readonly";
  initial: WizardState;
  categories: SelectOption[];
  leafCategoryIds: string[];
  fileBase: string;
  previewHref: string;
  labels: WizardLabels;
  saveAction: Action;
  uploadAction: Action<{ key: string; url: string }>;
  submitAction: Action;
  updateAction: Action;
  children?: ReactNode;
};

const STEPS = ["basics", "description", "time", "participation", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Etkinlik sihirbazı (EVENTS-FORMS-I18N §3): 1 Temel · 2 Açıklama · 3 Zaman/yer · 4 Katılım ·
 * 6 Önizleme → Onaya gönder (adım 5 form oluşturucu F7). Taslak 2 sn debounce ile kaydedilir.
 */
export function EventWizard(props: Props) {
  const { clubId, eventId, mode, labels: L, fileBase } = props;
  const router = useRouter();
  const toast = useOptionalToast();
  const uid = useId();
  const [state, setState] = useState<WizardState>(props.initial);
  const [step, setStep] = useState<Step>("basics");
  const [save, setSave] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const readonly = mode === "readonly";
  const t = (k: WizardKey) => L[k];
  const msg = (k: string) => (k in L ? L[k as WizardKey] : k);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (mode !== "draft") return true;
    if (timer.current) clearTimeout(timer.current);
    setSave("saving");
    const fd = new FormData();
    fd.set("clubId", clubId);
    fd.set("eventId", eventId);
    fd.set("data", JSON.stringify(toPayload(latest.current)));
    const res = await props.saveAction(null, fd);
    if (res.ok) {
      setSave("saved");
      setServerErrors({});
      setSavedAt(new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date()));
      return true;
    }
    setSave("error");
    setServerErrors(res.fieldErrors ?? {});
    return false;
  }, [clubId, eventId, mode, props]);

  const update = useCallback(
    (patch: Partial<WizardState>) => {
      if (readonly) return;
      latest.current = { ...latest.current, ...patch };
      setState(latest.current);
      if (mode === "draft") {
        setSave("dirty");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void doSave(), 2000);
      }
    },
    [doSave, mode, readonly],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (save !== "dirty" && save !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const upload = useCallback(
    async (kind: "cover" | "gallery" | "inline", file: File): Promise<string | null> => {
      const fd = new FormData();
      fd.set("clubId", clubId);
      fd.set("eventId", eventId);
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await props.uploadAction(null, fd);
      if (!res.ok || !res.data) {
        toast?.show(res.ok ? L["event.editor.saveFailed"] : res.error, "danger");
        return null;
      }
      return res.data.key;
    },
    [L, clubId, eventId, props, toast],
  );

  const problems = useMemo(() => {
    const p = toPayload(state);
    const d = (v: string | null) => (v ? new Date(v) : null);
    return submitProblems(
      {
        ...p,
        titleTr: p.titleTr,
        categoryIsLeaf: props.leafCategoryIds.includes(p.categoryId),
        startAt: d(p.startAt),
        endAt: d(p.endAt),
        applyOpensAt: d(p.applyOpensAt),
        applyClosesAt: d(p.applyClosesAt),
      },
      new Date(),
    );
  }, [props.leafCategoryIds, state]);

  const err = (field: string) => serverErrors[field];

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.set("clubId", clubId);
      fd.set("eventId", eventId);
      let res: ActionResult;
      if (mode === "draft") {
        if (!(await doSave())) {
          setSubmitError(L["event.editor.saveFailed"]);
          return;
        }
        res = await props.submitAction(null, fd);
      } else {
        fd.set("data", JSON.stringify(toPayload(latest.current)));
        res = await props.updateAction(null, fd);
      }
      if (res.ok) {
        if (res.message) toast?.show(res.message, "success");
        router.refresh();
      } else {
        setSubmitError(res.error);
        if (res.fieldErrors) setServerErrors(res.fieldErrors);
      }
    } finally {
      setBusy(false);
    }
  };

  const id = (name: string) => `${uid}-${name}`;
  const stepIndex = STEPS.indexOf(step);
  const stepLabel = (s: Step) => L[`event.wizard.steps.${s}` as WizardKey];
  const imgUrl = (key: string) => `${fileBase}${key}`;

  return (
    <div className="flex flex-col gap-(--space-4)">
      <nav aria-label={L["event.wizard.steps.basics"]} className="-mx-(--gutter) overflow-x-auto px-(--gutter)">
        <ol className="flex gap-(--space-2) pb-(--space-1)">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(s)}
                aria-current={s === step ? "step" : undefined}
                className={cn(
                  "inline-flex min-h-(--touch-target-min) items-center gap-(--space-2) rounded-badge border px-(--space-3) text-(length:--type-body-sm) font-semibold whitespace-nowrap",
                  s === step ? "border-brand bg-brand-subtle text-brand-active" : "border-line bg-card text-fg-secondary hover:text-fg",
                )}
              >
                <span aria-hidden="true">{i + 1}</span>
                {stepLabel(s)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {mode === "draft" ? (
        <p role="status" aria-live="polite" className="text-(length:--type-caption) text-fg-secondary">
          {save === "saving" ? L["event.editor.saving"] : save === "dirty" ? L["event.editor.unsaved"] : save === "error" ? L["event.editor.saveFailed"] : savedAt ? `${L["event.editor.saved"]} · ${savedAt}` : ""}
        </p>
      ) : null}
      {readonly ? <Alert tone="info">{L["event.editor.readonly"]}</Alert> : null}
      {mode === "update" ? <Alert tone="info">{L["event.editor.updateNote"]}</Alert> : null}
      {props.children}

      <Card className="flex flex-col gap-(--space-4)">
        <fieldset disabled={readonly} className="flex min-w-0 flex-col gap-(--space-4)">
          <legend className="sr-only">{stepLabel(step)}</legend>
          {step === "basics" ? (
            <>
              <Select id={id("category")} label={t("event.fields.category")} required options={props.categories} value={state.categoryId} onChange={(e) => update({ categoryId: e.target.value })} error={err("categoryId")} />
              <Input id={id("title")} label={t("event.fields.title")} required maxLength={EVENT_TITLE_MAX} value={state.titleTr} onChange={(e) => update({ titleTr: e.target.value })} error={err("titleTr")} />
              <Textarea id={id("summary")} label={t("event.fields.summary")} hint={t("event.fields.summaryHint")} required rows={3} maxLength={EVENT_SUMMARY_MAX} value={state.summaryTr} onChange={(e) => update({ summaryTr: e.target.value })} error={err("summaryTr")} />
              <ImageSlot
                label={t("event.fields.cover")}
                hint={t("event.fields.coverHint")}
                url={state.coverKey ? imgUrl(state.coverKey) : null}
                aspect="aspect-video"
                labels={L}
                disabled={readonly}
                onPick={async (file) => {
                  const key = await upload("cover", file);
                  if (key) update({ coverKey: key });
                }}
                onRemove={() => update({ coverKey: null })}
              />
              <div className="flex flex-col gap-(--space-2)">
                <p className="text-(length:--type-body-sm) font-semibold text-fg">{t("event.fields.gallery")}</p>
                <p className="text-(length:--type-caption) text-fg-secondary">{t("event.fields.galleryHint")}</p>
                <ul className="grid grid-cols-2 gap-(--space-2) sm:grid-cols-4">
                  {state.images.map((img) => (
                    <li key={img.key} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- sharp ile WebP */}
                      <img src={imgUrl(img.key)} alt="" className="aspect-square w-full rounded-control object-cover" />
                      {!readonly ? (
                        <button
                          type="button"
                          aria-label={t("event.editor.remove")}
                          onClick={() => update({ images: state.images.filter((i) => i.key !== img.key) })}
                          className="absolute top-(--space-1) right-(--space-1) inline-flex size-(--control-height-sm) items-center justify-center rounded-control bg-card text-negative shadow-(--elevation-sm)"
                        >
                          <Trash2 aria-hidden="true" className="size-(--icon-size-sm)" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!readonly && state.images.length < EVENT_GALLERY_MAX ? (
                  <FilePickButton
                    label={t("event.editor.upload")}
                    busyLabel={t("event.editor.uploading")}
                    onPick={async (file) => {
                      const key = await upload("gallery", file);
                      if (key) update({ images: [...latest.current.images, { key, alt: null }].slice(0, EVENT_GALLERY_MAX) });
                    }}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "description" ? (
            readonly ? null : (
              <RichTextEditor
                id={id("description")}
                label={t("event.fields.description")}
                required
                defaultValue={state.descriptionTr}
                onChange={(doc) => update({ descriptionTr: doc })}
                onUploadImage={async (file) => {
                  const key = await upload("inline", file);
                  return key ? imgUrl(key) : null;
                }}
                error={err("descriptionTr")}
                labels={{
                  bold: L["rte.bold"],
                  italic: L["rte.italic"],
                  underline: L["rte.underline"],
                  h1: L["rte.h1"],
                  h2: L["rte.h2"],
                  h3: L["rte.h3"],
                  bulletList: L["rte.bulletList"],
                  orderedList: L["rte.orderedList"],
                  quote: L["rte.quote"],
                  link: L["rte.link"],
                  linkPrompt: L["rte.linkPrompt"],
                  image: L["rte.image"],
                  rule: L["rte.rule"],
                  undo: L["rte.undo"],
                  redo: L["rte.redo"],
                  toolbar: L["rte.toolbar"],
                  uploading: L["rte.uploading"],
                }}
              />
            )
          ) : null}
          {step === "description" && readonly ? <p className="text-fg-secondary">{L["event.editor.readonly"]}</p> : null}

          {step === "time" ? (
            <>
              <p className="text-(length:--type-caption) text-fg-secondary">{t("event.fields.timeHint")}</p>
              <div className="grid gap-(--space-4) sm:grid-cols-2">
                <Input id={id("startAt")} type="datetime-local" label={t("event.fields.startAt")} required value={state.startAt} onChange={(e) => update({ startAt: e.target.value })} error={err("startAt")} />
                <Input id={id("endAt")} type="datetime-local" label={t("event.fields.endAt")} required value={state.endAt} onChange={(e) => update({ endAt: e.target.value })} error={err("endAt")} />
                <Input id={id("applyOpensAt")} type="datetime-local" label={t("event.fields.applyOpensAt")} required value={state.applyOpensAt} onChange={(e) => update({ applyOpensAt: e.target.value })} error={err("applyOpensAt")} />
                <Input id={id("applyClosesAt")} type="datetime-local" label={t("event.fields.applyClosesAt")} required value={state.applyClosesAt} onChange={(e) => update({ applyClosesAt: e.target.value })} error={err("applyClosesAt")} />
              </div>
              <Checkbox id={id("isOnline")} label={t("event.fields.isOnline")} checked={state.isOnline} onChange={(e) => update({ isOnline: e.target.checked })} />
              {state.isOnline ? (
                <Input id={id("onlineUrl")} type="url" label={t("event.fields.onlineUrl")} required placeholder="https://" value={state.onlineUrl} onChange={(e) => update({ onlineUrl: e.target.value })} error={err("onlineUrl")} />
              ) : (
                <>
                  <Input id={id("locationName")} label={t("event.fields.locationName")} required maxLength={120} value={state.locationName} onChange={(e) => update({ locationName: e.target.value })} error={err("locationName")} />
                  <Input id={id("locationAddress")} label={t("event.fields.locationAddress")} maxLength={300} value={state.locationAddress} onChange={(e) => update({ locationAddress: e.target.value })} error={err("locationAddress")} />
                  <Input id={id("mapUrl")} type="url" label={t("event.fields.mapUrl")} placeholder="https://" value={state.mapUrl} onChange={(e) => update({ mapUrl: e.target.value })} error={err("mapUrl")} />
                </>
              )}
            </>
          ) : null}

          {step === "participation" ? (
            <>
              <Select
                id={id("mode")}
                label={t("event.fields.mode")}
                options={[
                  { value: "INDIVIDUAL", label: t("event.mode.INDIVIDUAL") },
                  { value: "TEAM", label: t("event.mode.TEAM") },
                ]}
                value={state.mode}
                onChange={(e) => update({ mode: e.target.value as WizardState["mode"] })}
              />
              {state.mode === "TEAM" ? (
                <div className="grid gap-(--space-4) sm:grid-cols-2">
                  <Input id={id("teamMin")} type="number" min={1} max={50} label={t("event.fields.teamMinSize")} required value={state.teamMinSize} onChange={(e) => update({ teamMinSize: e.target.value })} error={err("teamMinSize")} />
                  <Input id={id("teamMax")} type="number" min={1} max={50} label={t("event.fields.teamMaxSize")} required value={state.teamMaxSize} onChange={(e) => update({ teamMaxSize: e.target.value })} error={err("teamMaxSize")} />
                </div>
              ) : null}
              <Input id={id("capacity")} type="number" min={1} label={t("event.fields.capacity")} hint={t("event.fields.capacityHint")} value={state.capacity} onChange={(e) => update({ capacity: e.target.value })} error={err("capacity")} />
              <Checkbox id={id("waitlist")} label={t("event.fields.waitlistEnabled")} checked={state.waitlistEnabled} onChange={(e) => update({ waitlistEnabled: e.target.checked })} />
              {state.waitlistEnabled ? <Checkbox id={id("promote")} label={t("event.fields.autoPromoteWaitlist")} checked={state.autoPromoteWaitlist} onChange={(e) => update({ autoPromoteWaitlist: e.target.checked })} /> : null}
              <Checkbox id={id("autoAccept")} label={t("event.fields.autoAccept")} checked={state.autoAccept} onChange={(e) => update({ autoAccept: e.target.checked })} />
              <Select
                id={id("eligibility")}
                label={t("event.fields.eligibility")}
                options={(["ALL_MEMBERS", "STUDENTS_ONLY", "ALUMNI_ONLY"] as const).map((v) => ({ value: v, label: t(`event.eligibility.${v}`) }))}
                value={state.eligibility}
                onChange={(e) => update({ eligibility: e.target.value as WizardState["eligibility"] })}
              />
              <p className="text-(length:--type-caption) text-fg-secondary">{t("event.editor.formNote")}</p>
            </>
          ) : null}
        </fieldset>

        {step === "review" ? (
          <div className="flex flex-col gap-(--space-4)">
            {Object.keys(problems).length ? (
              <Alert tone="warning">
                <p className="font-semibold">{t("event.editor.problems")}</p>
                <ul className="mt-(--space-2) list-disc pl-(--space-5)">
                  {Object.entries(problems).map(([field, key]) => (
                    <li key={field}>
                      {fieldLabel(L, field)}: {msg(key)}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <p className="inline-flex items-center gap-(--space-2) font-semibold text-positive">
                <CheckCircle2 aria-hidden="true" className="size-(--icon-size-md)" />
                {t("event.editor.ready")}
              </p>
            )}
            {submitError ? (
              <Alert tone="danger">
                <span className="inline-flex items-center gap-(--space-2)">
                  <AlertTriangle aria-hidden="true" className="size-(--icon-size-sm)" />
                  {submitError}
                </span>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-(--space-3)">
              <ButtonLink href={props.previewHref} variant="secondary" target="_blank" icon={<ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />}>
                {t("event.editor.preview")}
              </ButtonLink>
              {mode !== "readonly" ? (
                <Button onClick={() => void submit()} loading={busy} loadingLabel={t("common.loading")} disabled={Object.keys(problems).length > 0}>
                  {mode === "draft" ? t("event.editor.submit") : t("event.editor.submitUpdate")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap justify-between gap-(--space-3)">
        <Button variant="secondary" disabled={stepIndex === 0} onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)]!)}>
          {t("event.wizard.back")}
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button
            onClick={() => {
              if (mode === "draft" && save === "dirty") void doSave();
              setStep(STEPS[stepIndex + 1]!);
            }}
          >
            {t("event.wizard.next")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const FIELD_LABEL: Record<string, WizardKey> = {
  categoryId: "event.fields.category",
  titleTr: "event.fields.title",
  summaryTr: "event.fields.summary",
  descriptionTr: "event.fields.description",
  coverKey: "event.fields.cover",
  locationName: "event.fields.locationName",
  onlineUrl: "event.fields.onlineUrl",
  startAt: "event.fields.startAt",
  endAt: "event.fields.endAt",
  applyOpensAt: "event.fields.applyOpensAt",
  applyClosesAt: "event.fields.applyClosesAt",
  capacity: "event.fields.capacity",
  teamMinSize: "event.fields.teamMinSize",
  teamMaxSize: "event.fields.teamMaxSize",
};

function fieldLabel(L: WizardLabels, field: string): string {
  const k = FIELD_LABEL[field];
  return k ? L[k] : field;
}

function FilePickButton({ label, busyLabel, onPick }: { label: string; busyLabel: string; onPick: (f: File) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Button variant="secondary" size="sm" loading={busy} loadingLabel={busyLabel} onClick={() => ref.current?.click()} icon={<ImagePlus aria-hidden="true" className="size-(--icon-size-sm)" />}>
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            await onPick(f);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

function ImageSlot({ label, hint, url, aspect, labels, disabled, onPick, onRemove }: { label: string; hint: string; url: string | null; aspect: string; labels: WizardLabels; disabled: boolean; onPick: (f: File) => Promise<void>; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-(--space-2)">
      <p className="text-(length:--type-body-sm) font-semibold text-fg">
        {label} <span aria-hidden="true" className="text-negative">*</span>
      </p>
      <p className="text-(length:--type-caption) text-fg-secondary">{hint}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- sharp ile WebP
        <img src={url} alt="" className={cn(aspect, "w-full max-w-(--content-width-sm) rounded-control object-cover")} />
      ) : (
        <div aria-hidden="true" className={cn(aspect, "w-full max-w-(--content-width-sm) rounded-control bg-muted")} />
      )}
      {!disabled ? (
        <div className="flex flex-wrap gap-(--space-2)">
          <FilePickButton label={labels["event.editor.upload"]} busyLabel={labels["event.editor.uploading"]} onPick={onPick} />
          {url ? (
            <Button variant="ghost" size="sm" onClick={onRemove} icon={<Trash2 aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {labels["event.editor.remove"]}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
