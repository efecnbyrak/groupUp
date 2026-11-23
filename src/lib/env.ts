import "server-only";

import { parseEnv } from "./env-schema";

export type { Env } from "./env-schema";

/** Doğrulanmış ortam değişkenleri. Eksik/yanlış değerde ilk import'ta hata fırlatır. */
export const env = parseEnv(process.env);
