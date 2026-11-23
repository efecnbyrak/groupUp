import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/authz";

/** Sayfa kapısı: oturum yoksa girişe, aktif değilse doğrulamaya yönlendirir. */
export async function requirePageUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(next)}`);
  if (!user.emailVerified) redirect("/dogrula");
  if (user.status !== "ACTIVE") redirect("/giris");
  return user;
}
