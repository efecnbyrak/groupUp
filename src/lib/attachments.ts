import "server-only";

import { ServiceError } from "./errors";
import { detectFileType, MB, safeFileName, type DetectedFileType } from "./file-type";
import { getStorage, newFileKey } from "./storage";

/**
 * Kanıt / ticket ekleri (APPROVALS-TICKETS §5): PDF, JPG, PNG, WEBP; tek dosya ≤ 10 MB,
 * istek başına ≤ 5 dosya; private depolama, tip magic byte ile, ad sanitize, anahtar rastgele.
 * Tablo (Attachment) approval modülüne aittir; burada yalnızca dosya doğrulama + depolama.
 */
export const ATTACHMENT_MAX_BYTES = 10 * MB;
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const ALLOWED = new Set<DetectedFileType["ext"]>(["pdf", "jpg", "png", "webp"]);

export type AttachmentErrorCode = "FILE_INVALID" | "FILE_TOO_LARGE" | "FILE_TYPE" | "TOO_MANY_FILES";

export interface IncomingFile {
  name: string;
  body: Buffer;
}

export interface StoredAttachment {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** FormData'daki boş olmayan dosyaları okur (aynı ada sahip çoklu input). */
export async function filesFromForm(formData: FormData, name: string): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  for (const value of formData.getAll(name)) {
    if (value instanceof File && value.size > 0) {
      if (value.size > ATTACHMENT_MAX_BYTES) throw new ServiceError<AttachmentErrorCode>("FILE_TOO_LARGE");
      out.push({ name: value.name, body: Buffer.from(await value.arrayBuffer()) });
    }
  }
  return out;
}

/** Dosyaları doğrular (hepsi geçerliyse) ve private depoya yazar. */
export async function storePrivateFiles(files: IncomingFile[], prefix: string, ownerId: string): Promise<StoredAttachment[]> {
  if (files.length > ATTACHMENT_MAX_FILES) throw new ServiceError<AttachmentErrorCode>("TOO_MANY_FILES");
  const checked = files.map((f) => {
    if (f.body.byteLength === 0) throw new ServiceError<AttachmentErrorCode>("FILE_INVALID");
    if (f.body.byteLength > ATTACHMENT_MAX_BYTES) throw new ServiceError<AttachmentErrorCode>("FILE_TOO_LARGE");
    const type = detectFileType(f.body);
    if (!type || !ALLOWED.has(type.ext)) throw new ServiceError<AttachmentErrorCode>("FILE_TYPE");
    return { file: f, type };
  });
  const storage = getStorage();
  const stored: StoredAttachment[] = [];
  for (const { file, type } of checked) {
    const storageKey = newFileKey(prefix, ownerId, type.ext);
    await storage.put(storageKey, file.body, "private");
    stored.push({ storageKey, fileName: safeFileName(file.name), mimeType: type.mime, sizeBytes: file.body.byteLength });
  }
  return stored;
}

/** Transaction başarısız olursa yazılmış dosyaları geri al. */
export async function discardPrivateFiles(files: StoredAttachment[]): Promise<void> {
  const storage = getStorage();
  await Promise.all(files.map((f) => storage.delete(f.storageKey, "private").catch(() => undefined)));
}

/** 5 dk geçerli imzalı adres. Çağıran yetkiyi ÖNCE kontrol eder. */
export function signedAttachmentUrl(storageKey: string): string {
  return getStorage().signedUrl(storageKey, 300);
}
