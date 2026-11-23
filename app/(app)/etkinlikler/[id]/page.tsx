import { CalendarDays, Clock, ExternalLink, LayoutDashboard, MapPin, User, Users, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { countdownLabel, EventStatusBadge, eventTitle, registrationBadge } from "@/app/_components/events";
import { Alert, Avatar, Badge, ButtonLink, Card, RichText, Skeleton } from "@/components/ui";
import type { MessageKey } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { getClubAccess, getSessionUser } from "@/lib/authz";
import { canOpenClubPanel } from "@/lib/club-roles";
import { formatEventDateTime } from "@/lib/dates";
import { renderRichText } from "@/lib/rich-text/sanitize";
import { publicFileUrl } from "@/lib/storage";
import { getEventDetail, pick, registrationState } from "@/modules/event";

const PUBLIC = new Set(["PUBLISHED", "COMPLETED", "CANCELLED"]);

export async function generateMetadata({ params }: PageProps<"/etkinlikler/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await getEventDetail(id);
  if (!e || !PUBLIC.has(e.status)) return { title: "groupUp" };
  return { title: `${e.titleTr} — groupUp`, description: e.summaryTr };
}

/**
 * Etkinlik detayı (§8). Yayındaki/geçmiş/iptal etkinlik herkese açık; taslak ve onay bekleyen
 * yalnızca kulüp ekibi ve Admin'e önizleme olarak görünür.
 */
async function Content({ params }: PageProps<"/etkinlikler/[id]">) {
  await connection();
  const [t, locale, { id }, viewer] = await Promise.all([getT(), getLocale(), params, getSessionUser()]);
  const e = await getEventDetail(id);
  if (!e || e.club.deletedAt) notFound();
  const user = viewer?.emailVerified && viewer.status === "ACTIVE" ? viewer : null;
  const access = user ? await getClubAccess(user, e.club.id) : null;
  const team = Boolean(access && (canOpenClubPanel(access) || access.isAdmin));
  if (!PUBLIC.has(e.status) && !team) notFound();

  const now = new Date();
  const state = registrationState(e, now);
  const badge = registrationBadge(t, state);
  const en = locale === "en";
  const description = pick(locale, e.descriptionTr, e.descriptionEn);
  const translationPending = en && !e.titleEn;
  const cover = publicFileUrl(e.coverKey);
  const icon = "size-(--icon-size-sm) shrink-0 text-fg-secondary";

  return (
    <article className="flex flex-col gap-(--space-6)">
      {!PUBLIC.has(e.status) ? <Alert tone="warning">{t("event.detail.previewNote")}</Alert> : null}
      {e.status === "CANCELLED" ? <Alert tone="danger">{t("event.detail.cancelled")}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- kapak sharp ile 1200×675 WebP
          <img src={cover} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="aspect-video w-full bg-brand-subtle" />
        )}
        <div className="flex flex-col gap-(--space-4) p-(--space-4) sm:p-(--space-6)">
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <Link href={`/kulupler/${e.club.slug}`} className="inline-flex min-w-0 items-center gap-(--space-2) font-semibold text-fg hover:underline">
              <Avatar name={e.club.name} src={publicFileUrl(e.club.logoKey)} size="sm" shape="square" />
              <span className="truncate">{e.club.name}</span>
            </Link>
            <Badge>{en ? e.category.nameEn : e.category.nameTr}</Badge>
            {e.status === "PUBLISHED" ? <Badge tone={badge.tone}>{badge.label}</Badge> : <EventStatusBadge status={e.status} t={t} />}
            {translationPending ? <Badge tone="info">{t("event.detail.translationPending")}</Badge> : null}
          </div>
          <h1 className="text-(length:--type-heading-xl) font-semibold break-words text-fg" lang={en && e.titleEn ? "en" : "tr"}>
            {eventTitle(e, locale)}
          </h1>
          <p className="text-(length:--type-body-lg) text-fg-secondary">{pick(locale, e.summaryTr, e.summaryEn)}</p>
          {team ? (
            <div>
              <ButtonLink href={`/panel/kulup/${e.club.slug}/etkinlikler/${e.id}`} variant="secondary" size="sm" icon={<LayoutDashboard aria-hidden="true" className="size-(--icon-size-sm)" />}>
                {t("event.detail.manage")}
              </ButtonLink>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-(--space-6) lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-(--space-6) lg:col-span-2">
          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("event.detail.about")}</h2>
            <RichText sanitizedHtml={renderRichText(description)} lang={en && e.descriptionEn ? "en" : "tr"} className="max-w-(--content-width-prose) text-fg" />
          </Card>
          {e.images.length ? (
            <Card className="flex flex-col gap-(--space-3)">
              <h2 className="text-(length:--type-heading-sm) font-semibold text-fg">{t("event.fields.gallery")}</h2>
              <ul className="grid grid-cols-2 gap-(--space-2) sm:grid-cols-3">
                {e.images.map((img) => (
                  <li key={img.key}>
                    <a href={publicFileUrl(img.key) ?? "#"} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- sharp ile WebP */}
                      <img src={publicFileUrl(img.key) ?? ""} alt={img.alt ?? ""} loading="lazy" className="aspect-square w-full rounded-control object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-(--space-4)">
          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-body) font-semibold text-fg">{t("event.detail.when")}</h2>
            <Row icon={<CalendarDays aria-hidden="true" className={icon} />}>
              {e.startAt ? formatEventDateTime(e.startAt, locale) : t("event.noDate")}
              {e.endAt ? ` – ${formatEventDateTime(e.endAt, locale)}` : ""}
            </Row>
            {e.isOnline ? (
              <Row icon={<Video aria-hidden="true" className={icon} />}>
                {t("event.online")}
                {e.onlineUrl && user ? (
                  <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer nofollow" className="ml-(--space-1) inline-flex items-center gap-(--space-1) text-link hover:underline">
                    {t("event.detail.join")}
                    <ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />
                  </a>
                ) : null}
              </Row>
            ) : (
              <Row icon={<MapPin aria-hidden="true" className={icon} />}>
                <span className="flex flex-col">
                  <span>{e.locationName}</span>
                  {e.locationAddress ? <span className="text-(length:--type-caption) text-fg-secondary">{e.locationAddress}</span> : null}
                  {e.mapUrl ? (
                    <a href={e.mapUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-(--space-1) text-(length:--type-caption) text-link hover:underline">
                      {t("event.detail.map")}
                      <ExternalLink aria-hidden="true" className="size-(--icon-size-sm)" />
                    </a>
                  ) : null}
                </span>
              </Row>
            )}
            <Row icon={e.mode === "TEAM" ? <Users aria-hidden="true" className={icon} /> : <User aria-hidden="true" className={icon} />}>
              {e.mode === "TEAM" ? t("event.detail.teamSize", { min: e.teamMinSize ?? 1, max: e.teamMaxSize ?? 1 }) : t("event.mode.INDIVIDUAL")}
            </Row>
          </Card>

          <Card className="flex flex-col gap-(--space-3)">
            <h2 className="text-(length:--type-body) font-semibold text-fg">{t("event.detail.registration")}</h2>
            {e.applyOpensAt && e.applyClosesAt ? (
              <p className="text-(length:--type-body-sm) text-fg-secondary">
                {t("event.detail.window", { from: formatEventDateTime(e.applyOpensAt, locale), to: formatEventDateTime(e.applyClosesAt, locale) })}
              </p>
            ) : null}
            <p className="text-(length:--type-body-sm) text-fg-secondary">
              {e.capacity ? t("event.detail.capacity", { count: e.capacity }) : t("event.detail.unlimited")} · {t(`event.eligibility.${e.eligibility}` as MessageKey)}
            </p>
            {e.status === "PUBLISHED" && (state === "OPEN" || state === "CLOSING_SOON" || state === "WAITLIST") ? (
              <p className="flex items-center gap-(--space-1) text-(length:--type-body-sm) font-semibold text-caution">
                <Clock aria-hidden="true" className="size-(--icon-size-sm)" />
                {countdownLabel(t, e.applyClosesAt, now)}
              </p>
            ) : null}
            {!user && e.status === "PUBLISHED" ? (
              <ButtonLink href={`/giris?next=${encodeURIComponent(`/etkinlikler/${e.id}`)}`}>{t("public.login")}</ButtonLink>
            ) : null}
            {user && access && !access.role && e.status === "PUBLISHED" && user.universityId === e.universityId ? (
              <>
                <p className="text-(length:--type-body-sm) text-fg-secondary">{t("event.detail.joinClubFirst")}</p>
                <ButtonLink href={`/kulupler/${e.club.slug}`} variant="secondary">
                  {t("event.detail.joinClub")}
                </ButtonLink>
              </>
            ) : null}
          </Card>
        </aside>
      </div>
    </article>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-(--space-2) text-(length:--type-body-sm) text-fg">
      <span className="mt-(--space-0-5)">{icon}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export default function EventPage(props: PageProps<"/etkinlikler/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
