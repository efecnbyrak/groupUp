import { describe, expect, it } from "vitest";

import { detectFileType, safeFileName } from "./file-type";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectFileType", () => {
  it("PDF, JPEG, PNG ve WebP imzalarını tanır", () => {
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7\n"))?.ext).toBe("pdf");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectFileType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.ext).toBe("webp");
  });
  it("bilinmeyen veya sahte içerikte null döner", () => {
    expect(detectFileType(new TextEncoder().encode("<html>pdf değil</html>"))).toBeNull();
    expect(detectFileType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull(); // AVI
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});

describe("safeFileName", () => {
  it("yol parçalarını ve tehlikeli karakterleri atar", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\x\\diploma.pdf")).toBe("diploma.pdf");
    expect(safeFileName('a<b>"c".pdf')).toBe("abc.pdf");
    expect(safeFileName("   ")).toBe("dosya");
  });
});
