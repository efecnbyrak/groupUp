// Demo verisi — `npm run db:seed:demo`. Yalnızca geliştirme (NODE_ENV !== production). İdempotent:
// kayıtlar doğal anahtarla bulunur, yoksa oluşturulur; demo sırasında yapılan işlemler (onay, katılım)
// tekrar çalıştırmada geri alınmaz. Tüm demo.* hesaplarının şifresi .env → DEMO_PASSWORD.
// Her faz kendi demo verisini buraya ekler (F5: kulüpler, üyeler, ekip, talepler, ticket, bekleyen mezun;
// F6: etkinlikler — taslak, onay bekleyen, yayında, geçmiş — ve duyurular;
// F7: başvuru formu alanları, bireysel başvurular, takımlar (tamamlanmış + eksik üyeli)).
import sharp from "sharp";

import type { SessionUser } from "../src/lib/authz";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import { decideRequest, submitRequest } from "../src/modules/approval";
import { createClub, storeClubImage, textToDoc } from "../src/modules/club";
import { createAnnouncement, createEventDraft, saveEventDraft, storeEventImage, type EventContent } from "../src/modules/event";
import { applyToEvent, completeTeam, createField, createTeam, joinTeam } from "../src/modules/registration";
import { openAdminTicket, openClubTicket, replyTicket } from "../src/modules/ticket";
import { createTournament, generateBracket, getStageMatches, recordScore, updateGroupsSettings } from "../src/modules/tournament";

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

async function eventCover(color: string, label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><text x="80" y="780" font-family="Inter, Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const para = (...texts: string[]) => ({ type: "doc" as const, content: texts.map((text) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] })) });
const H = 3600_000;
const D = 24 * H;

type DemoEvent = {
  club: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  body: string[];
  color: string;
  /** başlangıç (şimdiden gün) */
  startIn: number;
  /** başvuru: açılış ve kapanış (şimdiden saat) */
  opensIn: number;
  closesIn: number;
  target: "DRAFT" | "PENDING" | "PUBLISHED" | "COMPLETED";
  over?: Partial<EventContent>;
};

const EVENTS: DemoEvent[] = [
  { club: "kent-spor", slug: "bahar-futbol-turnuvasi", category: "futbol", title: "Bahar Futbol Turnuvası", summary: "Fakülteler arası halı saha turnuvası — 5+2 kişilik takımlarla kaydol.", body: ["Turnuva tek eleme usulüyle oynanır, maçlar 2×20 dakikadır.", "Her takım en az 5, en çok 7 oyuncudan oluşur. Formalar kulüpten."], color: "#047857", startIn: 12, opensIn: -48, closesIn: 5 * 24, target: "PUBLISHED", over: { mode: "TEAM", teamMinSize: 5, teamMaxSize: 7, capacity: 16 } },
  { club: "kent-spor", slug: "masa-tenisi-turnuvasi", category: "masa-tenisi", title: "Masa Tenisi Turnuvası", summary: "Bireysel masa tenisi turnuvası; son başvuru yarın!", body: ["Grup aşaması ve eleme turları spor salonunda oynanacak.", "Raketler kulüpten temin edilebilir."], color: "#0f766e", startIn: 4, opensIn: -72, closesIn: 30, target: "PUBLISHED", over: { capacity: 32 } },
  { club: "kent-spor", slug: "basketbol-3x3", category: "basketbol", title: "3x3 Basketbol Şenliği", summary: "Kampüs avlusunda 3x3 sokak basketbolu.", body: ["Takımlar 3 asıl + 1 yedek oyuncudan oluşur."], color: "#c2410c", startIn: 20, opensIn: 24, closesIn: 14 * 24, target: "PENDING", over: { mode: "TEAM", teamMinSize: 3, teamMaxSize: 4, capacity: 12 } },
  { club: "kent-spor", slug: "voleybol-dostluk-maci", category: "voleybol", title: "Voleybol Dostluk Maçı", summary: "", body: [], color: "#4338ca", startIn: 30, opensIn: 0, closesIn: 0, target: "DRAFT" },
  { club: "yazilim-yapay-zeka", slug: "yapay-zeka-atolyesi", category: "workshop", title: "Yapay Zekâ ile Uygulama Geliştirme Atölyesi", summary: "Büyük dil modelleriyle ilk uygulamanı 3 saatte yaz.", body: ["Atölye online yapılacak; bağlantı kayıtlı katılımcılarla paylaşılır.", "Dizüstü bilgisayar ve temel Python bilgisi yeterli."], color: "#1d4ed8", startIn: 8, opensIn: -24, closesIn: 6 * 24, target: "PUBLISHED", over: { isOnline: true, onlineUrl: "https://meet.example.com/kent-ai", locationName: null, capacity: 40 } },
  { club: "yazilim-yapay-zeka", slug: "guz-hackathonu-2026", category: "hackathon", title: "Güz Hackathonu 2026", summary: "24 saatlik kampüs hackathonu — tamamlandı.", body: ["12 takım, 48 katılımcı. Kazananlara tebrikler!"], color: "#7c3aed", startIn: -20, opensIn: -40 * 24, closesIn: -22 * 24, target: "COMPLETED", over: { mode: "TEAM", teamMinSize: 2, teamMaxSize: 4, capacity: 12 } },
  { club: "fotograf-sinema", slug: "kadikoy-foto-gezisi", category: "gezi", title: "Kadıköy Fotoğraf Gezisi", summary: "Moda sahilinden Yeldeğirmeni'ne sokak fotoğrafçılığı yürüyüşü.", body: ["Buluşma Kadıköy iskelesi önünde.", "Telefon kamerası da olur; önemli olan bakış açısı."], color: "#b45309", startIn: 15, opensIn: 3 * 24, closesIn: 12 * 24, target: "PUBLISHED", over: { capacity: 20 } },
];

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

  const e2eEvents = await db.event.deleteMany({ where: { OR: [{ slug: { startsWith: "e2e-etkinlik-" } }, { slug: { startsWith: "e2e-bireysel-" } }, { slug: { startsWith: "e2e-takim-" } }] } });
  if (e2eEvents.count) {
    // Registration/Team/EventFormField Event'e cascade bağlı; yalnızca onay talepleri ayrıca temizlenir.
    await db.changeRequest.deleteMany({ where: { type: { in: ["EVENT_PUBLISH", "EVENT_UPDATE", "EVENT_CANCEL"] }, targetId: { notIn: (await db.event.findMany({ select: { id: true } })).map((e) => e.id) } } });
    console.info(`[seed-demo] ${e2eEvents.count} e2e etkinliği (başvuru/takım dahil) temizlendi`);
  }

  const e2eTournaments = await db.tournament.deleteMany({ where: { name: { startsWith: "E2E Turnuva " } } });
  if (e2eTournaments.count) console.info(`[seed-demo] ${e2eTournaments.count} e2e turnuvası (braket dahil) temizlendi`);

  const e2eElections = await db.election.deleteMany({ where: { title: { startsWith: "E2E Seçimi " } } });
  if (e2eElections.count) console.info(`[seed-demo] ${e2eElections.count} e2e seçimi (aday/oy dahil) temizlendi`);

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

  // ------------------------------------------------------------ Etkinlikler (F6)
  for (const ev of EVENTS) {
    const club = clubs.get(ev.club)!;
    if (await db.event.findUnique({ where: { clubId_slug: { clubId: club.id, slug: ev.slug } }, select: { id: true } })) continue;
    const clubRow = await db.club.findUniqueOrThrow({ where: { id: club.id }, select: { presidentId: true } });
    const president = [...users.values()].find((x) => x.id === clubRow.presidentId)!;
    const category = await db.eventCategory.findUniqueOrThrow({ where: { slug: ev.category } });
    const { id } = await createEventDraft(president, club.id, { categoryId: category.id, titleTr: ev.title });
    await db.event.update({ where: { id }, data: { slug: ev.slug } });
    if (ev.target === "DRAFT") continue;
    const t0 = now.getTime();
    const content: EventContent = {
      categoryId: category.id,
      titleTr: ev.title,
      summaryTr: ev.summary,
      descriptionTr: para(...ev.body),
      coverKey: await storeEventImage(club.id, id, "cover", await eventCover(ev.color, ev.title.split(" ").slice(0, 3).join(" "))),
      images: [],
      locationName: "Kent Üniversitesi Spor Salonu",
      locationAddress: "Kağıthane, İstanbul",
      mapUrl: "https://maps.example.com/kent",
      isOnline: false,
      onlineUrl: null,
      startAt: new Date(t0 + ev.startIn * D),
      endAt: new Date(t0 + ev.startIn * D + 4 * H),
      applyOpensAt: new Date(t0 + ev.opensIn * H),
      applyClosesAt: new Date(t0 + ev.closesIn * H),
      capacity: null,
      waitlistEnabled: true,
      autoPromoteWaitlist: true,
      autoAccept: true,
      mode: "INDIVIDUAL",
      teamMinSize: null,
      teamMaxSize: null,
      eligibility: "ALL_MEMBERS",
      ...ev.over,
    };
    await saveEventDraft(club.id, id, content);
    if (ev.target === "COMPLETED") {
      await db.event.update({ where: { id }, data: { status: "COMPLETED", publishedAt: new Date(t0 + (ev.opensIn - 24) * H) } });
      continue;
    }
    const req = await submitRequest(president, { type: "EVENT_PUBLISH", universityId: university.id, clubId: club.id, payload: { eventId: id } });
    if (ev.target === "PUBLISHED") await decideRequest(admin, university.id, req.id, "APPROVE", null);
  }

  // ------------------------------------------------------------ Başvurular ve takımlar (F7)
  const masaTenisi = await db.event.findUnique({ where: { clubId_slug: { clubId: spor.id, slug: "masa-tenisi-turnuvasi" } }, select: { id: true } });
  if (masaTenisi && (await db.eventFormField.count({ where: { eventId: masaTenisi.id } })) === 0) {
    await createField(baskan, spor.id, masaTenisi.id, {
      type: "SHORT_TEXT",
      labelTr: "Deneyim (yıl)",
      helpTr: null,
      required: false,
      teamLevel: false,
      optionsText: [],
      integer: false,
      acceptPdf: false,
      acceptImage: false,
      showIfFieldId: null,
      showIfValue: null,
    });
    await createField(baskan, spor.id, masaTenisi.id, {
      type: "CONSENT",
      labelTr: "Sağlık durumumun turnuvaya katılıma uygun olduğunu beyan ederim",
      helpTr: null,
      required: true,
      teamLevel: false,
      optionsText: [],
      integer: false,
      acceptPdf: false,
      acceptImage: false,
      showIfFieldId: null,
      showIfValue: null,
    });
    const fields = await db.eventFormField.findMany({ where: { eventId: masaTenisi.id } });
    const consent = fields.find((f) => f.type === "CONSENT")!;
    const deneyim = fields.find((f) => f.type === "SHORT_TEXT")!;
    for (const email of ["demo.uye", "demo.ogrenci04", "demo.ogrenci05", "demo.ogrenci06"]) {
      await applyToEvent(u(email), masaTenisi.id, { [deneyim.id]: "3 yıl", [consent.id]: true });
    }
  }

  const baharFutbol = await db.event.findUnique({ where: { clubId_slug: { clubId: spor.id, slug: "bahar-futbol-turnuvasi" } }, select: { id: true } });
  if (baharFutbol && (await db.team.count({ where: { eventId: baharFutbol.id } })) === 0) {
    const kaleciler = await createTeam(u("demo.gorevli"), baharFutbol.id, "Kaleciler FC", {}, {});
    for (const email of ["demo.uye", "demo.ogrenci04", "demo.ogrenci09", "demo.ogrenci10", "demo.ogrenci13"]) {
      await joinTeam(u(email), baharFutbol.id, kaleciler.code, {});
    }
    await completeTeam(u("demo.gorevli"), baharFutbol.id, kaleciler.id);

    const yildizlar = await createTeam(u("demo.ogrenci05"), baharFutbol.id, "Yıldızlar", {}, {});
    await joinTeam(u("demo.ogrenci06"), baharFutbol.id, yildizlar.code, {});
  }

  // ------------------------------------------------------------ Turnuvalar (F8)
  if (masaTenisi && (await db.tournament.count({ where: { eventId: masaTenisi.id } })) === 0) {
    const singleElim = await createTournament(baskan, spor.id, masaTenisi.id, { name: "Masa Tenisi Elemeleri", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: true });
    await generateBracket(baskan, spor.id, singleElim.id);
    const r1 = (await getStageMatches((await db.stage.findFirstOrThrow({ where: { tournamentId: singleElim.id } })).id)).filter((m) => m.round === 1 && m.status === "PENDING");
    for (const m of r1) await recordScore(baskan, spor.id, m.id, { homeScore: 3, awayScore: 1 });

    const groups = await createTournament(baskan, spor.id, masaTenisi.id, {
      name: "Dostluk Ligi (Gruplar)",
      format: "GROUPS_KNOCKOUT",
      source: "MANUAL",
      manualNames: ["Ekip Kaplan", "Ekip Şahin", "Ekip Boran", "Ekip Yıldırım", "Ekip Fırtına", "Ekip Volkan", "Ekip Mahmut", "Ekip Selim"],
      isPublic: true,
    });
    await updateGroupsSettings(baskan, spor.id, groups.id, { groupCount: 2, advancePerGroup: 2, bestThirds: 0 });
    await generateBracket(baskan, spor.id, groups.id);
  }

  // ------------------------------------------------------------ Duyurular (F6)
  if ((await db.announcement.count({ where: { clubId: spor.id } })) === 0) {
    await createAnnouncement(baskan, spor.id, { titleTr: "Antrenman saatleri değişti", body: "Bu dönem antrenmanlar salı ve perşembe 18.00'de.\n\nYeni üyeler için tanışma antrenmanı bu perşembe!", pinned: true });
  }
  if ((await db.announcement.count({ where: { clubId: yazilim.id } })) === 0) {
    await createAnnouncement(yzBaskan, yazilim.id, { titleTr: "Mentorluk programı başvuruları açıldı", body: "Mezun mentorlarımızla birebir eşleşmek için kulüp panosundaki formu doldurun.", pinned: false });
  }

  const counts = {
    users: users.size,
    clubs: clubs.size,
    events: await db.event.count({ where: { universityId: university.id } }),
    registrations: await db.registration.count({ where: { event: { universityId: university.id } } }),
    teams: await db.team.count({ where: { event: { universityId: university.id } } }),
    tournaments: await db.tournament.count({ where: { event: { universityId: university.id } } }),
    pending: await db.changeRequest.count({ where: { universityId: university.id, status: "PENDING" } }),
  };
  console.info(`[seed-demo] ${counts.users} hesap, ${counts.clubs} kulüp, ${counts.events} etkinlik, ${counts.registrations} başvuru, ${counts.teams} takım, ${counts.tournaments} turnuva, ${counts.pending} bekleyen talep. Şifre: .env → DEMO_PASSWORD`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
