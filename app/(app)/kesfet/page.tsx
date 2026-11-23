import { Suspense } from "react";

import { ClubDirectory } from "@/app/_components/club-directory";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

export const generateMetadata = titled("nav.explore");

/** Keşfet: kendi üniversitesinin kulüpleri (etkinlikler F6). */
async function Content({ searchParams }: PageProps<"/kesfet">) {
  const [t, locale, sp, user] = await Promise.all([getT(), getLocale(), searchParams, requirePageUser("/kesfet")]);
  return (
    <>
      <div className="flex flex-col gap-(--space-1)">
        <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("nav.explore")}</h1>
        <p className="text-fg-secondary">{t("club.directory.exploreBody")}</p>
      </div>
      {user.universityId ? <ClubDirectory universityId={user.universityId} basePath="/kesfet" sp={sp} t={t} locale={locale} /> : null}
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
