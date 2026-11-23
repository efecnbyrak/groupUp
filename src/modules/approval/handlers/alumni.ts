import "server-only";

import { z } from "zod";

import { activateManualAlumni } from "@/modules/identity";
import { assertAlumniCanSubmit, recordAlumniDecision, recordAlumniSubmission } from "@/modules/profile";

import { defineHandler } from "./types";

/** ALUMNI_VERIFY — belge zorunlu; onayda hesap ACTIVE + ALUMNI, retta kullanıcı yeniden yükleyebilir. */
export const alumniVerifyHandler = defineHandler({
  type: "ALUMNI_VERIFY",
  payloadSchema: z.object({}),
  requiresReason: false,
  requiresAttachment: true,
  targetOf: (_p, ctx) => ctx.actorId,
  async validateCreate(tx, ctx) {
    await assertAlumniCanSubmit(ctx.actorId, tx);
  },
  async afterCreate(tx, request) {
    await recordAlumniSubmission(tx, request.targetId, request.universityId, request.id);
  },
  async apply(tx, request) {
    await activateManualAlumni(tx, request.targetId);
    await recordAlumniDecision(tx, request.targetId, "APPROVED", null);
  },
  async onReject(tx, request, _p, reason) {
    await recordAlumniDecision(tx, request.targetId, "REJECTED", reason);
  },
  describe: () => [{ field: "accountStatus", before: "PENDING_ALUMNI_REVIEW", after: "ACTIVE" }],
});
