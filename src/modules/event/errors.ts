import type { MessageKey } from "@/i18n/messages";

import type { EventErrorCode } from "./service";

export const EVENT_ERROR_KEYS: Partial<Record<EventErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  SLUG_TAKEN: "university.errors.slugTaken",
  IN_USE: "platform.categories.hasChildren",
  PARENT_INVALID: "platform.categories.parentInvalid",
  NOT_EDITABLE: "event.errors.notEditable",
  INCOMPLETE: "event.errors.incomplete",
  FILE_INVALID: "profile.errors.fileInvalid",
  FILE_TYPE: "profile.errors.fileType",
  FILE_TOO_LARGE: "profile.errors.fileTooLarge",
};
