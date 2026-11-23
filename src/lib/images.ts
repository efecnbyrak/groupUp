import "server-only";

import sharp from "sharp";

/**
 * Görsel işleme (ADR 0005): her şey WebP'ye çevrilir, EXIF/metadata atılır (sharp varsayılanı),
 * EXIF yönü uygulanır. next/image optimizasyonu kullanılmaz.
 */
export const AVATAR_SIZE = 256;

/** Kare avatar: ortadan kırpılmış 256×256 WebP. */
export async function toAvatarWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
}
