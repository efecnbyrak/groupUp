import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../../prisma/generated/client";
import { env } from "./env";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Dev'de hot reload her seferinde yeni bağlantı havuzu açmasın.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Transaction istemcisi — modüller arası, tek transaction'da çalışan servis fonksiyonları için. */
export type Tx = Prisma.TransactionClient;
