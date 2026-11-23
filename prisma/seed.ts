// Seed — docs/DATA-MODEL.md §Seed (F2). İdempotent: tekrar çalıştırmak güvenlidir.
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";

const KENT = {
  slug: "istanbul-kent-universitesi",
  name: "İstanbul Kent Üniversitesi",
  city: "İstanbul",
  domains: [
    { domain: "ogr.kent.edu.tr", type: "STUDENT" as const },
    { domain: "mezun.kent.edu.tr", type: "ALUMNI" as const },
  ],
  // ÖRNEK fakülte/bölüm listesi — gerçek liste Admin panelinden yönetilir (F4).
  faculties: [
    {
      nameTr: "Mühendislik ve Doğa Bilimleri Fakültesi",
      nameEn: "Faculty of Engineering and Natural Sciences",
      departments: [
        { nameTr: "Bilgisayar Mühendisliği", nameEn: "Computer Engineering" },
        { nameTr: "Yazılım Mühendisliği", nameEn: "Software Engineering" },
      ],
    },
    {
      nameTr: "İktisadi, İdari ve Sosyal Bilimler Fakültesi",
      nameEn: "Faculty of Economics, Administrative and Social Sciences",
      departments: [
        { nameTr: "İşletme", nameEn: "Business Administration" },
        { nameTr: "Psikoloji", nameEn: "Psychology" },
      ],
    },
    {
      nameTr: "Sağlık Bilimleri Fakültesi",
      nameEn: "Faculty of Health Sciences",
      departments: [
        { nameTr: "Beslenme ve Diyetetik", nameEn: "Nutrition and Dietetics" },
        { nameTr: "Fizyoterapi ve Rehabilitasyon", nameEn: "Physiotherapy and Rehabilitation" },
      ],
    },
  ],
};

async function seedSuperAdmin() {
  const email = env.SUPERADMIN_EMAIL?.toLowerCase();
  const password = env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SUPERADMIN_EMAIL ve SUPERADMIN_PASSWORD .env'de tanımlı olmalı");
  }
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { platformRole: "SUPER_ADMIN", status: "ACTIVE" } });
    console.info(`[seed] Süper Admin mevcut: ${email} (şifre değiştirilmedi)`);
    return;
  }
  const now = new Date();
  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      platformRole: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: now,
      profile: { create: { firstName: "Süper", lastName: "Admin", kvkkConsentAt: now } },
    },
  });
  console.info(`[seed] Süper Admin oluşturuldu: ${email}`);
}

async function seedKent() {
  const university = await db.university.upsert({
    where: { slug: KENT.slug },
    update: { name: KENT.name, city: KENT.city },
    create: { slug: KENT.slug, name: KENT.name, city: KENT.city, alumniVerifyMode: "BOTH" },
  });
  for (const d of KENT.domains) {
    await db.universityDomain.upsert({
      where: { domain: d.domain },
      update: { type: d.type, universityId: university.id },
      create: { ...d, universityId: university.id },
    });
  }
  for (const f of KENT.faculties) {
    const faculty = await db.faculty.upsert({
      where: { universityId_nameTr: { universityId: university.id, nameTr: f.nameTr } },
      update: { nameEn: f.nameEn },
      create: { universityId: university.id, nameTr: f.nameTr, nameEn: f.nameEn },
    });
    for (const dep of f.departments) {
      await db.department.upsert({
        where: { facultyId_nameTr: { facultyId: faculty.id, nameTr: dep.nameTr } },
        update: { nameEn: dep.nameEn },
        create: { facultyId: faculty.id, ...dep },
      });
    }
  }
  console.info(`[seed] ${KENT.name}: ${KENT.domains.length} domain, ${KENT.faculties.length} fakülte`);
}

async function main() {
  await seedSuperAdmin();
  await seedKent();
  // Kulüp kategorileri F5'te, etkinlik kategorileri F6'da eklenir.
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
