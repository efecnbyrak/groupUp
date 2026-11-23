import { Compass, Search } from "lucide-react";
import Link from "next/link";

import { ClubGrid } from "@/app/_components/club-grid";
import { Button, Card, EmptyState, Input, Pagination, cn } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { listCategoriesWithCounts, listClubs } from "@/modules/club";

/** Üniversitenin kulüp dizini: arama + kategori çipleri + cursor sayfalama (Keşfet yalnızca kendi üniversitesi). */
export async function ClubDirectory({ universityId, basePath, sp, t, locale }: { universityId: string; basePath: string; sp: Record<string, string | string[] | undefined>; t: Translate; locale: string }) {
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const kategori = typeof sp.kategori === "string" ? sp.kategori.slice(0, 80) : undefined;
  const cursor = typeof sp.sonraki === "string" ? sp.sonraki.slice(0, 40) : undefined;
  const categories = (await listCategoriesWithCounts(universityId)).filter((c) => c._count.clubs > 0);
  const category = categories.find((c) => c.slug === kategori);
  const { items, nextCursor } = await listClubs(universityId, { q, categoryId: category?.id, cursor });
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, kategori: category?.slug, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-(--touch-target-min) items-center rounded-badge border px-(--space-3) text-(length:--type-body-sm) font-semibold whitespace-nowrap",
      active ? "border-brand bg-brand-subtle text-brand-active" : "border-line bg-card text-fg-secondary hover:text-fg",
    );

  return (
    <section className="flex flex-col gap-(--space-4)" aria-labelledby="club-directory">
      <h2 id="club-directory" className="text-(length:--type-heading-md) font-semibold text-fg">
        {t("club.directory.title")}
      </h2>
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3) sm:flex-row sm:items-end">
          {category ? <input type="hidden" name="kategori" value={category.slug} /> : null}
          <div className="sm:flex-1">
            <Input id="q" name="q" type="search" label={t("club.directory.search")} placeholder={t("club.directory.searchPlaceholder")} defaultValue={q} />
          </div>
          <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
            {t("admin.users.filter")}
          </Button>
        </form>
      </Card>
      {categories.length > 1 ? (
        <nav aria-label={t("club.directory.categories")} className="-mx-(--gutter) overflow-x-auto px-(--gutter)">
          <ul className="flex gap-(--space-2) pb-(--space-1)">
            <li>
              <Link href={href({ kategori: undefined, sonraki: undefined })} aria-current={!category ? "page" : undefined} className={chip(!category)}>
                {t("club.directory.all")}
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={href({ kategori: c.slug, sonraki: undefined })} aria-current={category?.id === c.id ? "page" : undefined} className={chip(category?.id === c.id)}>
                  {locale === "en" ? c.nameEn : c.nameTr} ({c._count.clubs})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {items.length === 0 ? (
        <EmptyState icon={<Compass aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("club.directory.empty")} description={t("club.directory.emptyBody")} />
      ) : (
        <ClubGrid clubs={items} t={t} locale={locale} />
      )}
      <Pagination
        firstHref={cursor ? href({ sonraki: undefined }) : undefined}
        nextHref={nextCursor ? href({ sonraki: nextCursor }) : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </section>
  );
}
