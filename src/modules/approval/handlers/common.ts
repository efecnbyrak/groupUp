import "server-only";

import type { Tx } from "@/lib/db";
import { ServiceError } from "@/lib/errors";

import type { CreateContext } from "./types";

export type ApprovalErrorCode =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "REASON_REQUIRED"
  | "ATTACHMENT_REQUIRED"
  | "NO_CHANGES"
  | "NOT_OWNER"
  | "WRONG_CLUB"
  | "STAFF_LIMIT";

export const approvalError = (code: ApprovalErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);

/** Kulüp talepleri: kulüp bağlamı zorunlu ve kulüp bu üniversitede. */
export async function requireClubContext(tx: Tx, ctx: CreateContext): Promise<string> {
  if (!ctx.clubId) throw approvalError("WRONG_CLUB");
  const club = await tx.club.findFirst({ where: { id: ctx.clubId, universityId: ctx.universityId, deletedAt: null }, select: { id: true } });
  if (!club) throw approvalError("WRONG_CLUB");
  return club.id;
}

export function clubIdOf(request: { clubId: string | null }): string {
  if (!request.clubId) throw approvalError("WRONG_CLUB");
  return request.clubId;
}
