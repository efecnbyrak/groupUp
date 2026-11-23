import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { register, verifyEmail } from "@/modules/identity";
import { decideRequest, getRequestDetail, listQueue, submitRequest } from "@/modules/approval";
import { getAlumniVerification } from "@/modules/profile";
import { listPendingAlumni } from "@/modules/university";

import { codeFrom, createActiveUser, errorCode, lastMailTo, mailbox, registerInput, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const PERSONAL = "ayse.mezun@kisisel.com";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

beforeEach(async () => {
  fx = await resetDatabase();
});

async function manualAlumni(email = PERSONAL) {
  const input = registerInput(fx, { email, universityId: fx.university.id, classYear: undefined, graduationYear: 2020 });
  await register(input, { locale: "tr" });
  await verifyEmail(email, codeFrom(email));
  return db.user.findUniqueOrThrow({ where: { email } });
}

describe("manuel mezun kaydı", () => {
  it("kişisel mail + üniversite seçimi → ALUMNI, OTP sonrası PENDING_ALUMNI_REVIEW", async () => {
    const user = await manualAlumni();
    expect(user).toMatchObject({ type: "ALUMNI", universityId: fx.university.id, status: "PENDING_ALUMNI_REVIEW" });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it("mezun domaini ile kayıt doğrudan ACTIVE olur", async () => {
    const email = "eski@mezun.test.edu.tr";
    await register(registerInput(fx, { email, classYear: undefined, graduationYear: 2019 }), { locale: "tr" });
    await verifyEmail(email, codeFrom(email));
    expect((await db.user.findUniqueOrThrow({ where: { email } })).status).toBe("ACTIVE");
  });

  it("yalnızca DOMAIN modundaki veya kapalı üniversite seçilemez; üniversitesiz kişisel mail reddedilir", async () => {
    await db.university.update({ where: { id: fx.university.id }, data: { alumniVerifyMode: "DOMAIN" } });
    expect(await errorCode(register(registerInput(fx, { email: PERSONAL, universityId: fx.university.id, graduationYear: 2020 }), { locale: "tr" }))).toBe("UNIVERSITY_NOT_FOUND");
    expect(await errorCode(register(registerInput(fx, { email: PERSONAL, graduationYear: 2020 }), { locale: "tr" }))).toBe("UNIVERSITY_NOT_FOUND");
  });

  it("domaini çözümlenen mail, seçilen üniversiteyi yok sayar", async () => {
    const email = "20230009@ogr.test.edu.tr";
    await register(registerInput(fx, { email, universityId: fx.other.id }), { locale: "tr" });
    expect(await db.user.findUniqueOrThrow({ where: { email } })).toMatchObject({ universityId: fx.university.id, type: "STUDENT" });
  });
});

const upload = (user: { id: string; universityId: string | null }, body: Buffer, name: string) =>
  submitRequest(user, { type: "ALUMNI_VERIFY", universityId: user.universityId!, clubId: null, payload: {}, files: [{ name, body }] });
const REASON = "Belge okunaklı değil, lütfen net bir kopya yükleyin.";

describe("belge yükleme + karar (onay motoru, ALUMNI_VERIFY)", () => {
  it("PDF private depoya, talep Admin kuyruğuna; yeniden yükleme aynı talebi günceller ve eski dosyayı siler", async () => {
    const user = await manualAlumni();
    const { id } = await upload(user, PDF, "../../diploma.pdf");
    const first = await db.attachment.findFirstOrThrow({ where: { changeRequestId: id } });
    expect(first).toMatchObject({ fileName: "diploma.pdf", mimeType: "application/pdf", isPrivate: true });
    expect(await getStorage().get(first.storageKey, "private")).not.toBeNull();
    expect(await getStorage().get(first.storageKey, "public")).toBeNull();
    expect(await getAlumniVerification(user.id)).toMatchObject({ status: "PENDING", changeRequestId: id });
    expect((await listPendingAlumni(fx.university.id)).map((p) => p.user.email)).toEqual([PERSONAL]);
    expect(await listPendingAlumni(fx.other.id)).toHaveLength(0);
    expect((await listQueue(fx.university.id, { type: "ALUMNI_VERIFY" })).items).toHaveLength(1);

    const again = await upload(user, PNG, "yeni.png");
    expect(again).toEqual({ id, updated: true });
    expect(await getStorage().get(first.storageKey, "private")).toBeNull();
    expect((await db.attachment.findMany({ where: { changeRequestId: id } })).map((a) => a.fileName)).toEqual(["yeni.png"]);
  });

  it("ret: gerekçe zorunlu, maille gider; kullanıcı yeniden yükler → onay → hesap ACTIVE + mail", async () => {
    const user = await manualAlumni();
    const admin = await createActiveUser(fx.university.id, "admin@ogr.test.edu.tr");
    await db.universityAdmin.create({ data: { universityId: fx.university.id, userId: admin.id } });
    const { id } = await upload(user, PDF, "diploma.pdf");

    expect(await errorCode(decideRequest(admin, fx.university.id, id, "REJECT", "  "))).toBe("REASON_REQUIRED");
    mailbox().length = 0;
    await decideRequest(admin, fx.university.id, id, "REJECT", REASON);
    expect(await getAlumniVerification(user.id)).toMatchObject({ status: "REJECTED", rejectReason: REASON });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("PENDING_ALUMNI_REVIEW");
    expect(lastMailTo(PERSONAL)?.text).toContain(REASON);
    expect(await errorCode(decideRequest(admin, fx.university.id, id, "APPROVE", null))).toBe("ALREADY_DECIDED");

    const second = await upload(user, PDF, "diploma-net.pdf");
    expect(second.id).not.toBe(id);
    await decideRequest(admin, fx.university.id, second.id, "APPROVE", null);
    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ status: "ACTIVE", type: "ALUMNI" });
    expect(await getAlumniVerification(user.id)).toMatchObject({ status: "APPROVED", rejectReason: null });
    expect(lastMailTo(PERSONAL)?.subject).toMatch(/onaylandı/);
    expect(await db.auditLog.count({ where: { action: "approval.request.approved", targetId: second.id } })).toBe(1);
  });

  it("başka üniversitenin Admini karar veremez ve detayı göremez", async () => {
    const user = await manualAlumni();
    const { id } = await upload(user, PDF, "diploma.pdf");
    const outsider = await createActiveUser(fx.other.id, "admin@ogr.baska.edu.tr");
    expect(await errorCode(decideRequest(outsider, fx.other.id, id, "APPROVE", null))).toBe("NOT_FOUND");
    expect(await getRequestDetail(fx.other.id, id)).toBeNull();
    expect(await getRequestDetail(fx.university.id, id)).not.toBeNull();
  });

  it("sahte uzantılı ve büyük dosyaları reddeder; belgesiz talep olmaz", async () => {
    const user = await manualAlumni();
    expect(await errorCode(upload(user, Buffer.from("<html>diploma</html>"), "diploma.pdf"))).toBe("FILE_TYPE");
    expect(await errorCode(upload(user, Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), "b.pdf"))).toBe("FILE_TOO_LARGE");
    expect(await errorCode(submitRequest(user, { type: "ALUMNI_VERIFY", universityId: fx.university.id, clubId: null, payload: {} }))).toBe("ATTACHMENT_REQUIRED");
    expect(await getAlumniVerification(user.id)).toBeNull();
  });

  it("ACTIVE kullanıcı belge yükleyemez", async () => {
    const active = await createActiveUser(fx.university.id, "a@ogr.test.edu.tr", { type: "ALUMNI" });
    expect(await errorCode(upload(active, PDF, "d.pdf"))).toBe("NOT_FOUND");
  });
});
