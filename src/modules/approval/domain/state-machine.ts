/**
 * ChangeRequest yaşam döngüsü (APPROVALS-TICKETS §2) — saf TS.
 * PENDING → APPROVED | REJECTED | CANCELLED; son durumlardan çıkış yok.
 */
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type RequestDecision = "APPROVE" | "REJECT" | "CANCEL";

const NEXT: Record<RequestDecision, RequestStatus> = { APPROVE: "APPROVED", REJECT: "REJECTED", CANCEL: "CANCELLED" };

export class TransitionError extends Error {
  constructor(
    readonly from: RequestStatus,
    readonly decision: RequestDecision,
  ) {
    super(`Geçersiz geçiş: ${from} → ${decision}`);
    this.name = "TransitionError";
  }
}

export function isFinal(status: RequestStatus): boolean {
  return status !== "PENDING";
}

export function canTransition(from: RequestStatus, decision: RequestDecision): boolean {
  return from === "PENDING" && decision in NEXT;
}

/** Karar sonrası durum; geçersizse TransitionError ("zaten karar verilmiş"). */
export function nextStatus(from: RequestStatus, decision: RequestDecision): RequestStatus {
  if (!canTransition(from, decision)) throw new TransitionError(from, decision);
  return NEXT[decision];
}
