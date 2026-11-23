import { describe, expect, it } from "vitest";

import { CODE_ALPHABET, normalizeCode, randomCode } from "./ids";

describe("ids", () => {
  it("üretilen kod 8 karakter ve alfabeden", () => {
    for (let i = 0; i < 50; i++) {
      const code = randomCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it("karışan karakterleri içermez", () => {
    for (const ch of "0O1IL") expect(CODE_ALPHABET).not.toContain(ch);
  });

  it("deterministik rastgele kaynakla", () => {
    expect(randomCode(4, () => 0)).toBe("AAAA");
  });

  it("normalize: boşluk/tire/küçük harf", () => {
    expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeCode(" ab cd ef gh ")).toBe("ABCDEFGH");
  });

  it("normalize: geçersiz uzunluk veya karakter → null", () => {
    expect(normalizeCode("ABC")).toBeNull();
    expect(normalizeCode("ABCDEFG0")).toBeNull();
    expect(normalizeCode("ABCDEFGI")).toBeNull();
  });
});
