import type { MessageKey } from "@/i18n/messages";
import { APPROVAL_ERROR_KEYS } from "@/modules/approval";

import type { TicketErrorCode } from "./service";

export const TICKET_ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  ...APPROVAL_ERROR_KEYS,
  NOT_FOUND: "university.errors.notFound",
  CLOSED: "ticket.errors.closed",
  REOPEN_EXPIRED: "ticket.errors.reopenExpired",
  NOT_CLOSED: "ticket.errors.notClosed",
} satisfies Partial<Record<TicketErrorCode, MessageKey>>;
