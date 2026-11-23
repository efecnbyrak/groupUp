import { CalendarDays, Clock, MapPin, User, Users, Video } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "./avatar";
import { Badge, type BadgeTone } from "./badge";
import { cn } from "./cn";

/**
 * Etkinlik kartı (EVENTS-FORMS-I18N §8): kapak 16:9, kulüp, kategori, başlık, tarih, konum,
 * kontenjan çubuğu, başvuru rozeti, deadline geri sayımı, bireysel/takım ikonu. Tüm kart tek bağlantı.
 * Metinler çağırandan çevrilmiş gelir.
 */
export function EventCard({
  href,
  title,
  coverUrl,
  clubName,
  clubLogoUrl,
  category,
  dateLabel,
  location,
  online,
  team,
  modeLabel,
  status,
  countdown,
  capacity,
  extra,
}: {
  href: string;
  title: string;
  coverUrl: string | null;
  clubName: string;
  clubLogoUrl: string | null;
  category: string;
  dateLabel: string;
  location: string;
  online: boolean;
  team: boolean;
  modeLabel: string;
  status?: { label: string; tone: BadgeTone };
  countdown?: string;
  capacity?: { taken: number; total: number; label: string };
  extra?: ReactNode;
}) {
  const icon = "size-(--icon-size-sm) shrink-0";
  const pct = capacity ? Math.min(100, Math.round((capacity.taken / Math.max(1, capacity.total)) * 100)) : 0;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-card transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)"
    >
      <div className="relative">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- kapak sharp ile 400×225 WebP hazırlanır
          <img src={coverUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="aspect-video w-full bg-brand-subtle" />
        )}
        {status ? (
          <Badge tone={status.tone} className="absolute top-(--space-2) left-(--space-2) shadow-(--elevation-sm)">
            {status.label}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-(--space-2) p-(--space-4)">
        <div className="flex min-w-0 items-center gap-(--space-2)">
          <Avatar name={clubName} src={clubLogoUrl} size="sm" shape="square" />
          <span className="truncate text-(length:--type-caption) font-semibold text-fg-secondary">{clubName}</span>
          <Badge tone="neutral" className="ml-auto">
            {category}
          </Badge>
        </div>
        <h3 className="line-clamp-2 text-(length:--type-body) font-semibold break-words text-fg group-hover:text-brand">{title}</h3>
        <ul className="flex flex-col gap-(--space-1) text-(length:--type-body-sm) text-fg-secondary">
          <li className="flex items-center gap-(--space-2)">
            <CalendarDays aria-hidden="true" className={icon} />
            <span className="min-w-0 truncate">{dateLabel}</span>
          </li>
          <li className="flex items-center gap-(--space-2)">
            {online ? <Video aria-hidden="true" className={icon} /> : <MapPin aria-hidden="true" className={icon} />}
            <span className="min-w-0 truncate">{location}</span>
          </li>
          <li className="flex items-center gap-(--space-2)">
            {team ? <Users aria-hidden="true" className={icon} /> : <User aria-hidden="true" className={icon} />}
            <span>{modeLabel}</span>
          </li>
        </ul>
        <div className="mt-auto flex flex-col gap-(--space-2) pt-(--space-2)">
          {capacity ? (
            <div className="flex flex-col gap-(--space-1)">
              <div className="h-(--space-1) w-full overflow-hidden rounded-badge bg-muted" role="presentation">
                <div className={cn("h-full rounded-badge", pct >= 100 ? "bg-negative-fill" : "bg-brand")} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-(length:--type-caption) text-fg-secondary">{capacity.label}</span>
            </div>
          ) : null}
          {countdown ? (
            <p className="flex items-center gap-(--space-1) text-(length:--type-caption) font-semibold text-caution">
              <Clock aria-hidden="true" className="size-(--icon-size-sm)" />
              {countdown}
            </p>
          ) : null}
          {extra}
        </div>
      </div>
    </Link>
  );
}
