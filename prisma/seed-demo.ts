// Demo verisi — `npm run db:seed:demo`. Yalnızca geliştirme (NODE_ENV !== production). İdempotent:
// kayıtlar doğal anahtarla bulunur, yoksa oluşturulur; demo sırasında yapılan işlemler (onay, katılım)
// tekrar çalıştırmada geri alınmaz. Tüm demo.* hesaplarının şifresi .env → DEMO_PASSWORD.
// Her faz kendi demo verisini buraya ekler (F5: kulüpler, üyeler, ekip, talepler, ticket, bekleyen mezun).
import sharp from "sharp";

import type { SessionUser } from "../src/lib/authz";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import { decideRequest, submitRequest } from "../src/modules/approval";
import { createClub, storeClubImage, textToDoc } from "../src/modules/club";
import { openAdminTicket, openClubTicket, replyTicket } from "../src/modules/ticket";

const KENT_SLUG = "istanbul-kent-universitesi";
const S = "ogr.kent.edu.tr";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n% groupUp demo belgesi\ntrailer << /Root 1 0 R >>\n%%EOF\n");

type Spec = { email: string; firstName: string; lastName: string; type?: "STUDENT" | "ALUMNI"; status?: "ACTIVE" | "PENDING_ALUMNI_REVIEW"; classYear?: number; graduationYear?: number };

const PEOPLE: Spec[] = [
  { email: `demo.admin@${S}`, firstName: "Ece", lastName: "Demir", classYear: 4 },
  { email: `demo.baskan@${S}`, firstName: "Mert", lastName: "Yıldız", classYear: 3 },
  { email: `demo.gorevli@${S}`, firstName: "Zeynep", lastName: "Kaya", classYear: 2 },
  { email: `demo.uye@${S}`, firstName: "Can", lastName: "Aydın", classYear: 1 },
  { email: "demo.mezun@mezun.kent.edu.tr", firstName: "Selin", lastName: "Arslan", type: "ALUMNI", graduationYear: 2023 },
  { email: "demo.bekleyen.mezun@example.com", firstName: "Burak", lastName: "Şahin", type: "ALUMNI", status: "PENDING_ALUMNI_REVIEW", graduationYear: 2021 },
];
const FILLER = [
  ["Elif", "Çelik"], ["Emre", "Koç"], ["Defne", "Öztürk"], ["Kerem", "Aksoy"], ["Ada", "Polat"], ["Arda", "Kurt"], ["Nehir", "Erdoğan"], ["Deniz", "Güneş"],
  ["Yusuf", "Taş"], ["Ela", "Bulut"], ["Ömer", "Kılıç"], ["Lina", "Yalçın"], ["Efe", "Doğan"], ["Asya", "Uçar"], ["Kaan", "Özkan"], ["Mira", "Turan"],
] as const;
FILLER.forEach(([firstName, lastName], i) => PEOPLE.push({ email: `demo.ogrenci${String(i + 1).padStart(2, "0")}@${S}`, firstName, lastName, classYear: (i % 4) + 1 }));

const CLUBS = [
  { slug: "kent-spor", name: "Kent Spor Kulübü", category: "spor", president: `demo.baskan@${S}`, invite: "SPRDEM26", color: "#047857",
    short: "Futbol, basketbol ve voleybol takımlarıyla kampüsün spor merkezi.",
    description: "Kent Spor Kulübü olarak her dönem kampüs içi turnuvalar düzenliyor, üniversite liglerine takım çıkarıyoruz.\n\nAntrenmanlar haftada iki gün spor salonunda. Her seviyeden öğrenciye açığız.",
    instagram: "kentspor", members: ["demo.gorevli", "demo.uye", "demo.ogrenci04", "demo.ogrenci05", "demo.ogrenci06", "demo.ogrenci09", "demo.ogrenci10", "demo.ogrenci13"] },
  { slug: "yazilim-yapay-zeka", name: "Yazılım ve Yapay Zekâ Kulübü", category: "bilim-teknoloji", president: `demo.ogrenci01@${S}`, invite: "YAZDEM26", color: "#1d4ed8",
    short: "Hackathonlar, atölyeler ve açık kaynak projelerle yazılım topluluğu.",
    description: "Her ay bir atölye, her dönem bir hackathon. Web, mobil ve yapay zekâ çalışma grupları var.\n\nMezunlarımız mentor olarak destek veriyor.",
    instagram: "kentyazilim", members: ["demo.uye", "demo.ogrenci07", "demo.ogrenci08", "demo.ogrenci11", "demo.ogrenci12", "demo.mezun"] },
  { slug: "fotograf-sinema", name: "Fotoğrafçılık ve Sinema Kulübü", category: "kultur-sanat", president: `demo.ogrenci02@${S}`, invite: "FTGDEM26", color: "#b45309",
    short: "Foto gezileri, kısa film atölyeleri ve kampüs sergileri.",
    description: "İstanbul'un farklı semtlerine foto gezileri düzenliyor, dönem sonunda kampüste sergi açıyoruz.",
    instagram: null, members: ["demo.uye", "demo.ogrenci14", "demo.ogrenci15"] },
  { slug: "toplum-gonulluleri", name: "Toplum Gönüllüleri Kulübü", category: "sosyal-sorumluluk", president: `demo.ogrenci03@${S}`, invite: "GNRDEM26", color: "#be123c",
    short: "Eğitim, çevre ve hayvan hakları alanlarında gönüllü projeler.",
    description: "Köy okullarına kitap kampanyası, sahil temizliği ve barınak ziyaretleri düzenliyoruz.",
    instagram: "kentgonullu", members: ["demo.ogrenci16", "demo.ogrenci10"] },
];

const emailOf = (local: string) => (local.includes("@") ? local : local === "demo.mezun" ? "demo.mezun@mezun.kent.edu.tr" : `${local}@${S}`);

function asSessionUser(u: { id: string; email: string; universityId: string | null }): SessionUser {
  return { sessionId: "seed", id: u.id, email: u.email, platformRole: "USER", type: "STUDENT", status: "ACTIVE", emailVerified: true, universityId: u.universityId, locale: "tr", firstName: null, lastName: null, avatarKey: null };
}

async function logo(name: string, color: string): Promise<Buffer> {
  const initials = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).slice(0, 2).map((w) => w[0]).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="${color}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="200" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function cover(color: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="1600" height="600" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  if (env.NODE_ENV === "production") throw new Error("seed-demo canlı ortamda çalıştırılamaz");
  if (!env.DEMO_PASSWORD) throw new Error("DEMO_PASSWORD .env'de tanımlı olmalı (bkz. .env.example)");
  const university = await db.university.findUnique({ where: { slug: KENT_SLUG }, include: { faculties: { include: { departments: true }, orderBy: { nameTr: "asc" } } } });
  if (!university) throw new Error("Önce `npm run db:seed` çalıştırın (Kent Üniversitesi yok)");
  const faculties = university.faculties.filter((f) => f.departments.length > 0);
  if (faculties.length === 0) throw new Error("Kent Üniversitesi'nde bölümü olan fakülte yok — önce `npm run db:seed`");
  const passwordHash = await hashPassword(env.DEMO_PASSWORD);
  const now = new Date();

  // ------------------------------------------------------------ e2e artıkları (dev DB'yi paylaşır; demo listelerini kirletmesin)
  const e2eClubs = await db.club.findMany({ where: { slug: { startsWith: "e2e-kulubu-" } }, select: { id: true } });
  if (e2eClubs.length) {
    const ids = e2eClubs.map((c) => c.id);
    await db.$transaction([db.changeRequest.deleteMany({ where: { clubId: { in: ids } } }), db.ticket.deleteMany({ where: { clubId: { in: ids } } }), db.club.deleteMany({ where: { id: { in: ids } } })]);
    console.info(`[seed-demo] ${ids.length} e2e kulübü temizlendi`);
  }

  // ------------------------------------------------------------ Hesaplar
  const users = new Map<string, { id: string; email: string; universityId: string | null }>();
  for (const [i, p] of PEOPLE.entries()) {
    const faculty = faculties[i % faculties.length]!;
    const department = faculty.departments[0]!;
    const existing = await db.user.findUnique({ where: { email: p.email }, select: { id: true } });
    const user = existing
      ? await db.user.update({ where: { email: p.email }, data: { passwordHash }, select: { id: true, email: true, universityId: true } })
      : await db.user.create({
          data: { email: p.email, passwordHash, status: p.status ?? "ACTIVE", type: p.type ?? "STUDENT", universityId: university.id, emailVerifiedAt: now },
          select: { id: true, email: true, universityId: true },
        });
    await db.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        firstName: p.firstName,
        lastName: p.lastName,
        studentNo: p.type === "ALUMNI" ? null : `2023${String(1000 + i)}`,
        facultyId: faculty.id,
        departmentId: department.id,
        classYear: p.classYear ?? null,
        graduationYear: p.graduationYear ?? null,
        kvkkConsentAt: now,
      },
    });
    users.set(p.email, user);
  }
  const u = (local: string) => users.get(emailOf(local))!;
  const admin = u("demo.admin");
  await db.universityAdmin.upsert({ where: { universityId_userId: { universityId: university.id, userId: admin.id } }, update: {}, create: { universityId: university.id, userId: admin.id } });

  // ------------------------------------------------------------ Kulüpler, üyeler, davet kodları
  const clubs = new Map<string, { id: string }>();
  for (const c of CLUBS) {
    const category = await db.clubCategory.findUniqueOrThrow({ where: { slug: c.category } });
    let club = await db.club.findUnique({ where: { slug: c.slug }, select: { id: true, logoKey: true, coverKey: true } });
    if (!club) {
      const created = await createClub(admin, { universityId: university.id, name: c.name, slug: c.slug, categoryId: category.id, shortDescTr: c.short, presidentEmail: c.president });
      await db.club.update({ where: { id: created.id }, data: { descriptionTr: textToDoc(c.description) ?? undefined, instagram: c.instagram, contactEmail: `${c.slug}@kulup.kent.edu.tr` } });
      club = { id: created.id, logoKey: null, coverKey: null };
    }
    if (!club.logoKey) await db.club.update({ where: { id: club.id }, data: { logoKey: await storeClubImage(club.id, "logo", await logo(c.name, c.color)) } });
    if (!club.coverKey) await db.club.update({ where: { id: club.id }, data: { coverKey: await storeClubImage(club.id, "cover", await cover(c.color)) } });
    for (const m of c.members) {
      await db.membership.upsert({ where: { clubId_userId: { clubId: club.id, userId: u(m).id } }, update: {}, create: { clubId: club.id, userId: u(m).id, joinedVia: "code" } });
    }
    await db.clubInvite.upsert({ where: { code: c.invite }, update: {}, create: { clubId: club.id, code: c.invite, createdById: u(c.president).id, expiresAt: null } });
    clubs.set(c.slug, club);
  }
  const spor = clubs.get("kent-spor")!;
  const yazilim = clubs.get("yazilim-yapay-zeka")!;
  await db.staffAssignment.upsert({
    where: { clubId_userId: { clubId: spor.id, userId: u("demo.gorevli").id } },
    update: {},
    create: { clubId: spor.id, userId: u("demo.gorevli").id, title: "Etkinlik Koordinatörü", permissions: ["EVENT_MANAGE", "MEMBER_INVITE", "TICKET_OPEN", "REGISTRATION_VIEW"] },
  });

  // ------------------------------------------------------------ Onay talepleri (yalnızca hiç yoksa)
  const never = async (type: "STAFF_ASSIGN" | "CLUB_UPDATE" | "MEMBER_REMOVE" | "ALUMNI_VERIFY", targetId: string, clubId: string | null) =>
    (await db.changeRequest.count({ where: { type, targetId, clubId } })) === 0;
  const baskan = u("demo.baskan");

  if (await never("STAFF_ASSIGN", u("demo.ogrenci05").id, spor.id)) {
    await submitRequest(baskan, { type: "STAFF_ASSIGN", universityId: university.id, clubId: spor.id, payload: { userId: u("demo.ogrenci05").id, title: "Turnuva Sorumlusu", permissions: ["TOURNAMENT_MANAGE", "REGISTRATION_VIEW"], before: null } });
  }
  if (await never("CLUB_UPDATE", spor.id, spor.id)) {
    const current = await db.club.findUniqueOrThrow({ where: { id: spor.id }, select: { shortDescTr: true, instagram: true } });
    await submitRequest(baskan, {
      type: "CLUB_UPDATE",
      universityId: university.id,
      clubId: spor.id,
      payload: { before: { shortDescTr: current.shortDescTr, instagram: current.instagram }, after: { shortDescTr: "Futbol, basketbol, voleybol ve masa tenisi takımlarıyla kampüsün spor merkezi.", instagram: "kentsporkulubu" } },
    });
  }
  if (await never("MEMBER_REMOVE", u("demo.ogrenci06").id, spor.id)) {
    await submitRequest(baskan, {
      type: "MEMBER_REMOVE",
      universityId: university.id,
      clubId: spor.id,
      payload: { userId: u("demo.ogrenci06").id },
      reason: "Son üç antrenmanda takım arkadaşlarına karşı sportmenlik dışı davranış; tutanak ekte.",
      files: [{ name: "tutanak.pdf", body: PDF }],
    });
  }
  // Geçmiş: biri onaylanmış, biri gerekçeyle reddedilmiş (Yazılım kulübü)
  const yzBaskan = u("demo.ogrenci01");
  if (await never("STAFF_ASSIGN", u("demo.ogrenci07").id, yazilim.id)) {
    const { id } = await submitRequest(yzBaskan, { type: "STAFF_ASSIGN", universityId: university.id, clubId: yazilim.id, payload: { userId: u("demo.ogrenci07").id, title: "Atölye Sorumlusu", permissions: ["EVENT_MANAGE"], before: null } });
    await decideRequest(admin, university.id, id, "APPROVE", null);
  }
  if (await never("STAFF_ASSIGN", u("demo.ogrenci08").id, yazilim.id)) {
    const { id } = await submitRequest(yzBaskan, { type: "STAFF_ASSIGN", universityId: university.id, clubId: yazilim.id, payload: { userId: u("demo.ogrenci08").id, title: "Sosyal Medya", permissions: ["ANNOUNCEMENT_POST", "MEMBER_INVITE"], before: null } });
    await decideRequest(admin, university.id, id, "REJECT", "Davet yetkisi için önce bir dönem aktif üyelik bekliyoruz; duyuru yetkisiyle yeniden gönderebilirsiniz.");
  }
  const bekleyen = u("demo.bekleyen.mezun@example.com");
  const bekleyenStatus = (await db.user.findUniqueOrThrow({ where: { id: bekleyen.id }, select: { status: true } })).status;
  if (bekleyenStatus === "PENDING_ALUMNI_REVIEW" && (await never("ALUMNI_VERIFY", bekleyen.id, null))) {
    await submitRequest(bekleyen, { type: "ALUMNI_VERIFY", universityId: university.id, clubId: null, payload: {}, files: [{ name: "mezuniyet-belgesi.pdf", body: PDF }] });
  }

  // ------------------------------------------------------------ Destek talepleri
  if ((await db.ticket.count({ where: { clubId: spor.id } })) === 0) {
    const id = await openClubTicket(baskan, spor.id, { category: "TOURNAMENT", subject: "Bahar turnuvası için spor salonu rezervasyonu", body: "Merhaba, 15–17 Mart tarihlerinde salonu turnuva için kullanmak istiyoruz. Rezervasyonu nasıl yapabiliriz?", changeRequestId: null });
    await replyTicket(asSessionUser(admin), id, "Merhaba, Sağlık Kültür Spor Daire Başkanlığı ile görüştük; tarihler uygun. Resmi yazıyı bu hafta ileteceğiz.");
  }
  if ((await db.ticket.count({ where: { universityId: university.id, scope: "ADMIN_TO_PLATFORM" } })) === 0) {
    await openAdminTicket(admin, university.id, { category: "TECHNICAL", subject: "Lisansüstü öğrenciler için ek domain", body: "Lisansüstü öğrencilerimiz @lisansustu.kent.edu.tr kullanıyor. Bu domaini öğrenci domaini olarak ekleyebilir misiniz?", changeRequestId: null });
  }

  const counts = { users: users.size, clubs: clubs.size, pending: await db.changeRequest.count({ where: { universityId: university.id, status: "PENDING" } }) };
  console.info(`[seed-demo] ${counts.users} hesap, ${counts.clubs} kulüp, ${counts.pending} bekleyen talep. Şifre: .env → DEMO_PASSWORD`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
