import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requirePageUser } from "@/app/_lib/page-user";
import { getClubAccess } from "@/lib/authz";
import { canOpenClubPanel, hasClubPermission, type ClubPermission } from "@/lib/club-roles";
import { findClubBySlug } from "@/modules/club";

/**
 * Kulüp paneli sayfa kapısı (istek başına bir kez): yalnızca Başkan ve görevliler; aksi 404.
 * `need` verilirse o yetki de aranır. Action'lar ayrıca `requireClubPermission` ile korunur.
 */
const load = cache(async (slug: string) => {
  const user = await requirePageUser(`/panel/kulup/${slug}`);
  const club = await findClubBySlug(slug);
  if (!club) notFound();
  const access = await getClubAccess(user, club.id);
  if (!access || !canOpenClubPanel(access)) notFound();
  const clubAccess = { ...access, isAdmin: false };
  return { user, club, access: clubAccess, can: (p: ClubPermission) => hasClubPermission(clubAccess, p) };
});

export async function requireClubPage(slug: string, need?: ClubPermission) {
  const ctx = await load(slug);
  if (need && !ctx.can(need)) notFound();
  return ctx;
}
