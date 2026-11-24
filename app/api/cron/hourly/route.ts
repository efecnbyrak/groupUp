import { isValidCronRequest } from "@/lib/cron";
import { sendDeadlineReminders, sendEventReminders } from "@/modules/registration";

/** F10 saatlik cron (DEPLOYMENT §Cron): hatırlatmalar. `CRON_SECRET` ile korunur. */
export async function GET(req: Request) {
  if (!isValidCronRequest(req)) return new Response(null, { status: 401 });
  const [deadlineReminders, eventReminders] = await Promise.all([sendDeadlineReminders(), sendEventReminders()]);
  return Response.json({ deadlineReminders, eventReminders });
}
