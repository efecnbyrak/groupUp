import { Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "./avatar";
import { Badge } from "./badge";

/**
 * Kulüp kartı (DESIGN §6): logo, ad, kategori, kısa açıklama, üye sayısı. Tüm kart tek bağlantı.
 * Metinler çağırandan çevrilmiş gelir.
 */
export function ClubCard({
  href,
  name,
  category,
  description,
  logoUrl,
  memberLabel,
  badge,
}: {
  href: string;
  name: string;
  category: string;
  description: string;
  logoUrl: string | null;
  memberLabel: string;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-(--space-3) rounded-card border border-line bg-card p-(--space-4) transition-shadow duration-(--duration-fast) hover:shadow-(--elevation-md) focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-offset-(--focus-ring-offset) focus-visible:outline-(--color-focus)"
    >
      <div className="flex items-start gap-(--space-3)">
        <Avatar name={name} src={logoUrl} size="lg" shape="square" />
        <div className="flex min-w-0 flex-1 flex-col gap-(--space-1)">
          <h3 className="line-clamp-2 text-(length:--type-body) font-semibold break-words text-fg group-hover:text-brand">{name}</h3>
          <div className="flex flex-wrap items-center gap-(--space-1)">
            <Badge tone="neutral">{category}</Badge>
            {badge}
          </div>
        </div>
      </div>
      <p className="line-clamp-3 flex-1 text-(length:--type-body-sm) text-fg-secondary">{description}</p>
      <p className="flex items-center gap-(--space-1) text-(length:--type-caption) text-fg-secondary">
        <Users aria-hidden="true" className="size-(--icon-size-sm)" />
        {memberLabel}
      </p>
    </Link>
  );
}
