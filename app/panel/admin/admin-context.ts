import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { requirePageUser } from "@/app/_lib/page-user";
import { getAdminUniversity } from "@/modules/university";

/**
 * Admin paneli sayfa kapısı (istek başına bir kez): kullanıcının Admin olduğu üniversite.
 * Admin değilse 404; Süper Admin ise Platform paneline yönlenir (orada kendini atayabilir).
 * Action'lar ayrıca `requireUniversityAdmin(universityId)` ile korunur.
 */
export const requireAdminPage = cache(async () => {
  const user = await requirePageUser("/panel/admin");
  const university = await getAdminUniversity(user.id);
  if (!university) {
    if (user.platformRole === "SUPER_ADMIN") redirect("/panel/platform");
    notFound();
  }
  return { user, university };
});
