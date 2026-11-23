import { describe, expect, it } from "vitest";

import { docParagraphs, docToText, textToDoc } from "./description";

describe("club description", () => {
  it("boş metin → null", () => {
    expect(textToDoc("  \n\n ")).toBeNull();
    expect(textToDoc(null)).toBeNull();
  });

  it("paragraflara böler ve geri çevirir", () => {
    const doc = textToDoc("Birinci paragraf.\r\n\r\nİkinci\nsatır.\n\n\n Üçüncü ");
    expect(doc?.content).toHaveLength(3);
    expect(docToText(doc)).toBe("Birinci paragraf.\n\nİkinci\nsatır.\n\nÜçüncü");
  });

  it("bilinmeyen yapıları yok sayar", () => {
    expect(docParagraphs(null)).toEqual([]);
    expect(docParagraphs({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }, { type: "image" }] })).toEqual(["ab"]);
  });
});
