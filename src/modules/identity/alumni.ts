import "server-only";

import type { Tx } from "@/lib/db";

/** Manuel mezun onayı: hesap açılır (User identity modülüne ait; approval handler'ı çağırır). */
export async function activateManualAlumni(tx: Tx, userId: string): Promise<void> {
  const { count } = await tx.user.updateMany({ where: { id: userId, status: "PENDING_ALUMNI_REVIEW" }, data: { status: "ACTIVE", type: "ALUMNI" } });
  if (count === 0) throw new Error("Kullanıcı mezun onayı beklemiyor");
}

/** Bildirim maili için alıcı bilgisi. */
export async function getMailRecipient(tx: Pick<Tx, "user">, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, deletedAt: true, profile: { select: { firstName: true } } } });
  if (!user || user.deletedAt) return null;
  return { email: user.email, locale: user.locale, name: user.profile?.firstName || user.email };
}
