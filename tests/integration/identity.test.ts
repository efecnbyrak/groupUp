import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { RateLimitError, ServiceError } from "@/lib/errors";
import {
  changePassword,
  confirmEmailChange,
  login,
  OTP_MAX_ATTEMPTS,
  register,
  requestEmailChange,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/modules/identity";
import { resolveEmailDomain } from "@/modules/university";

import { codeFrom, expireRateLimits, lastMailTo, mailbox, registerInput, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;

const EMAIL = "20230001@ogr.test.edu.tr";

const code = (err: unknown) => (err instanceof ServiceError ? err.code : err instanceof RateLimitError ? "RATE_LIMITED" : String(err));
async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "NO_ERROR";
  } catch (err) {
    return code(err);
  }
}

async function registerAndVerify(overrides: Record<string, unknown> = {}) {
  const input = registerInput(fx, overrides);
  await register(input, { locale: "tr" });
  return verifyEmail(input.email, codeFrom(input.email));
}

beforeEach(async () => {
  fx = await resetDatabase();
});

describe("university.resolveEmailDomain", () => {
  it("alt domaini üst domaine çözer, tipi döner", async () => {
    expect(await resolveEmailDomain("x@a.ogr.test.edu.tr")).toMatchObject({ domain: "ogr.test.edu.tr", type: "STUDENT" });
    expect(await resolveEmailDomain("x@mezun.test.edu.tr")).toMatchObject({ type: "ALUMNI" });
    expect(await resolveEmailDomain("x@gmail.com")).toBeNull();
  });

  it("pasif üniversiteyi çözmez", async () => {
    await db.university.update({ where: { id: fx.university.id }, data: { isActive: false } });
    expect(await resolveEmailDomain(EMAIL)).toBeNull();
  });
});

describe("kayıt", () => {
  it("User + Profile + OTP + audit oluşturur, mail gönderir", async () => {
    await register(registerInput(fx), { locale: "en" });
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL }, include: { profile: true } });
    expect(user).toMatchObject({ status: "PENDING_VERIFICATION", type: "STUDENT", universityId: fx.university.id, locale: "en" });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.profile).toMatchObject({ firstName: "Ayşe", classYear: 2, graduationYear: null });
    expect(await db.emailToken.count({ where: { email: EMAIL, purpose: "VERIFY_EMAIL", usedAt: null } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "identity.user.registered", targetId: user.id } })).toBe(1);
    expect(lastMailTo(EMAIL)?.subject).toMatch(/verification code/);
  });

  it("OTP hash'li saklanır (düz kod DB'de yok)", async () => {
    await register(registerInput(fx), { locale: "tr" });
    const token = await db.emailToken.findFirstOrThrow({ where: { email: EMAIL } });
    expect(token.codeHash).not.toContain(codeFrom(EMAIL));
    expect(token.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("bilinmeyen domain → UNIVERSITY_NOT_FOUND", async () => {
    expect(await errorCode(register(registerInput(fx, { email: "a@gmail.com" }), { locale: "tr" }))).toBe("UNIVERSITY_NOT_FOUND");
  });

  it("başka üniversitenin bölümü reddedilir (tenant izolasyonu)", async () => {
    const otherFaculty = await db.faculty.create({
      data: { universityId: fx.other.id, nameTr: "X", departments: { create: [{ nameTr: "Y" }] } },
      include: { departments: true },
    });
    const err = await errorCode(
      register(registerInput(fx, { facultyId: otherFaculty.id, departmentId: otherFaculty.departments[0]!.id }), { locale: "tr" }),
    );
    expect(err).toBe("INVALID_FIELDS");
    expect(await db.user.count()).toBe(0);
  });

  it("mezun domaininde mezuniyet yılı zorunlu, sınıf yok sayılır", async () => {
    const email = "ali@mezun.test.edu.tr";
    expect(await errorCode(register(registerInput(fx, { email }), { locale: "tr" }))).toBe("INVALID_FIELDS");
    await register(registerInput(fx, { email, graduationYear: 2020 }), { locale: "tr" });
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    expect(user.type).toBe("ALUMNI");
    expect(user.profile).toMatchObject({ classYear: null, graduationYear: 2020 });
  });

  it("doğrulanmamış kayıt güncellenir, eski kod geçersiz olur", async () => {
    await register(registerInput(fx), { locale: "tr" });
    const firstCode = codeFrom(EMAIL);
    await register(registerInput(fx, { firstName: "Zeynep" }), { locale: "tr" });
    expect(await db.user.count()).toBe(1);
    expect((await db.profile.findFirstOrThrow()).firstName).toBe("Zeynep");
    const secondCode = codeFrom(EMAIL);
    if (firstCode !== secondCode) expect(await errorCode(verifyEmail(EMAIL, firstCode))).toBe("OTP_INVALID");
    await expect(verifyEmail(EMAIL, secondCode)).resolves.toHaveProperty("userId");
  });

  it("doğrulanmış mail ile tekrar kayıt → EMAIL_TAKEN", async () => {
    await registerAndVerify();
    expect(await errorCode(register(registerInput(fx), { locale: "tr" }))).toBe("EMAIL_TAKEN");
  });
});

describe("OTP", () => {
  it("doğru kod hesabı aktifleştirir ve tek kullanımlıktır", async () => {
    await register(registerInput(fx), { locale: "tr" });
    const otp = codeFrom(EMAIL);
    await verifyEmail(EMAIL, otp);
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await errorCode(verifyEmail(EMAIL, otp))).toBe("OTP_EXPIRED");
  });

  it(`${OTP_MAX_ATTEMPTS} yanlış denemede kod iptal edilir`, async () => {
    await register(registerInput(fx), { locale: "tr" });
    const otp = codeFrom(EMAIL);
    const wrong = otp === "000000" ? "111111" : "000000";
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) expect(await errorCode(verifyEmail(EMAIL, wrong))).toBe("OTP_INVALID");
    expect(await errorCode(verifyEmail(EMAIL, wrong))).toBe("OTP_TOO_MANY");
    // Doğru kod artık işe yaramaz.
    expect(await errorCode(verifyEmail(EMAIL, otp))).not.toBe("NO_ERROR");
  });

  it("süresi dolan kod reddedilir", async () => {
    await register(registerInput(fx), { locale: "tr" });
    await db.emailToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await errorCode(verifyEmail(EMAIL, codeFrom(EMAIL)))).toBe("OTP_EXPIRED");
  });

  it("yeniden gönder: 60 sn bekleme, yeni kod eskisini kapatır", async () => {
    await register(registerInput(fx), { locale: "tr" });
    await resendVerification(EMAIL);
    expect(await db.emailToken.count({ where: { email: EMAIL, usedAt: null } })).toBe(1);
    expect(await errorCode(resendVerification(EMAIL))).toBe("RATE_LIMITED");
  });

  it("yeniden gönder: saatte en fazla 5", async () => {
    await register(registerInput(fx), { locale: "tr" });
    for (let i = 0; i < 5; i++) {
      await resendVerification(EMAIL);
      await expireRateLimits(`otp:mail:${EMAIL}:60s`);
    }
    expect(await errorCode(resendVerification(EMAIL))).toBe("RATE_LIMITED");
  });

  it("yeniden gönder: hesap yoksa sessizce döner (sayım yok)", async () => {
    await resendVerification("yok@ogr.test.edu.tr");
    expect(mailbox()).toHaveLength(0);
  });
});

describe("giriş", () => {
  it("yanlış şifre ve olmayan kullanıcı aynı hatayı verir", async () => {
    await registerAndVerify();
    expect(await errorCode(login(EMAIL, "Yanlis!99"))).toBe("LOGIN_INVALID");
    expect(await errorCode(login("yok@ogr.test.edu.tr", "Kahve!42"))).toBe("LOGIN_INVALID");
  });

  it("doğru bilgiler → ok; askıdaki hesap → SUSPENDED", async () => {
    const { userId } = await registerAndVerify();
    await expect(login(EMAIL, "Kahve!42")).resolves.toEqual({ status: "ok", userId });
    await db.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
    expect(await errorCode(login(EMAIL, "Kahve!42"))).toBe("SUSPENDED");
  });

  it("doğrulanmamış hesap → needsVerification + yeni kod", async () => {
    await register(registerInput(fx), { locale: "tr" });
    await expireRateLimits("otp:mail:");
    const before = mailbox().length;
    await expect(login(EMAIL, "Kahve!42")).resolves.toEqual({ status: "needsVerification", email: EMAIL });
    expect(mailbox().length).toBe(before + 1);
  });

  it("mail başına 15 dakikada 10 deneme", async () => {
    await registerAndVerify();
    for (let i = 0; i < 10; i++) expect(await errorCode(login(EMAIL, "Yanlis!99"))).toBe("LOGIN_INVALID");
    expect(await errorCode(login(EMAIL, "Kahve!42"))).toBe("RATE_LIMITED");
  });
});

describe("şifre sıfırlama", () => {
  async function resetToken(): Promise<string> {
    await requestPasswordReset(EMAIL);
    const url = lastMailTo(EMAIL)?.text.match(/token=([\w%-]+)/)?.[1];
    if (!url) throw new Error("sıfırlama maili yok");
    return decodeURIComponent(url);
  }

  it("olmayan hesap için sessizce döner", async () => {
    await requestPasswordReset("yok@ogr.test.edu.tr");
    expect(mailbox()).toHaveLength(0);
  });

  it("şifreyi değiştirir, tüm oturumları siler, token tek kullanımlıktır", async () => {
    const { userId } = await registerAndVerify();
    await db.session.create({ data: { userId, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() + 60_000) } });
    const token = await resetToken();
    await resetPassword(token, "Yeni#Sifre1");
    expect(await db.session.count({ where: { userId } })).toBe(0);
    await expect(login(EMAIL, "Yeni#Sifre1")).resolves.toMatchObject({ status: "ok" });
    expect(lastMailTo(EMAIL)?.subject).toMatch(/şifren değiştirildi/);
    expect(await errorCode(resetPassword(token, "Baska#Sifre2"))).toBe("RESET_TOKEN_INVALID");
  });

  it("kişisel bilgi içeren şifre reddedilir", async () => {
    await registerAndVerify();
    const token = await resetToken();
    expect(await errorCode(resetPassword(token, "ayşe!1234"))).toBe("INVALID_FIELDS");
  });

  it("mail başına saatte 3 istek", async () => {
    await registerAndVerify();
    for (let i = 0; i < 3; i++) await requestPasswordReset(EMAIL);
    expect(await errorCode(requestPasswordReset(EMAIL))).toBe("RATE_LIMITED");
  });
});

describe("hesap işlemleri", () => {
  it("şifre değiştir: mevcut şifre kontrolü, diğer oturumlar kapanır", async () => {
    const { userId } = await registerAndVerify();
    const keep = await db.session.create({ data: { userId, tokenHash: "a".repeat(64), expiresAt: new Date(Date.now() + 60_000) } });
    await db.session.create({ data: { userId, tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + 60_000) } });
    const actor = { id: userId, sessionId: keep.id };
    expect(await errorCode(changePassword(actor, "Yanlis!99", "Yeni#Sifre1"))).toBe("WRONG_PASSWORD");
    await changePassword(actor, "Kahve!42", "Yeni#Sifre1");
    expect(await db.session.findMany({ where: { userId }, select: { id: true } })).toEqual([{ id: keep.id }]);
  });

  it("mail değiştir: başka üniversite reddedilir; aynı üniversite + OTP ile değişir, tip güncellenir", async () => {
    const { userId } = await registerAndVerify();
    const actor = { id: userId, sessionId: "s" };
    expect(await errorCode(requestEmailChange(actor, "x@ogr.baska.edu.tr"))).toBe("EMAIL_NOT_ALLOWED");
    expect(await errorCode(requestEmailChange(actor, "x@gmail.com"))).toBe("EMAIL_NOT_ALLOWED");

    const newEmail = "ayse@mezun.test.edu.tr";
    await requestEmailChange(actor, newEmail);
    await confirmEmailChange(actor, newEmail, codeFrom(newEmail));
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({ email: newEmail, type: "ALUMNI" });
    expect(lastMailTo(EMAIL)?.subject).toMatch(/e-posta adresin değiştirildi/);
  });

  it("mail değiştir: başka kullanıcının kodu kullanılamaz", async () => {
    const a = await registerAndVerify();
    const b = await registerAndVerify({ email: "20230002@ogr.test.edu.tr", studentNo: "20230002" });
    const newEmail = "yeni@ogr.test.edu.tr";
    await requestEmailChange({ id: a.userId, sessionId: "s" }, newEmail);
    expect(await errorCode(confirmEmailChange({ id: b.userId, sessionId: "s" }, newEmail, codeFrom(newEmail)))).toBe("OTP_EXPIRED");
  });
});
