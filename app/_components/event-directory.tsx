import { CalendarSearch, Search } from "lucide-react";
import Link from "next/link";

import { EventGrid } from "@/app/_components/events";
import { Button, Card, Checkbox, EmptyState, Input, Pagination, cn } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { fromIstanbulLocalInput } from "@/lib/dates";
import { listEventCategoryTree, listExploreEvents } from "@/modules/event";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Keşfet → Etkinlikler (§8): arama, üst kategori çipleri, tarih aralığı, "başvurusu açık". */
export async function EventDirectory({ universityId, basePath, sp, t, locale, now }: { universityId: string; basePath: string; sp: SP; t: Translate; locale: string; now: Date }) {
  const q = str(sp.q, 100);
  const kategori = str(sp.kategori, 80);
  const cursor = str(sp.sonraki, 40);
  const openOnly = sp.acik === "1";
  const from = str(sp.baslangic, 10);
  const to = str(sp.bitis, 10);
  const tree = await listEventCategoryTree();
  const category = tree.find((c) => c.slug === kategori);
  const { items, nextCursor } = await listExploreEvents(universityId, now, {
    q,
    categoryId: category?.id,
    openOnly,
    from: from ? (fromIstanbulLocalInput(`${from}T00:00`) ?? undefined) : undefined,
    to: to ? (fromIstanbulLocalInput(`${to}T23:59`) ?? undefined) : undefined,
    cursor,
  });
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ sekme: "etkinlikler", q, kategori: category?.slug, acik: openOnly ? "1" : undefined, baslangic: from, bitis: to, ...extra })) if (v) p.set(k, v);
    return `${basePath}?${p.toString()}`;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-(--touch-target-min) items-center rounded-badge border px-(--space-3) text-(length:--type-body-sm) font-semibold whitespace-nowrap",
      active ? "border-brand bg-brand-subtle text-brand-active" : "border-line bg-card text-fg-secondary hover:text-fg",
    );
  return (
    <section className="flex flex-col gap-(--space-4)" aria-labelledby="event-directory">
      <h2 id="event-directory" className="sr-only">
        {t("explore.events")}
      </h2>
      <Card padding="sm">
        <form method="get" role="search" className="flex flex-col gap-(--space-3)">
          <input type="hidden" name="sekme" value="etkinlikler" />
          {category ? <input type="hidden" name="kategori" value={category.slug} /> : null}
          <div className="grid gap-(--space-3) sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="sm:col-span-2">
              <Input id="eq" name="q" type="search" label={t("explore.search")} placeholder={t("explore.searchPlaceholder")} defaultValue={q} />
            </div>
            <Input id="ebas" name="baslangic" type="date" label={t("explore.from")} defaultValue={from} />
            <Input id="ebit" name="bitis" type="date" label={t("explore.to")} defaultValue={to} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-(--space-3)">
            <Checkbox id="eacik" name="acik" value="1" label={t("explore.openOnly")} defaultChecked={openOnly} />
            <Button type="submit" variant="secondary" icon={<Search aria-hidden="true" className="size-(--icon-size-sm)" />}>
              {t("admin.users.filter")}
            </Button>
          </div>
        </form>
      </Card>
      <nav aria-label={t("club.directory.categories")} className="-mx-(--gutter) overflow-x-auto px-(--gutter)">
        <ul className="flex gap-(--space-2) pb-(--space-1)">
          <li>
            <Link href={href({ kategori: undefined, sonraki: undefined })} aria-current={!category ? "page" : undefined} className={chip(!category)}>
              {t("club.directory.all")}
            </Link>
          </li>
          {tree.map((c) => (
            <li key={c.id}>
              <Link href={href({ kategori: c.slug, sonraki: undefined })} aria-current={category?.id === c.id ? "page" : undefined} className={chip(category?.id === c.id)}>
                {locale === "en" ? c.nameEn : c.nameTr}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <EmptyState icon={<CalendarSearch aria-hidden="true" className="size-(--icon-size-lg)" />} title={t("explore.emptyEvents")} description={t("explore.emptyEventsBody")} />
      ) : (
        <EventGrid events={items} t={t} locale={locale} now={now} />
      )}
      <Pagination
        firstHref={cursor ? href({ sonraki: undefined }) : undefined}
        nextHref={nextCursor ? href({ sonraki: nextCursor }) : undefined}
        labels={{ label: t("common.pagination"), first: t("common.firstPage"), next: t("common.nextPage") }}
      />
    </section>
  );
}
