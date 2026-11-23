import { ClubCard } from "@/components/ui";
import type { Translate } from "@/i18n/messages";
import { publicFileUrl } from "@/lib/storage";
import type { ClubCardData } from "@/modules/club";

/** Kulüp kartları ızgarası (Keşfet, /kulupler). EN açıklama yoksa TR'ye düşer. */
export function ClubGrid({ clubs, t, locale, badgeFor }: { clubs: ClubCardData[]; t: Translate; locale: string; badgeFor?: (id: string) => React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-(--space-4) sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((c) => (
        <li key={c.id}>
          <ClubCard
            href={`/kulupler/${c.slug}`}
            name={c.name}
            category={locale === "en" ? c.category.nameEn : c.category.nameTr}
            description={(locale === "en" && c.shortDescEn) || c.shortDescTr}
            logoUrl={publicFileUrl(c.logoKey)}
            memberLabel={t("club.memberCount", { count: c._count.memberships })}
            badge={badgeFor?.(c.id)}
          />
        </li>
      ))}
    </ul>
  );
}
