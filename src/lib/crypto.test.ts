import { describe, expect, it } from "vitest";

import { randomOtp, randomToken, safeEqualHex, sha256 } from "./crypto";

describe("crypto", () => {
  it("OTP her zaman 6 rakam", () => {
    for (let i = 0; i < 200; i++) expect(randomOtp()).toMatch(/^\d{6}$/);
  });
  it("token base64url ve yeterince uzun", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hash karşılaştırma", () => {
    expect(safeEqualHex(sha256("a"), sha256("a"))).toBe(true);
    expect(safeEqualHex(sha256("a"), sha256("b"))).toBe(false);
    expect(safeEqualHex(sha256("a"), "ab")).toBe(false);
  });
});
