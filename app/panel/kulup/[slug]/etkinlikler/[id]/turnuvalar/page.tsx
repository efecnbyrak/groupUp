import { ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { formLabels } from "@/app/_lib/form-labels";
import { PageHeader } from "@/components/shell";
import { ActionDialog, Badge, Card, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getT } from "@/i18n/server";
import { getEventForEditor } from "@/modules/event";
import { createTournamentAction, listTournamentsForEvent, PARTICIPANT_SOURCES, TOURNAMENT_FORMATS } from "@/modules/tournament";

import { requireClubPage } from "../../../club-context";

export const generateMetadata = titled("tournament.panel.title");

const STATUS_TONE: Record<string, BadgeTone> = { DRAFT: "neutral", SEEDED: "info", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "danger" };

/** Kulüp paneli: etkinliğin turnuvaları (TOURNAMENT_MANAGE). */
async function Content({ params }: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/turnuvalar">) {
  await connection();
  const [t, { slug, id }] = await Promise.all([getT(), params]);
  const { club } = await requireClubPage(slug, "TOURNAMENT_MANAGE");
  const event = await getEventForEditor(club.id, id);
  if (!event) notFound();
  const tournaments = await listTournamentsForEvent(id);
  const base = `/panel/kulup/${club.slug}/etkinlikler/${id}`;
  const labels = formLabels(t);

  const create = (
    <ActionDialog
      triggerLabel={t("tournament.create.button")}
      triggerVariant="primary"
      title={t("tournament.create.title")}
      description={t("tournament.create.body")}
      action={createTournamentAction}
      fields={[
        { type: "hidden", name: "clubId", value: club.id },
        { type: "hidden", name: "eventId", value: id },
        { type: "hidden", name: "returnTo", value: `${base}/turnuvalar` },
        { type: "text", name: "name", label: t("tournament.create.nameField"), required: true, maxLength: 120 },
        { type: "select", name: "format", label: t("tournament.create.formatField"), required: true, options: TOURNAMENT_FORMATS.map((f) => ({ value: f, label: t(`tournament.format.${f}` as MessageKey) })) },
        { type: "select", name: "source", label: t("tournament.create.sourceField"), required: true, options: PARTICIPANT_SOURCES.map((s) => ({ value: s, label: t(`tournament.create.source.${s}` as MessageKey) })) },
        { type: "textarea", name: "manualNames", label: t("tournament.create.manualNamesField"), hint: t("tournament.create.sourceField"), rows: 6, maxLength: 10_000 },
        { type: "checkbox", name: "isPublic", label: t("tournament.create.isPublicField") },
      ]}
      submitLabel={t("tournament.create.submit")}
      {...labels}
    />
  );

  return (
    <>
      <Link href={base} className="inline-flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-link hover:underline">
        <ArrowLeft aria-hidden="true" className="size-(--icon-size-sm)" />
        {event.content.titleTr || t("event.editor.title")}
      </Link>
      <PageHeader title={t("tournament.panel.title")} description={t("tournament.panel.body")} action={create} />
      {tournaments.length === 0 ? (
        <EmptyState icon={<Trophy aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("tournament.panel.empty")} description={t("tournament.panel.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-(--space-3)">
          {tournaments.map((tr) => (
            <li key={tr.id}>
              <Link href={`${base}/turnuvalar/${tr.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-(--space-3) transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md)">
                  <div className="flex flex-col gap-(--space-1)">
                    <span className="font-semibold text-fg">{tr.name}</span>
                    <span className="text-(length:--type-caption) text-fg-secondary">
                      {t(`tournament.format.${tr.format}` as MessageKey)} · {tr._count.participants}
                    </span>
                  </div>
                  <Badge tone={STATUS_TONE[tr.status] ?? "neutral"}>{t(`tournament.status.${tr.status}` as MessageKey)}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function TournamentsPage(props: PageProps<"/panel/kulup/[slug]/etkinlikler/[id]/turnuvalar">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
