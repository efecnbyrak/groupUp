import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { getOwnProfile, removeAvatar, setAvatar, updateProfile } from "@/modules/profile";

import { createActiveUser, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;
let user: { id: string };

beforeEach(async () => {
  fx = await resetDatabase();
  user = await createActiveUser(fx.university.id, "u@ogr.test.edu.tr");
});

const base = () => ({
  firstName: "Ayşe",
  lastName: "Yılmaz",
  studentNo: "20230001",
  departmentId: fx.departmentId,
  classYear: 3,
  graduationYear: undefined,
  phone: "+905551234567",
  gender: "FEMALE" as const,
  birthDate: new Date("2004-05-10T00:00:00Z"),
  bio: "Merhaba",
});

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();

describe("profil düzenleme", () => {
  it("bölümden fakülteyi türetir, alanları günceller ve audit yazar", async () => {
    await updateProfile(user, base());
    const p = (await getOwnProfile(user.id))?.profile;
    expect(p).toMatchObject({ firstName: "Ayşe", facultyId: fx.facultyId, departmentId: fx.departmentId, classYear: 3, graduationYear: null, bio: "Merhaba" });
    expect(await db.auditLog.count({ where: { action: "profile.updated" } })).toBe(1);
  });

  it("başka üniversitenin bölümünü reddeder", async () => {
    const foreign = await db.faculty.create({ data: { universityId: fx.other.id, nameTr: "F", departments: { create: { nameTr: "D" } } }, include: { departments: true } });
    expect(await errorCode(updateProfile(user, { ...base(), departmentId: foreign.departments[0]!.id }))).toBe("INVALID_FIELDS");
  });

  it("öğrenci sınıfsız, mezun mezuniyet yılsız kaydedemez", async () => {
    expect(await errorCode(updateProfile(user, { ...base(), classYear: undefined }))).toBe("INVALID_FIELDS");
    const alumni = await createActiveUser(fx.university.id, "m@mezun.test.edu.tr", { type: "ALUMNI" });
    expect(await errorCode(updateProfile(alumni, { ...base(), classYear: undefined }))).toBe("INVALID_FIELDS");
    await updateProfile(alumni, { ...base(), classYear: 2, graduationYear: 2020 });
    expect((await getOwnProfile(alumni.id))?.profile).toMatchObject({ graduationYear: 2020, classYear: null });
  });
});

describe("avatar", () => {
  it("256×256 WebP'ye çevirir, public storage'a yazar; yenisi eskisini siler", async () => {
    const first = await setAvatar(user, await png(800, 400));
    const stored = await getStorage().get(first, "public");
    expect(stored?.contentType).toBe("image/webp");
    const meta = await sharp(stored!.body).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
    expect(meta.exif).toBeUndefined();

    const second = await setAvatar(user, await png(300, 300));
    expect(second).not.toBe(first);
    expect(await getStorage().get(first, "public")).toBeNull();
    expect((await db.profile.findUniqueOrThrow({ where: { userId: user.id } })).avatarKey).toBe(second);

    await removeAvatar(user);
    expect(await getStorage().get(second, "public")).toBeNull();
    expect((await db.profile.findUniqueOrThrow({ where: { userId: user.id } })).avatarKey).toBeNull();
  });

  it("görsel olmayan, PDF ve bozuk dosyaları reddeder", async () => {
    expect(await errorCode(setAvatar(user, Buffer.from("<svg onload=alert(1)>")))).toBe("FILE_TYPE");
    expect(await errorCode(setAvatar(user, Buffer.from("%PDF-1.7 ...")))).toBe("FILE_TYPE");
    expect(await errorCode(setAvatar(user, Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])))).toBe("FILE_INVALID");
    expect(await errorCode(setAvatar(user, Buffer.alloc(0)))).toBe("FILE_INVALID");
    expect((await db.profile.findUniqueOrThrow({ where: { userId: user.id } })).avatarKey).toBeNull();
  });
});
