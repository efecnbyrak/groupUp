import "server-only";

import { detectFileType, MB } from "@/lib/file-type";
import { getStorage, newFileKey } from "@/lib/storage";

import { fail } from "./service";

const EXT_TO_MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Başvuru dosya cevabı (ör. sağlık raporu): private depoda, 5 dk imzalı adresle görüntülenir. */
export async function storeRegistrationFile(eventId: string, userId: string, file: Buffer, accept: string[], maxMb: number): Promise<string> {
  if (file.byteLength === 0) throw fail("FILE_INVALID");
  if (file.byteLength > maxMb * MB) throw fail("FILE_TOO_LARGE");
  const type = detectFileType(file);
  if (!type || !accept.includes(type.ext)) throw fail("FILE_TYPE");
  const key = newFileKey(`registrations/${eventId}`, userId, type.ext);
  await getStorage().put(key, file, "private");
  return key;
}

export function registrationFileUrl(key: string): string {
  return getStorage().signedUrl(key, 300);
}

export { EXT_TO_MIME };
