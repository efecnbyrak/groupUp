import "server-only";

import { hash, verify } from "@node-rs/argon2";

// AUTH-EMAIL §5: argon2id, memoryCost 19456 KiB, timeCost 2.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Kullanıcı bulunamadığında da doğrulama yapılır → zamanlama ile hesap sızdırılmaz.
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string | null | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hash("groupup-dummy-password!", OPTIONS);
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return verify(passwordHash, password).catch(() => false);
}
