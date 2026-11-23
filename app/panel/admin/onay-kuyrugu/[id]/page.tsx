import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { diffRows, personName, RequestStatusBadge, requestTypeLabel } from "@/app/_components/requests";
import { confirmLabels, formLabels } from "@/app/_lib/form-labels";
import { titled } from "@/app/_lib/metadata";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Alert, Avatar, ButtonLink, Card, CardHeader, ConfirmAction, DiffView, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { approveRequestAction, getRequestDetail, REJECT_REASON_MAX, REJECT_REASON_MIN, rejectRequestAction } from "@/modules/approval";

import { requireAdminPage } from "../../admin-context";

export const generateMetadata = titled("approval.detail.title");

const KB = 1024;

/** Talep detayı: talep eden, gerekçe, ekler (5 dk imzalı), fark görünümü, Onayla / Reddet (gerekçeli). */
async function Content({ params }: PageProps<"/panel/admin/onay-kuyrugu/[id]">) {
  const [t, locale, { id }, { university }] = await Promise.all([getT(), getLocale(), params, requireAdminPage()]);
  const req = await getRequestDetail(university.id, id);
  if (!req) notFound();
  const back = req.type === "ALUMNI_VERIFY" ? "/panel/admin/mezun-dogrulama" : "/panel/admin/onay-kuyrugu";

  return (
    <>
      <Link href={back} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {req.type === "ALUMNI_VERIFY" ? t("admin.nav.alumni") : t("admin.nav.approvals")}
      </Link>
      <PageHeader title={requestTypeLabel(t, req.type)} description={req.club ? req.club.name : t("approval.detail.noClub")} action={<RequestStatusBadge status={req.status} t={t} />} />

      {req.status !== "PENDING" ? (
        <Alert tone={req.status === "APPROVED" ? "success" : "info"}>
          {t(`approval.detail.decided.${req.status === "APPROVED" ? "APPROVED" : req.status === "REJECTED" ? "REJECTED" : "CANCELLED"}`, { date: req.decidedAt ? formatDateTime(req.decidedAt, locale) : "—" })}
          {req.decisionNote ? ` — ${req.decisionNote}` : ""}
        </Alert>
      ) : null}

      <div className="grid gap-(--space-6) lg:grid-cols-3">
        <div className="flex flex-col gap-(--space-6) lg:col-span-2">
          {req.type.startsWith("EVENT_") ? (
            <Card className="flex flex-wrap items-center justify-between gap-(--space-3)">
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t("approval.detail.eventPreview")}</p>
              <ButtonLink href={`/etkinlikler/${req.targetId}`} target="_blank" variant="secondary" size="sm" icon={<ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />}>
                {t("approval.detail.openEvent")}
              </ButtonLink>
            </Card>
          ) : null}
          <section className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("approval.detail.changes")}</h2>
            <DiffView rows={diffRows(t, locale, req.diff)} labels={{ before: t("approval.diff.before"), after: t("approval.diff.after") }} empty={t("approval.diff.noRows")} />
          </section>
          {req.reason ? (
            <Card className="flex flex-col gap-(--space-2)">
              <h2 className="text-(length:--type-body) font-semibold text-fg">{t("approval.detail.reason")}</h2>
              <p className="whitespace-pre-line text-fg-secondary">{req.reason}</p>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-body) font-semibold text-fg">{t("approval.attachments")}</h2>
            {req.attachments.length === 0 ? (
              <p className="text-(length:--type-body-sm) text-fg-secondary">{t("approval.detail.noAttachments")}</p>
            ) : (
              <ul className="flex flex-col gap-(--space-2)">
                {req.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-(--space-2) font-semibold text-link hover:underline">
                      <FileText aria-hidden="true" className="size-(--icon-size-sm)" />
                      <span className="break-all">{a.fileName}</span>
                      <span className="text-(length:--type-caption) font-normal text-fg-secondary">{Math.max(1, Math.round(a.sizeBytes / KB))} KB</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {req.attachments.length ? <p className="text-(length:--type-caption) text-fg-secondary">{t("approval.detail.signedHint")}</p> : null}
          </Card>
        </div>

        <aside className="flex flex-col gap-(--space-4)">
          <Card className="flex flex-col gap-(--space-3)">
            <CardHeader title={t("approval.queue.requestedBy")} />
            <Person name={personName(req.requestedBy)} email={req.requestedBy.email} avatar={req.requestedBy.profile?.avatarKey} />
            <p className="text-(length:--type-caption) text-fg-secondary">{formatDateTime(req.createdAt, locale)}</p>
          </Card>
          {req.target ? (
            <Card className="flex flex-col gap-(--space-3)">
              <CardHeader title={t("approval.detail.target")} />
              <Person name={personName(req.target)} email={req.target.email} avatar={req.target.profile?.avatarKey} />
              {req.type === "ALUMNI_VERIFY" && req.target.profile?.graduationYear ? (
                <p className="text-(length:--type-body-sm) text-fg-secondary">{t("admin.alumni.graduationYear")}: {req.target.profile.graduationYear}</p>
              ) : null}
            </Card>
          ) : null}
          {req.status === "PENDING" ? (
            <Card className="flex flex-col gap-(--space-3)">
              <CardHeader title={t("approval.detail.decision")} description={t("approval.detail.decisionBody")} />
              <div className="flex flex-wrap gap-(--space-2)">
                <ConfirmAction
                  action={approveRequestAction}
                  values={{ universityId: university.id, requestId: req.id }}
                  variant="primary"
                  triggerLabel={t("approval.approve")}
                  title={t("approval.approveTitle")}
                  description={t("approval.approveBody")}
                  {...confirmLabels(t)}
                  confirmLabel={t("approval.approve")}
                />
                <ActionDialog
                  triggerLabel={t("approval.reject")}
                  triggerVariant="secondary"
                  title={t("approval.rejectTitle")}
                  description={t("approval.rejectBody", { min: REJECT_REASON_MIN, max: REJECT_REASON_MAX })}
                  action={rejectRequestAction}
                  submitVariant="danger"
                  fields={[
                    { type: "hidden", name: "universityId", value: university.id },
                    { type: "hidden", name: "requestId", value: req.id },
                    { type: "textarea", name: "reason", label: t("approval.reason"), required: true, rows: 4, maxLength: REJECT_REASON_MAX },
                  ]}
                  submitLabel={t("approval.reject")}
                  {...formLabels(t)}
                />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Person({ name, email, avatar }: { name: string; email: string; avatar?: string | null }) {
  return (
    <div className="flex items-center gap-(--space-3)">
      <Avatar name={name} src={publicFileUrl(avatar)} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-fg">{name}</span>
        <span className="truncate text-(length:--type-caption) text-fg-secondary">{email}</span>
      </span>
    </div>
  );
}

export default function RequestDetailPage(props: PageProps<"/panel/admin/onay-kuyrugu/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
