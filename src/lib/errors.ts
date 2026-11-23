/**
 * Servis katmanı hataları. Servisler bunları fırlatır; action'lar kullanıcı mesajına çevirir.
 * `code` modülün kendi hata birliğidir (ör. identity: "LOGIN_INVALID").
 */
export class ServiceError<C extends string = string> extends Error {
  constructor(
    readonly code: C,
    readonly fields?: Record<string, string>,
  ) {
    super(code);
    this.name = "ServiceError";
  }
}

export class RateLimitError extends Error {
  constructor(readonly retryAfterSec: number) {
    super("RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

/** Server Action dönüş tipi — `useActionState` ile kullanılır. Metinler çevrilmiş gelir. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
