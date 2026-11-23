import "server-only";

import { createRegistry } from "../domain/registry";
import { alumniVerifyHandler } from "./alumni";
import { clubUpdateHandler } from "./club-update";
import { eventCancelHandler, eventPublishHandler, eventUpdateHandler } from "./event";
import { memberBanHandler, memberRemoveHandler } from "./members";
import { staffAssignHandler, staffRemoveHandler } from "./staff";
import type { RegisteredHandler } from "./types";

/** Tip → handler (ADR-0007). ELECTION_RESULT F11'de eklenir. */
export const handlers = createRegistry<RegisteredHandler>([
  clubUpdateHandler,
  memberRemoveHandler,
  memberBanHandler,
  staffAssignHandler,
  staffRemoveHandler,
  alumniVerifyHandler,
  eventPublishHandler,
  eventUpdateHandler,
  eventCancelHandler,
]);
