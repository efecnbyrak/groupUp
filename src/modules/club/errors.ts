import type { MessageKey } from "@/i18n/messages";

import type { ClubErrorCode } from "./service";

export const CLUB_ERROR_KEYS: Partial<Record<ClubErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  SLUG_TAKEN: "university.errors.slugTaken",
  IN_USE: "university.errors.inUse",
  PRESIDENT_INVALID: "club.errors.presidentInvalid",
  ALREADY_PRESIDENT: "club.errors.alreadyPresident",
  INVITE_INVALID: "club.errors.inviteInvalid",
  ALREADY_MEMBER: "club.errors.alreadyMember",
  BANNED: "club.errors.banned",
  OTHER_UNIVERSITY: "club.errors.otherUniversity",
  PRESIDENT_CANNOT_LEAVE: "club.errors.presidentCannotLeave",
  NOT_MEMBER: "club.errors.notMember",
  IS_PRESIDENT: "club.errors.isPresident",
  NOT_STAFF: "club.errors.notStaff",
  STAFF_LIMIT: "club.errors.staffLimit",
  CLUB_INACTIVE: "club.errors.inactive",
  FILE_INVALID: "profile.errors.fileInvalid",
  FILE_TYPE: "profile.errors.fileType",
  FILE_TOO_LARGE: "profile.errors.fileTooLarge",
};
