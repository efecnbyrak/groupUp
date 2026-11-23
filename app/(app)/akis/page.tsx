import { CalendarClock, Compass, Megaphone } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { EventGrid } from "@/app/_components/events";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Alert, Avatar, ButtonLink, Card, EmptyState, RichText, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { renderRichText } from "@/lib/rich-text/sanitize";
import { publicFileUrl } from "@/lib/storage";
import { listFeedAnnouncements, listFeedEvents, pick, registrationState } from "@/modules/event";

export const generateMetadata = titled("nav.home");

/** Ana sayfa (§8): kulüplerimin etkinlikleri (açık + deadline yakın önce), son duyurular. */
async function Content() {
  const user = await requirePageUser("/akis");
  await connection();
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const now = new Date();
  const [events, announcements] = await Promise.all([user.universityId ? listFeedEvents(user.id, user.universityId, now) : [], listFeedAnnouncements(user.id)]);
  const soon = events.filter((e) => registrationState(e, now) === "CLOSING_SOON").length;
  return (
    <>
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("feed.title")}</h1>
        <p className="text-fg-secondary">{t("feed.body")}</p>
      </div>
      {soon > 0 ? (
        <Alert tone="warning">
          <span className="inline-flex items-center gap-(--space-2) font-semibold">
            <CalendarClock aria-hidden="true" className="size-(--icon-size-sm)" />
            {t("feed.deadlineSoon", { count: soon })}
          </span>
        </Alert>
      ) : null}
      <section aria-labelledby="feed-events" className="flex flex-col gap-(--space-4)">
        <h2 id="feed-events" className="text-(length:--type-heading-md) font-semibold text-fg">
          {t("feed.events")}
        </h2>
        {events.length ? (
          <EventGrid events={events} t={t} locale={locale} now={now} />
        ) : (
          <EmptyState
            icon={<Compass aria-hidden="true" className="size-(--icon-size-lg)" />}
            title={t("feed.empty")}
            description={t("feed.emptyBody")}
            action={<ButtonLink href="/kesfet">{t("nav.explore")}</ButtonLink>}
          />
        )}
      </section>
      {announcements.length ? (
        <section aria-labelledby="feed-ann" className="flex flex-col gap-(--space-4)">
          <h2 id="feed-ann" className="flex items-center gap-(--space-2) text-(length:--type-heading-md) font-semibold text-fg">
            <Megaphone aria-hidden="true" className="size-(--icon-size-md)" />
            {t("feed.announcements")}
          </h2>
          <ul className="flex flex-col gap-(--space-3)">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-col gap-(--space-2)">
                  <Link href={`/kulupler/${a.club.slug}`} className="inline-flex min-w-0 items-center gap-(--space-2) text-(length:--type-caption) font-semibold text-fg-secondary hover:underline">
                    <Avatar name={a.club.name} src={publicFileUrl(a.club.logoKey)} size="sm" shape="square" />
                    <span className="truncate">{a.club.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-normal">{formatDateTime(a.createdAt, locale)}</span>
                  </Link>
                  <h3 className="font-semibold break-words text-fg">{pick(locale, a.titleTr, a.titleEn)}</h3>
                  <RichText sanitizedHtml={renderRichText(pick(locale, a.bodyTr, a.bodyEn))} className="text-(length:--type-body-sm) text-fg-secondary" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content />
    </Suspense>
  );
}
