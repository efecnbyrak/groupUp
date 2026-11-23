import type { z } from "zod";

import type { Tx } from "@/lib/db";
import type { ChangeRequestType, Prisma } from "@/lib/db-types";

import type { DiffRow } from "../domain/diff";

/** Talep oluşturma bağlamı (authz action'da yapılmış olarak gelir). */
export interface CreateContext {
  actorId: string;
  universityId: string;
  clubId: string | null;
}

export interface StoredRequest {
  id: string;
  universityId: string;
  clubId: string | null;
  targetId: string;
  requestedById: string;
}

/** APPROVALS-TICKETS §3 — tip başına handler sözleşmesi. */
export interface ApprovalHandler<P = unknown> {
  type: ChangeRequestType;
  payloadSchema: z.ZodType<P>;
  /** Talep gerekçesi zorunlu mu (üye çıkar/engelle). */
  requiresReason: boolean;
  /** Ek (kanıt/belge) zorunlu mu. */
  requiresAttachment: boolean;
  targetOf(payload: P, ctx: CreateContext): string;
  /** Hedef/ön koşul kontrolü (ör. ekip 10'u aşıyor mu). Transaction içinde. */
  validateCreate(tx: Tx, ctx: CreateContext, payload: P): Promise<void>;
  /** Talep kaydı yazıldıktan sonra (ör. mezun durum kaydı). */
  afterCreate?(tx: Tx, request: StoredRequest, payload: P): Promise<void>;
  apply(tx: Tx, request: StoredRequest, payload: P): Promise<void>;
  onReject?(tx: Tx, request: StoredRequest, payload: P, reason: string): Promise<void>;
  /** Admin fark görünümü (yalnızca değişen alanlar). */
  describe(payload: P): DiffRow[];
}

/**
 * Kayıt haritasındaki tip silinmiş handler: her çağrı ham (DB'den gelen) payload'ı alır ve
 * önce `payloadSchema` ile doğrular (ADR-0007: "oluştururken ve uygularken doğrulanır").
 */
export interface RegisteredHandler {
  type: ChangeRequestType;
  requiresReason: boolean;
  requiresAttachment: boolean;
  /** Doğrulanmış payload'ın JSON hali (DB'ye yazılan). */
  normalize(raw: unknown): Prisma.InputJsonValue;
  targetOf(raw: unknown, ctx: CreateContext): string;
  validateCreate(tx: Tx, ctx: CreateContext, raw: unknown): Promise<void>;
  afterCreate(tx: Tx, request: StoredRequest, raw: unknown): Promise<void>;
  apply(tx: Tx, request: StoredRequest, raw: unknown): Promise<void>;
  onReject(tx: Tx, request: StoredRequest, raw: unknown, reason: string): Promise<void>;
  describe(raw: unknown): DiffRow[];
}

export function defineHandler<P>(h: ApprovalHandler<P>): RegisteredHandler {
  const parse = (raw: unknown): P => h.payloadSchema.parse(raw);
  return {
    type: h.type,
    requiresReason: h.requiresReason,
    requiresAttachment: h.requiresAttachment,
    normalize: (raw) => JSON.parse(JSON.stringify(parse(raw))) as Prisma.InputJsonValue,
    targetOf: (raw, ctx) => h.targetOf(parse(raw), ctx),
    validateCreate: (tx, ctx, raw) => h.validateCreate(tx, ctx, parse(raw)),
    afterCreate: async (tx, req, raw) => {
      await h.afterCreate?.(tx, req, parse(raw));
    },
    apply: (tx, req, raw) => h.apply(tx, req, parse(raw)),
    onReject: async (tx, req, raw, reason) => {
      await h.onReject?.(tx, req, parse(raw), reason);
    },
    describe: (raw) => h.describe(parse(raw)),
  };
}
