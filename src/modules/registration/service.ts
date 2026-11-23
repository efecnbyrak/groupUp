import "server-only";

import { ServiceError } from "@/lib/errors";

export type RegistrationErrorCode =
  | "NOT_FOUND"
  | "NOT_EDITABLE"
  | "FIELD_IN_USE"
  | "NOT_CLUB_MEMBER"
  | "NOT_ELIGIBLE"
  | "REGISTRATION_CLOSED"
  | "ALREADY_APPLIED"
  | "FULL"
  | "WRONG_MODE"
  | "INVALID_ANSWERS"
  | "CODE_INVALID"
  | "TEAM_FULL"
  | "TEAM_TOO_SMALL"
  | "NOT_CAPTAIN"
  | "CANNOT_REMOVE_CAPTAIN"
  | "FILE_INVALID"
  | "FILE_TYPE"
  | "FILE_TOO_LARGE";

export const fail = (code: RegistrationErrorCode, fields?: Record<string, string>) => new ServiceError(code, fields);
