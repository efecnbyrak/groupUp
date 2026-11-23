/**
 * Yüklenen dosyanın gerçek tipini ilk baytlardan (magic number) bulur. Tarayıcının gönderdiği
 * MIME tipine ve dosya uzantısına güvenilmez. Saf fonksiyon.
 */
export type DetectedFileType = { ext: "pdf" | "jpg" | "png" | "webp"; mime: string };

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

export function detectFileType(buf: Uint8Array): DetectedFileType | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: "pdf", mime: "application/pdf" }; // %PDF-
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  return null;
}

export const MB = 1024 * 1024;

/** Dosya adını depolama/gösterim için güvenli hale getirir (yol ve kontrol karakterleri atılır). */
export function safeFileName(name: string, maxLength = 120): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  return (cleaned || "dosya").slice(-maxLength);
}
