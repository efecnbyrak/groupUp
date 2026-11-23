import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getStorage } from "@/lib/storage";
import { confirmAccountDeletion, isDeleteTokenValid, listSessions, login, requestAccountDeletion, revokeSession } from "@/modules/identity";
import { setAvatar } from "@/modules/profile";

import { clubFixture, createActiveUser, errorCode, lastMailTo, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
const PASSWORD = "Kahve!42";
const EMAIL = "u@ogr.test.edu.tr";

beforeEach(async () => {
  fx = await resetDatabase();
});

async function userWithPassword(email = EMAIL, role: "USER" | "SUPER_ADMIN" = "USER") {
  const user = await createActiveUser(role === "SUPER_ADMIN" ? null : fx.university.id, email, { platformRole: role });
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
  return user;
}

const session = (userId: string, ua: string, hash: string) =>
  db.session.create({ data: { userId, tokenHash: hash, userAgent: ua, expiresAt: new Date(Date.now() + 86_400_000) } });

/** Mailden silme bağlantısındaki token. */
function deleteTokenFor(email: string): string {
  const token = lastMailTo(email)?.text.match(/token=([\w%-]+)/)?.[1];
  if (!token) throw new Error("silme maili yok");
  return decodeURIComponent(token);
}

describe("aktif oturumlar", () => {
  it("listeler, mevcut oturumu işaretler, süresi dolanı göstermez", async () => {
    const user = await userWithPassword();
    const a = await session(user.id, "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36", "h1");
    await session(user.id, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/604.1", "h2");
    await db.session.create({ data: { userId: user.id, tokenHash: "h3", expiresAt: new Date(Date.now() - 1000) } });
    const rows = await listSessions(user.id, a.id, new Date());
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ current: true, device: { browser: "Chrome", os: "Windows" } });
  });

  it("yalnızca kendi oturumunu kapatabilir", async () => {
    const user = await userWithPassword();
    const other = await userWithPassword("b@ogr.test.edu.tr");
    const theirs = await session(other.id, "x", "o1");
    expect(await errorCode(revokeSession(user.id, theirs.id))).toBe("NOT_FOUND");
    expect(await db.session.count({ where: { id: theirs.id } })).toBe(1);
    const mine = await session(user.id, "x", "m1");
    await revokeSession(user.id, mine.id);
    expect(await db.session.count({ where: { id: mine.id } })).toBe(0);
  });
});

describe("hesap silme", () => {
  it("yanlış şifrede link göndermez", async () => {
    const user = await userWithPassword();
    expect(await errorCode(requestAccountDeletion(user, "Yanlis!1"))).toBe("WRONG_PASSWORD");
    expect(lastMailTo(EMAIL)).toBeUndefined();
  });

  it("link → anonimleştirme: giriş yapılamaz, PII ve avatar silinir, Admin rolü ve oturumlar kalkar", async () => {
    const user = await userWithPassword();
    await db.profile.update({ where: { userId: user.id }, data: { phone: "+905551234567", studentNo: "20230001", facultyId: fx.facultyId, departmentId: fx.departmentId, bio: "x" } });
    const avatarKey = await setAvatar(user, await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff0000" } }).png().toBuffer());
    await db.universityAdmin.create({ data: { universityId: fx.university.id, userId: user.id } });
    await session(user.id, "x", "s1");

    await requestAccountDeletion(user, PASSWORD);
    const token = deleteTokenFor(EMAIL);
    expect(await isDeleteTokenValid(token)).toBe(true);
    await confirmAccountDeletion(token);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true } });
    expect(after.status).toBe("DELETED");
    expect(after.deletedAt).not.toBeNull();
    expect(after.email).toBe(`deleted+${user.id}@deleted.invalid`);
    expect(after.profile).toMatchObject({ firstName: "Silinmiş", lastName: "kullanıcı", phone: null, studentNo: null, bio: null, avatarKey: null, facultyId: null });
    expect(await getStorage().get(avatarKey, "public")).toBeNull();
    expect(await db.universityAdmin.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await errorCode(login(EMAIL, PASSWORD))).toBe("LOGIN_INVALID");
    expect(await db.auditLog.count({ where: { action: "identity.account.deleted", targetId: user.id } })).toBe(1);
    // Aynı e-posta ile yeniden kayıt mümkün (adres serbest kaldı).
    expect(await db.user.findUnique({ where: { email: EMAIL } })).toBeNull();
  });

  it("token tek kullanımlık; süresi dolan ve yeni istekle geçersizleşen token reddedilir", async () => {
    const user = await userWithPassword();
    await requestAccountDeletion(user, PASSWORD);
    const first = deleteTokenFor(EMAIL);
    await requestAccountDeletion(user, PASSWORD);
    const second = deleteTokenFor(EMAIL);
    expect(await errorCode(confirmAccountDeletion(first))).toBe("DELETE_TOKEN_INVALID");
    await db.emailToken.updateMany({ where: { purpose: "DELETE_ACCOUNT", usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await errorCode(confirmAccountDeletion(second))).toBe("DELETE_TOKEN_INVALID");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE");
  });

  it("son Süper Admin silinemez; başka Süper Admin varsa silinebilir", async () => {
    const sa = await userWithPassword("sa@groupup.local", "SUPER_ADMIN");
    expect(await errorCode(requestAccountDeletion(sa, PASSWORD))).toBe("LAST_SUPER_ADMIN");
    await userWithPassword("sa2@groupup.local", "SUPER_ADMIN");
    expect(await errorCode(requestAccountDeletion(sa, PASSWORD))).toBe("NO_ERROR");
  });

  it("kulüp başkanı önce devretmeli; üye silinince üyelik LEFT, görevlilik silinir", async () => {
    const { club, president, members } = await clubFixture(fx.university.id, { members: 1 });
    await db.user.update({ where: { id: president.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    expect(await errorCode(requestAccountDeletion(president, PASSWORD))).toBe("PRESIDENT_MUST_TRANSFER");

    const member = members[0]!;
    await db.user.update({ where: { id: member.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    await db.staffAssignment.create({ data: { clubId: club.id, userId: member.id, title: "Sayman", permissions: [] } });
    await requestAccountDeletion(member, PASSWORD);
    await confirmAccountDeletion(deleteTokenFor(member.email));
    expect((await db.membership.findFirstOrThrow({ where: { clubId: club.id, userId: member.id } })).status).toBe("LEFT");
    expect(await db.staffAssignment.count({ where: { userId: member.id } })).toBe(0);
  });
});
