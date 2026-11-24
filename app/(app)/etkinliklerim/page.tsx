import { CalendarX2 } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { eventTitle } from "@/app/_components/events";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Avatar, Badge, ButtonLink, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { formatEventDateTime } from "@/lib/dates";
import { publicFileUrl } from "@/lib/storage";
import { listMyRegistrations } from "@/modules/registration";

export const generateMetadata = titled("nav.myEvents");

const STATUS_TONE: Record<string, BadgeTone> = { APPLIED: "warning", ACCEPTED: "success", WAITLISTED: "info", REJECTED: "danger", CANCELLED: "neutral" };

/** Başvurularım (§5): bireysel ve takım üyeliği başvuruları, yaklaşana göre sıralı. */
async function Content() {
  const user = await requirePageUser("/etkinliklerim");
  await connection();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const registrations = await listMyRegistrations(user.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-(--space-4)">
        <div className="flex flex-col gap-(--space-1)">
          <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("registration.myApplications.title")}</h1>
          <p className="text-fg-secondary">{t("registration.myApplications.body")}</p>
        </div>
        <ButtonLink href="/maclarim" variant="secondary">
          {t("tournament.myMatches.title")}
        </ButtonLink>
      </div>
      {registrations.length === 0 ? (
        <EmptyState icon={<CalendarX2 aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("registration.myApplications.empty")} description={t("registration.myApplications.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-(--space-3)">
          {registrations.map((r) => (
            <li key={r.id}>
              <Link
                href={`/etkinlikler/${r.event.id}`}
                className="flex items-center gap-(--space-3) rounded-card border border-line bg-card p-(--space-4) transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)"
              >
                <Avatar name={r.event.club.name} src={publicFileUrl(r.event.club.logoKey)} size="md" shape="square" />
                <div className="flex min-w-0 flex-1 flex-col gap-(--space-1)">
                  <div className="flex flex-wrap items-center gap-(--space-2)">
                    <span className="font-semibold break-words text-fg">{eventTitle(r.event, locale)}</span>
                    <Badge tone="neutral">{r.event.mode === "TEAM" ? t("registration.myApplications.team") : t("registration.myApplications.individual")}</Badge>
                  </div>
                  <span className="text-(length:--type-caption) text-fg-secondary">
                    {r.event.club.name} · {r.event.startAt ? formatEventDateTime(r.event.startAt, locale) : t("event.noDate")}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-(--space-1)">
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{t(`registration.apply.status.${r.status}` as MessageKey)}</Badge>
                  {r.status === "WAITLISTED" && r.waitlistPos ? (
                    <span className="text-(length:--type-caption) text-fg-secondary">{t("registration.apply.waitlistPosition", { pos: r.waitlistPos })}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MyApplicationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
