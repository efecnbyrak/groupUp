import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** sha256 → hex. Token/OTP'ler DB'de yalnızca bu hash ile saklanır. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** 32 byte rastgele, URL güvenli token (oturum, şifre sıfırlama linki). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** 6 haneli OTP (başta sıfır olabilir). */
export function randomOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hex hash'leri sabit zamanlı karşılaştırır. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
