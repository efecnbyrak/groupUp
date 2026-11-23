import "server-only";

import { discardPrivateFiles, storePrivateFiles, type IncomingFile, type StoredAttachment } from "@/lib/attachments";
import { audit } from "@/lib/audit";
import { db, type Tx } from "@/lib/db";
import type { ChangeRequestType } from "@/lib/db-types";
import { env } from "@/lib/env";
import { getStorage } from "@/lib/storage";
import { getMailRecipient } from "@/modules/identity";
import { sendEmailSafe } from "@/modules/notification";

import { nextStatus, TransitionError, type RequestDecision } from "./domain/state-machine";
import { approvalError } from "./handlers/common";
import { handlers } from "./handlers";
import type { CreateContext, StoredRequest } from "./handlers/types";

const isUniqueViolation = (err: unknown) => typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";

export interface SubmitInput {
  type: ChangeRequestType;
  universityId: string;
  clubId: string | null;
  payload: unknown;
  reason?: string | null;
  files?: IncomingFile[];
}

/**
 * Talep oluştur (APPROVALS-TICKETS §4). Aynı hedef + tip (+ kulüp) için PENDING varsa o güncellenir;
 * yeni dosya gönderildiyse eski ekler değiştirilir. Dosyalar önce depoya yazılır, transaction
 * başarısız olursa silinir.
 */
export async function submitRequest(actor: { id: string }, input: SubmitInput): Promise<{ id: string; updated: boolean }> {
  const handler = handlers.get(input.type);
  const ctx: CreateContext = { actorId: actor.id, universityId: input.universityId, clubId: input.clubId };
  const payload = handler.normalize(input.payload);
  const reason = input.reason?.trim() || null;
  if (handler.requiresReason && !reason) throw approvalError("REASON_REQUIRED", { reason: "validation.required" });

  const stored = input.files?.length ? await storePrivateFiles(input.files, "evidence", actor.id) : [];
  let replaced: StoredAttachment[] = [];
  try {
    const result = await db.$transaction(async (tx) => {
      await handler.validateCreate(tx, ctx, payload);
      const targetId = handler.targetOf(payload, ctx);
      const existing = await tx.changeRequest.findFirst({
        where: { type: input.type, targetId, clubId: input.clubId, status: "PENDING" },
        select: { id: true, attachments: { select: { id: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true } } },
      });
      if (handler.requiresAttachment && stored.length === 0 && !existing?.attachments.length) {
        throw approvalError("ATTACHMENT_REQUIRED", { files: "approval.errors.attachmentRequired" });
      }
      let request: StoredRequest;
      const select = { id: true, universityId: true, clubId: true, targetId: true, requestedById: true } as const;
      if (existing) {
        request = await tx.changeRequest.update({ where: { id: existing.id }, data: { payload, reason, requestedById: actor.id }, select });
        if (stored.length) {
          replaced = existing.attachments;
          await tx.attachment.deleteMany({ where: { changeRequestId: existing.id } });
        }
      } else {
        request = await tx.changeRequest.create({
          data: { universityId: input.universityId, clubId: input.clubId, type: input.type, targetId, payload, reason, requestedById: actor.id },
          select,
        });
      }
      if (stored.length) {
        await tx.attachment.createMany({ data: stored.map((f) => ({ ...f, isPrivate: true, uploadedById: actor.id, changeRequestId: request.id })) });
      }
      await handler.afterCreate(tx, request, payload);
      await audit(
        {
          action: existing ? "approval.request.updated" : "approval.request.created",
          targetType: "ChangeRequest",
          targetId: request.id,
          actorId: actor.id,
          universityId: input.universityId,
          meta: { type: input.type, clubId: input.clubId, target: targetId, files: stored.length },
        },
        tx,
      );
      return { id: request.id, updated: Boolean(existing) };
    });
    if (replaced.length) await discardPrivateFiles(replaced);
    return result;
  } catch (err) {
    await discardPrivateFiles(stored);
    if (isUniqueViolation(err)) throw approvalError("ALREADY_DECIDED"); // eşzamanlı iki talep: biri kazandı
    throw err;
  }
}

type Decision = Exclude<RequestDecision, "CANCEL">;

/**
 * Admin kararı — idempotent (`WHERE status='PENDING'`), handler uygulaması + audit tek transaction.
 * Ret gerekçesi zorunlu (şema), talep sahibine mail transaction sonrası gider.
 */
export async function decideRequest(actor: { id: string }, universityId: string, requestId: string, decision: Decision, reason: string | null): Promise<void> {
  const decided = await db.$transaction(async (tx) => {
    const req = await tx.changeRequest.findFirst({
      where: { id: requestId, universityId },
      select: { id: true, type: true, status: true, payload: true, universityId: true, clubId: true, targetId: true, requestedById: true, club: { select: { name: true } } },
    });
    if (!req) throw approvalError("NOT_FOUND");
    let status;
    try {
      status = nextStatus(req.status, decision);
    } catch (err) {
      if (err instanceof TransitionError) throw approvalError("ALREADY_DECIDED");
      throw err;
    }
    if (decision === "REJECT" && !reason?.trim()) throw approvalError("REASON_REQUIRED", { reason: "validation.required" });
    const { count } = await tx.changeRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status, reviewedById: actor.id, decidedAt: new Date(), decisionNote: decision === "REJECT" ? reason!.trim() : null },
    });
    if (count === 0) throw approvalError("ALREADY_DECIDED");
    const handler = handlers.get(req.type);
    if (decision === "APPROVE") await handler.apply(tx, req, req.payload);
    else await handler.onReject(tx, req, req.payload, reason!.trim());
    await audit(
      {
        action: decision === "APPROVE" ? "approval.request.approved" : "approval.request.rejected",
        targetType: "ChangeRequest",
        targetId: req.id,
        actorId: actor.id,
        universityId,
        meta: { type: req.type, clubId: req.clubId, target: req.targetId, ...(reason ? { reason: reason.trim() } : {}) },
      },
      tx,
    );
    const recipient = await getMailRecipient(tx, req.requestedById);
    return { req, recipient };
  });
  await notifyDecision(decided.req, decided.recipient, decision === "APPROVE", reason?.trim() ?? null);
}

async function notifyDecision(
  req: { type: ChangeRequestType; club: { name: string } | null },
  recipient: { email: string; locale: string; name: string } | null,
  approved: boolean,
  reason: string | null,
): Promise<void> {
  if (!recipient) return;
  if (req.type === "ALUMNI_VERIFY") {
    await sendEmailSafe(recipient.email, "alumni-result", recipient.locale, { name: recipient.name, approved, reason, url: `${env.APP_URL}${approved ? "/giris" : "/mezun-dogrulama"}` });
    return;
  }
  await sendEmailSafe(recipient.email, "request-decided", recipient.locale, { name: recipient.name, type: req.type, clubName: req.club?.name ?? "", approved, reason });
}

/** Talep sahibi (veya aynı kulübün Başkanı) bekleyen talebi geri çeker. */
export async function cancelRequest(actor: { id: string }, requestId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const req = await tx.changeRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, requestedById: true, universityId: true, type: true, club: { select: { presidentId: true } } } });
    if (!req) throw approvalError("NOT_FOUND");
    if (req.requestedById !== actor.id && req.club?.presidentId !== actor.id) throw approvalError("NOT_OWNER");
    if (req.type === "ALUMNI_VERIFY") throw approvalError("NOT_OWNER");
    const { count } = await tx.changeRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "CANCELLED", decidedAt: new Date() } });
    if (count === 0) throw approvalError("ALREADY_DECIDED");
    await audit({ action: "approval.request.cancelled", targetType: "ChangeRequest", targetId: requestId, actorId: actor.id, universityId: req.universityId, meta: { type: req.type } }, tx);
  });
}

// ---------------------------------------------------------------- Ticket ekleri (tablo approval'a ait)

/** Ticket mesajına ek bağlar (ticket modülü dosyaları önce `storePrivateFiles` ile yazar). */
export async function attachToTicketMessage(tx: Tx, messageId: string, uploaderId: string, files: StoredAttachment[]): Promise<void> {
  if (!files.length) return;
  await tx.attachment.createMany({ data: files.map((f) => ({ ...f, isPrivate: true, uploadedById: uploaderId, ticketMessageId: messageId })) });
}

/** Silinen yeni görseller vb. için (CLUB_UPDATE reddinde public dosya temizliği F10 cron'unda). */
export async function deletePublicFile(key: string): Promise<void> {
  await getStorage().delete(key, "public").catch(() => undefined);
}
