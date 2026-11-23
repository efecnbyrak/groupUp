import { LayoutDashboard } from "lucide-react";
import { Suspense } from "react";

import { ClubDirectory } from "@/app/_components/club-directory";
import { ClubGrid } from "@/app/_components/club-grid";
import { myClubs } from "@/app/_lib/club-nav";
import { titled } from "@/app/_lib/metadata";
import { requirePageUser } from "@/app/_lib/page-user";
import { Badge, ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";

export const generateMetadata = titled("nav.clubs");

/** Kulüpler: Kulüplerim (rolümle) + üniversitenin kulüp dizini. */
async function Content({ searchParams }: PageProps<"/kulupler">) {
  const [t, locale, sp, user] = await Promise.all([getT(), getLocale(), searchParams, requirePageUser("/kulupler")]);
  const mine = await myClubs(user.id);
  const roleOf = new Map(mine.map((m) => [m.club.id, m.role]));
  const managed = mine.filter((m) => m.role !== "MEMBER");
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-(--space-3)">
        <h1 className="text-(length:--type-heading-xl) font-semibold text-fg">{t("nav.clubs")}</h1>
        {managed.map(({ club }) => (
          <ButtonLink key={club.id} href={`/panel/kulup/${club.slug}`} variant="secondary" icon={<LayoutDashboard aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("nav.clubPanelOf", { club: club.name })}
          </ButtonLink>
        ))}
      </div>
      <section className="flex flex-col gap-(--space-4)" aria-labelledby="my-clubs">
        <h2 id="my-clubs" className="text-(length:--type-heading-md) font-semibold text-fg">
          {t("nav.myClubs")}
        </h2>
        {mine.length === 0 ? (
          <EmptyState title={t("nav.noClubs")} description={t("nav.noClubsHint")} />
        ) : (
          <ClubGrid
            clubs={mine.map((m) => m.club)}
            t={t}
            locale={locale}
            badgeFor={(id) => {
              const role = roleOf.get(id);
              return role ? <Badge tone={role === "MEMBER" ? "info" : "brand"}>{t(`club.roles.${role}`)}</Badge> : null;
            }}
          />
        )}
      </section>
      {user.universityId ? <ClubDirectory universityId={user.universityId} basePath="/kulupler" sp={sp} t={t} locale={locale} /> : null}
    </>
  );
}

export default function ClubsPage(props: PageProps<"/kulupler">) {
  return (
    <Suspense fallback={<Skeleton className="h-(--space-32)" />}>
      <Content {...props} />
    </Suspense>
  );
}
