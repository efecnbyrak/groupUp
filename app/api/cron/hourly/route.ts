import { isValidCronRequest } from "@/lib/cron";
import { submitRequest } from "@/modules/approval";
import { markResultPending, stageClosedResults, syncElectionTimeStatus } from "@/modules/election";
import { sendDeadlineReminders, sendEventReminders } from "@/modules/registration";

/**
 * F11: zaman tabanlı seçim geçişleri + CLOSED seçimlerin oy sayımını ELECTION_RESULT talebine
 * dönüştürme. Burada yapılır (app katmanı) çünkü election → approval bağımlılığı yok (ADR-0007
 * yönü approval → election); her iki modülü de yalnızca bu route import eder.
 */
async function syncElections(): Promise<{ transitioned: number; resultsSubmitted: number }> {
  const transitioned = await syncElectionTimeStatus();
  const staged = await stageClosedResults();
  for (const s of staged) {
    await submitRequest({ id: s.createdById }, {
      type: "ELECTION_RESULT",
      universityId: s.universityId,
      clubId: s.clubId,
      payload: { electionId: s.electionId, winnerUserId: s.winnerUserId, tie: s.tie, counts: s.counts, totalBallots: s.totalBallots },
    });
    await markResultPending(s.electionId);
  }
  return { transitioned, resultsSubmitted: staged.length };
}

/** F10 saatlik cron (DEPLOYMENT §Cron): hatırlatmalar + F11 seçim geçişleri. `CRON_SECRET` ile korunur. */
export async function GET(req: Request) {
  if (!isValidCronRequest(req)) return new Response(null, { status: 401 });
  const [deadlineReminders, eventReminders, elections] = await Promise.all([sendDeadlineReminders(), sendEventReminders(), syncElections()]);
  return Response.json({ deadlineReminders, eventReminders, elections });
}
