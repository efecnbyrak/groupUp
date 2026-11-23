import "server-only";

import { cache } from "react";

import type { HeaderClub, PanelLink } from "@/components/shell";
import type { Translate } from "@/i18n/messages";
import type { SessionUser } from "@/lib/authz";
import { publicFileUrl } from "@/lib/storage";
import { listMyClubs } from "@/modules/club";

/** Kullanıcının kulüpleri (istek başına bir kez): header menüsü + avatar menüsündeki kulüp panelleri. */
export const myClubs = cache((userId: string) => listMyClubs(userId));

export async function clubNav(user: SessionUser, t: Translate): Promise<{ clubs: HeaderClub[]; panels: PanelLink[] }> {
  const rows = await myClubs(user.id);
  const clubs = rows.map(({ club, role }) => ({
    href: `/kulupler/${club.slug}`,
    name: club.name,
    logoUrl: publicFileUrl(club.logoKey),
    roleLabel: t(`club.roles.${role}`),
    presidentLabel: t("club.presidentName", { name: club.presidentName }),
  }));
  const panels = rows
    .filter((r) => r.role !== "MEMBER")
    .map(({ club }) => ({ href: `/panel/kulup/${club.slug}`, label: t("nav.clubPanelOf", { club: club.name }) }));
  return { clubs, panels };
}
