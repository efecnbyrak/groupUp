import type { MessageKey } from "@/i18n/messages";
import type { AttachmentErrorCode } from "@/lib/attachments";
import { CLUB_ERROR_KEYS } from "@/modules/club";
import { PROFILE_ERROR_KEYS } from "@/modules/profile";

import type { ApprovalErrorCode } from "./handlers/common";

export const APPROVAL_ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  ...PROFILE_ERROR_KEYS,
  ...CLUB_ERROR_KEYS,
  NOT_FOUND: "university.errors.notFound",
  ALREADY_DECIDED: "approval.errors.alreadyDecided",
  REASON_REQUIRED: "approval.errors.reasonRequired",
  ATTACHMENT_REQUIRED: "approval.errors.attachmentRequired",
  NO_CHANGES: "approval.errors.noChanges",
  NOT_OWNER: "errors.forbidden",
  WRONG_CLUB: "errors.forbidden",
  STAFF_LIMIT: "club.errors.staffLimit",
  FILE_INVALID: "profile.errors.fileInvalid",
  FILE_TYPE: "approval.errors.fileType",
  FILE_TOO_LARGE: "profile.errors.fileTooLarge",
  TOO_MANY_FILES: "approval.errors.tooManyFiles",
} satisfies Partial<Record<ApprovalErrorCode | AttachmentErrorCode, MessageKey>>;
