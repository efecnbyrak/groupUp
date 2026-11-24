import { connection } from "next/server";

import { requireUser, UnauthorizedError } from "@/lib/authz";
import { exportOwnData } from "@/modules/profile";

/** KVKK veri dışa aktarma: "Profil → JSON indir" (AUTH-EMAIL §Hesap, ARCHITECTURE §8). */
export async function GET() {
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (err) {
    if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
    throw err;
  }

  const data = await exportOwnData(userId);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="groupup-verilerim.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
