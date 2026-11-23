import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { register, verifyEmail } from "@/modules/identity";
import { getAlumniVerification, submitAlumniDocument } from "@/modules/profile";
import { listPendingAlumni } from "@/modules/university";

import { codeFrom, createActiveUser, errorCode, registerInput, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const PERSONAL = "ayse.mezun@kisisel.com";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF");

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

describe("belge yükleme", () => {
  it("PDF'i private storage'a yazar, Admin listesinde görünür; yenisi eskisini siler", async () => {
    const user = await manualAlumni();
    await submitAlumniDocument(user, PDF, "../../diploma.pdf");
    const first = await db.alumniVerification.findUniqueOrThrow({ where: { userId: user.id } });
    expect(first).toMatchObject({ status: "PENDING", fileName: "diploma.pdf", mimeType: "application/pdf", universityId: fx.university.id });
    expect(await getStorage().get(first.storageKey, "private")).not.toBeNull();
    expect(await getStorage().get(first.storageKey, "public")).toBeNull();
    expect((await listPendingAlumni(fx.university.id)).map((p) => p.user.email)).toEqual([PERSONAL]);
    expect(await listPendingAlumni(fx.other.id)).toHaveLength(0);

    await db.alumniVerification.update({ where: { userId: user.id }, data: { status: "REJECTED", rejectReason: "Okunmuyor" } });
    await submitAlumniDocument(user, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), "yeni.png");
    const second = await getAlumniVerification(user.id);
    expect(second).toMatchObject({ status: "PENDING", rejectReason: null, fileName: "yeni.png" });
    expect(await getStorage().get(first.storageKey, "private")).toBeNull();
  });

  it("sahte uzantılı, desteklenmeyen ve büyük dosyaları reddeder", async () => {
    const user = await manualAlumni();
    expect(await errorCode(submitAlumniDocument(user, Buffer.from("<html>diploma</html>"), "diploma.pdf"))).toBe("FILE_TYPE");
    expect(await errorCode(submitAlumniDocument(user, Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "a.webp"))).toBe("FILE_TYPE");
    expect(await errorCode(submitAlumniDocument(user, Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), "b.pdf"))).toBe("FILE_TOO_LARGE");
    expect(await getAlumniVerification(user.id)).toBeNull();
  });

  it("ACTIVE kullanıcı belge yükleyemez", async () => {
    const active = await createActiveUser(fx.university.id, "a@ogr.test.edu.tr", { type: "ALUMNI" });
    expect(await errorCode(submitAlumniDocument(active, PDF, "d.pdf"))).toBe("NOT_FOUND");
  });
});
