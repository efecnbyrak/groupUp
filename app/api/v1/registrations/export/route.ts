import { connection } from "next/server";

import { ForbiddenError, requireClubPermission, UnauthorizedError } from "@/lib/authz";
import { buildExportRows, toCsv, toXlsx } from "@/modules/registration";

/** Başvuru yönetim tablosu dışa aktarımı (xlsx/csv) — REGISTRATION_VIEW yetkisi. */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const clubId = url.searchParams.get("clubId") ?? "";
  const eventId = url.searchParams.get("eventId") ?? "";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  if (!clubId || !eventId) return new Response(null, { status: 400 });

  try {
    await requireClubPermission(clubId, "REGISTRATION_VIEW", { allowAdmin: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return new Response(null, { status: 401 });
    if (err instanceof ForbiddenError) return new Response(null, { status: 403 });
    throw err;
  }

  const { columns, rows } = await buildExportRows(eventId);
  const filename = `basvurular-${eventId}.${format}`;

  if (format === "csv") {
    return new Response(toCsv(columns, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const buf = await toXlsx(columns, rows, "Başvurular");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
