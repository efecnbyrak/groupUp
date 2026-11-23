import type { MessageKey } from "@/i18n/messages";

import type { UniversityErrorCode } from "./platform-service";

/** university modülü servis hata kodları → kullanıcı mesajı anahtarı. */
export const UNIVERSITY_ERROR_KEYS: Partial<Record<UniversityErrorCode, MessageKey>> = {
  NOT_FOUND: "university.errors.notFound",
  SLUG_TAKEN: "university.errors.slugTaken",
  DOMAIN_INVALID: "validation.domain",
  DOMAIN_TAKEN: "university.errors.domainTaken",
  USER_NOT_FOUND: "university.errors.userNotFound",
  USER_OTHER_UNIVERSITY: "university.errors.userOtherUniversity",
  ALREADY_ADMIN: "university.errors.alreadyAdmin",
  REQUEST_RESOLVED: "university.errors.requestResolved",
  NAME_TAKEN: "university.errors.nameTaken",
  IN_USE: "university.errors.inUse",
};
