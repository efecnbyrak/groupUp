import type { MessageKey } from "@/i18n/messages";

import type { ProfileErrorCode } from "./service";

export const PROFILE_ERROR_KEYS: Partial<Record<ProfileErrorCode, MessageKey>> = {
  INVALID_FIELDS: "errors.invalidForm",
  FILE_TOO_LARGE: "profile.errors.fileTooLarge",
  FILE_TYPE: "profile.errors.fileType",
  FILE_INVALID: "profile.errors.fileInvalid",
  NOT_FOUND: "university.errors.notFound",
};
