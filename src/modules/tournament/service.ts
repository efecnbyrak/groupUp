import "server-only";

import { ServiceError } from "@/lib/errors";

export type TournamentErrorCode =
  | "NOT_FOUND"
  | "NOT_EDITABLE"
  | "NO_PARTICIPANTS"
  | "TOO_FEW_PARTICIPANTS"
  | "ALREADY_SEEDED"
  | "NOT_SEEDED"
  | "GROUPS_NOT_DONE"
  | "STAGE_EXISTS"
  | "MATCH_NOT_FOUND"
  | "MATCH_NOT_EDITABLE"
  | "DOWNSTREAM_PLAYED"
  | "INVALID_SCORE"
  | "DUPLICATE_NAME";

export const fail = (code: TournamentErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);
