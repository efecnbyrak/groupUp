import { db } from "@/lib/db";
import { getMailProvider } from "@/lib/mail";
import type { ConsoleMailProvider } from "@/lib/mail/console";

/** Her testten önce: kimlik tablolarını boşaltır, örnek üniversite kurar. */
export async function resetDatabase() {
  await db.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "RateLimit", "EmailToken", "Session", "AlumniVerification", "Profile", "UniversityAdmin", "User",
      "Department", "Faculty", "UniversityDomain", "UniversityRequest", "University", "ClubCategory", "EventCategory" CASCADE`,
  );
  mailbox().length = 0;
  const university = await db.university.create({
    data: {
      name: "Test Üniversitesi",
      slug: "test-universitesi",
      domains: {
        create: [
          { domain: "ogr.test.edu.tr", type: "STUDENT" },
          { domain: "mezun.test.edu.tr", type: "ALUMNI" },
        ],
      },
      faculties: {
        create: [{ nameTr: "Mühendislik Fakültesi", departments: { create: [{ nameTr: "Bilgisayar Mühendisliği" }] } }],
      },
    },
    include: { faculties: { include: { departments: true } } },
  });
  const other = await db.university.create({
    data: { name: "Başka Üniversite", slug: "baska", domains: { create: [{ domain: "ogr.baska.edu.tr", type: "STUDENT" }] } },
  });
  const faculty = university.faculties[0]!;
  return { university, other, facultyId: faculty.id, departmentId: faculty.departments[0]!.id };
}

export function mailbox() {
  return (getMailProvider() as ConsoleMailProvider).sent;
}

export function lastMailTo(email: string) {
  return [...mailbox()].reverse().find((m) => m.to === email);
}

export function codeFrom(email: string): string {
  const mail = lastMailTo(email);
  const code = mail?.text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error(`${email} için OTP maili bulunamadı`);
  return code;
}

export function registerInput(fixture: { facultyId: string; departmentId: string }, overrides: Record<string, unknown> = {}) {
  return {
    email: "20230001@ogr.test.edu.tr",
    firstName: "Ayşe",
    lastName: "Yılmaz",
    studentNo: "20230001",
    facultyId: fixture.facultyId,
    departmentId: fixture.departmentId,
    classYear: 2,
    graduationYear: undefined,
    phone: "+905551234567",
    gender: "FEMALE" as const,
    birthDate: new Date("2004-05-10T00:00:00.000Z"),
    password: "Kahve!42",
    passwordConfirm: "Kahve!42",
    kvkk: "on" as const,
    ...overrides,
  };
}

/** Rate limit pencerelerini sıfırlar (zamanı ilerletmek yerine). */
export async function expireRateLimits(prefix: string) {
  await db.rateLimit.updateMany({ where: { key: { startsWith: prefix } }, data: { windowEnd: new Date(Date.now() - 1000) } });
}

/** Doğrudan ACTIVE kullanıcı oluşturur (kayıt akışını test etmeyen testler için). */
export async function createActiveUser(universityId: string | null, email: string, extra: { firstName?: string; platformRole?: "USER" | "SUPER_ADMIN"; type?: "STUDENT" | "ALUMNI" } = {}) {
  const now = new Date();
  return db.user.create({
    data: {
      email,
      passwordHash: "x",
      status: "ACTIVE",
      emailVerifiedAt: now,
      universityId,
      platformRole: extra.platformRole ?? "USER",
      type: extra.type ?? "STUDENT",
      profile: { create: { firstName: extra.firstName ?? "Test", lastName: "Kullanıcı", kvkkConsentAt: now } },
    },
  });
}

/** Servis hata kodunu döndürür (başarılıysa "NO_ERROR"). */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "NO_ERROR";
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") return (err as { code: string }).code;
    return String(err);
  }
}
