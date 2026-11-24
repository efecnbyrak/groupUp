import { isValidCronRequest } from "@/lib/cron";
import { completePastEvents, retryPendingEventTranslations } from "@/modules/event";
import { cleanupDeletedUserAttachments, cleanupExpiredSessions } from "@/modules/identity";

/** F10 günlük cron (DEPLOYMENT §Cron): çeviri tekrar denemesi, COMPLETED geçişi, temizlik. `CRON_SECRET` ile korunur. */
export async function GET(req: Request) {
  if (!isValidCronRequest(req)) return new Response(null, { status: 401 });
  const [translated, completedEvents, { sessions, tokens }, deletedAttachments] = await Promise.all([
    retryPendingEventTranslations(),
    completePastEvents(),
    cleanupExpiredSessions(),
    cleanupDeletedUserAttachments(),
  ]);
  return Response.json({ translated, completedEvents, expiredSessions: sessions, expiredTokens: tokens, deletedAttachments });
}
