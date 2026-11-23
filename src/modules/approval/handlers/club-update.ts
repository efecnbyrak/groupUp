import "server-only";

import { z } from "zod";

import { applyClubUpdate, CLUB_INFO_FIELDS, getClubInfo } from "@/modules/club";

import { diffFields } from "../domain/diff";
import { approvalError, clubIdOf, requireClubContext } from "./common";
import { defineHandler } from "./types";

const info = z
  .object({
    shortDescTr: z.string().max(200),
    description: z.string().max(2000).nullable(),
    contactEmail: z.string().max(200).nullable(),
    instagram: z.string().max(30).nullable(),
    logoKey: z.string().max(200).nullable(),
    coverKey: z.string().max(200).nullable(),
  })
  .partial();

/** CLUB_UPDATE — `{before, after}` yalnızca değişen alanlar (ad hariç). */
export const clubUpdateHandler = defineHandler({
  type: "CLUB_UPDATE",
  payloadSchema: z.object({ before: info, after: info }),
  requiresReason: false,
  requiresAttachment: false,
  targetOf: (_p, ctx) => ctx.clubId ?? "",
  async validateCreate(tx, ctx, payload) {
    await requireClubContext(tx, ctx);
    if (Object.keys(payload.after).length === 0) throw approvalError("NO_CHANGES");
  },
  async apply(tx, request, payload) {
    await applyClubUpdate(tx, clubIdOf(request), payload.after);
  },
  describe: (payload) => diffFields(payload.before, payload.after, CLUB_INFO_FIELDS),
});

/** "before" anlık görüntüsü (talep oluştururken). */
export { getClubInfo };
