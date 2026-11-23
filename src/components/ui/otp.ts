/** OTP girişini normalize eder: rakam dışını atar, uzunluğa kırpar (yapıştırılan "123 456" → "123456"). */
export function normalizeOtp(raw: string, length = 6): string {
  return raw.replace(/\D/g, "").slice(0, length);
}
