import { connection } from "next/server";
import { Suspense } from "react";

import { ClubDirectory } from "@/app/_components/club-directory";
import { EventDirectory } from "@/app/_components/event-directory";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import Link from "next/link";

import { Skeleton, cn } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

export const generateMetadata = titled("nav.explore");

/** Keşfet (§8): kendi üniversitesinin yayındaki etkinlikleri ve kulüpleri. */
async function Content({ searchParams }: PageProps<"/kesfet">) {
  const [t, locale, sp, user] = await Promise.all([getT(), getLocale(), searchParams, requirePageUser("/kesfet")]);
  await connection();
  const tab = sp.sekme === "kulupler" ? "kulupler" : "etkinlikler";
  return (
    <>
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("nav.explore")}</h1>
        <p className="text-fg-secondary">{t("explore.body")}</p>
      </div>
      <nav aria-label={t("nav.explore")} className="flex gap-(--space-1) overflow-x-auto border-b border-line">
        {(
          [
            ["etkinlikler", t("explore.events")],
            ["kulupler", t("explore.clubs")],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/kesfet?sekme=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-(--border-width) inline-flex min-h-(--touch-target-min) items-center border-b-(length:--border-width-strong) px-(--space-4) text-(length:--type-body-sm) font-semibold whitespace-nowrap",
              tab === key ? "border-brand text-fg" : "border-transparent text-fg-secondary hover:text-fg",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {user.universityId ? (
        tab === "kulupler" ? (
          <ClubDirectory universityId={user.universityId} basePath="/kesfet" sp={sp} t={t} locale={locale} />
        ) : (
          <EventDirectory universityId={user.universityId} basePath="/kesfet" sp={sp} t={t} locale={locale} now={new Date()} />
        )
      ) : null}
    </>
  );
}

export default function ExplorePage(props: PageProps<"/kesfet">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
