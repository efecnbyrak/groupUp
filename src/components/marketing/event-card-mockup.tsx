import { CalendarDays, Hourglass, MapPin, Trophy, Users } from "lucide-react";

import { Badge } from "@/components/ui";
import type { Translate } from "@/i18n/messages";

/**
 * Hero mockup'ı: DESIGN §7 etkinlik kartı anatomisinin statik HTML/CSS çizimi
 * (gerçek EventCard F6'da). Kapak görseli yerine düz renk alanı + çizgi illüstrasyon.
 */
export function EventCardMockup({ t }: { t: Translate }) {
  const row = "flex items-center gap-(--space-2) text-(length:--type-body-sm) text-fg-secondary";
  const ic = "size-(--icon-size-sm) shrink-0";
  return (
    <div aria-hidden="true" className="w-full overflow-hidden rounded-card border border-line bg-card shadow-(--elevation-lg)">
      <div className="relative flex aspect-video items-center justify-center bg-brand-subtle">
        <svg viewBox="0 0 120 68" className="h-3/5 text-brand">
          <rect x="6" y="6" width="108" height="56" rx="3" className="fill-none stroke-current" strokeWidth="2" />
          <line x1="60" y1="6" x2="60" y2="62" className="stroke-current" strokeWidth="2" />
          <circle cx="60" cy="34" r="10" className="fill-none stroke-current" strokeWidth="2" />
          <rect x="6" y="22" width="14" height="24" className="fill-none stroke-current" strokeWidth="2" />
          <rect x="100" y="22" width="14" height="24" className="fill-none stroke-current" strokeWidth="2" />
        </svg>
        <Badge tone="brand" className="absolute top-(--space-3) right-(--space-3) bg-card">
          <Trophy className="size-(--icon-size-sm)" />
          {t("landing.mockup.category")}
        </Badge>
      </div>
      <div className="flex flex-col gap-(--space-2) p-(--space-4)">
        <p className="flex items-center gap-(--space-2) text-(length:--type-caption) font-semibold text-fg-secondary">
          <span className="inline-flex size-(--space-5) items-center justify-center rounded-full bg-brand text-(length:--font-size-2xs) text-on-brand">S</span>
          {t("landing.mockup.club")}
        </p>
        <p className="text-(length:--type-heading-sm) font-semibold text-fg">{t("landing.mockup.title")}</p>
        <p className={row}>
          <CalendarDays className={ic} />
          {t("landing.mockup.date")}
        </p>
        <p className={row}>
          <MapPin className={ic} />
          {t("landing.mockup.place")}
        </p>
        <div className={row}>
          <Users className={ic} />
          <span>{t("landing.mockup.team")}</span>
          <span className="ml-auto flex items-center gap-(--space-2)">
            <span className="h-(--space-1-5) w-(--space-16) overflow-hidden rounded-full bg-muted">
              <span className="block h-full w-3/4 rounded-full bg-brand" />
            </span>
            <span className="tabular-nums">{t("landing.mockup.capacity")}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-(--space-2)">
          <p className={row}>
            <Hourglass className={ic} />
            {t("landing.mockup.deadline")}
          </p>
          <Badge tone="success">{t("landing.mockup.open")}</Badge>
        </div>
        <span className="mt-(--space-1) inline-flex h-(--control-height-md) items-center justify-center rounded-control bg-brand font-semibold text-on-brand">
          {t("landing.mockup.apply")}
        </span>
      </div>
    </div>
  );
}
