import type { MessageKey } from "@/i18n/messages";

import type { RegistrationErrorCode } from "./service";

export const REGISTRATION_ERROR_KEYS: Partial<Record<RegistrationErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  NOT_EDITABLE: "registration.errors.notEditable",
  FIELD_IN_USE: "registration.errors.fieldInUse",
  NOT_CLUB_MEMBER: "registration.errors.notClubMember",
  NOT_ELIGIBLE: "registration.errors.notEligible",
  REGISTRATION_CLOSED: "registration.errors.closed",
  ALREADY_APPLIED: "registration.errors.alreadyApplied",
  FULL: "registration.errors.full",
  WRONG_MODE: "registration.errors.wrongMode",
  INVALID_ANSWERS: "registration.errors.invalidAnswers",
  CODE_INVALID: "registration.errors.codeInvalid",
  TEAM_FULL: "registration.errors.teamFull",
  TEAM_TOO_SMALL: "registration.errors.teamTooSmall",
  NOT_CAPTAIN: "registration.errors.notCaptain",
  CANNOT_REMOVE_CAPTAIN: "registration.errors.cannotRemoveCaptain",
  FILE_INVALID: "profile.errors.fileInvalid",
  FILE_TYPE: "profile.errors.fileType",
  FILE_TOO_LARGE: "profile.errors.fileTooLarge",
};
