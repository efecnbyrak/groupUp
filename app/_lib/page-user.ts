import "server-only";

import { redirect } from "next/navigation";

import type { Translate } from "@/i18n/messages";
import { getSessionUser, type SessionUser } from "@/lib/authz";

/** Sayfa kapısı: oturum yoksa girişe, aktif değilse doğrulamaya yönlendirir. */
export async function requirePageUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(next)}`);
  if (!user.emailVerified) redirect("/dogrula");
  if (user.status !== "ACTIVE") redirect("/giris");
  return user;
}

/** Header'da gösterilecek ad ve rol etiketi. */
export function displayUser(user: SessionUser, t: Translate): { name: string; email: string; roleLabel: string } {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const roleLabel =
    user.platformRole === "SUPER_ADMIN" ? t("nav.roles.platform") : user.type === "ALUMNI" ? t("nav.roles.alumni") : t("nav.roles.student");
  return { name, email: user.email, roleLabel };
}
