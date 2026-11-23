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

export const LOGO_SIZE = 512;
export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 600;

/** Kulüp logosu: kare 512×512 WebP. */
export async function toLogoWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 85 })
    .toBuffer();
}

/** Kulüp kapak görseli: 1600×600 (8:3) WebP. */
export async function toCoverWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "attention" })
    .webp({ quality: 80 })
    .toBuffer();
}

/** Etkinlik kapağı (16:9): 1200×675 + kart için 400×225 WebP (EVENTS-FORMS-I18N §3, §8). */
export async function toEventCoverWebp(input: Buffer): Promise<{ large: Buffer; small: Buffer }> {
  const base = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
  const [large, small] = await Promise.all([
    base.clone().resize(1200, 675, { fit: "cover", position: "attention" }).webp({ quality: 80 }).toBuffer(),
    base.clone().resize(400, 225, { fit: "cover", position: "attention" }).webp({ quality: 78 }).toBuffer(),
  ]);
  return { large, small };
}

/** İçerik/galeri görseli: en çok 1200px genişlik, oran korunur. */
export async function toContentWebp(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
