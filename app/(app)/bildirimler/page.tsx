import { BellOff } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { PageHeader } from "@/components/shell";
import { EmptyState, Pagination, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { listNotifications } from "@/modules/notification";

export const generateMetadata = titled("notifications.title");

/** Bildirimler sayfası (F10): tüm bildirimler, cursor pagination (CLAUDE.md §6). */
async function Content({ searchParams }: PageProps<"/bildirimler">) {
  const user = await requirePageUser("/bildirimler");
  await connection();
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams]);
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const { items, nextCursor } = await listNotifications(user.id, cursor);

  return (
    <>
      <PageHeader title={t("notifications.title")} />
      {items.length === 0 ? (
        <EmptyState icon={<BellOff aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("notifications.empty")} description={t("notifications.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-(--space-2)">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href ?? "#"}
                className={`flex items-start gap-(--space-3) rounded-card border border-line p-(--space-4) transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus) ${n.readAt ? "bg-card" : "bg-(--color-primary-subtle)"}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-(--space-1)">
                  <span className="font-semibold text-fg">{locale === "en" ? n.titleEn : n.titleTr}</span>
                  {(locale === "en" ? n.bodyEn : n.bodyTr) ? <span className="text-(length:--type-body-sm) text-fg-secondary">{locale === "en" ? n.bodyEn : n.bodyTr}</span> : null}
                  <span className="text-(length:--type-caption) text-fg-tertiary">{formatDateTime(n.createdAt, locale)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        firstHref={cursor ? "/bildirimler" : undefined}
        nextHref={nextCursor ? `/bildirimler?sonraki=${nextCursor}` : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </>
  );
}

export default function NotificationsPage(props: PageProps<"/bildirimler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
