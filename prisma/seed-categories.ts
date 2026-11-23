// Kategori seed verisi — docs/EVENTS-FORMS-I18N.md §1. Süper Admin panelden yönetir.
export const CLUB_CATEGORIES: { slug: string; nameTr: string; nameEn: string; icon: string }[] = [
  { slug: "spor", nameTr: "Spor", nameEn: "Sports", icon: "trophy" },
  { slug: "e-spor", nameTr: "E-spor", nameEn: "Esports", icon: "gamepad-2" },
  { slug: "kultur-sanat", nameTr: "Kültür-Sanat", nameEn: "Arts & Culture", icon: "palette" },
  { slug: "muzik", nameTr: "Müzik", nameEn: "Music", icon: "music" },
  { slug: "tiyatro-sinema", nameTr: "Tiyatro-Sinema", nameEn: "Theatre & Film", icon: "clapperboard" },
  { slug: "bilim-teknoloji", nameTr: "Bilim-Teknoloji", nameEn: "Science & Technology", icon: "flask-conical" },
  { slug: "muhendislik", nameTr: "Mühendislik", nameEn: "Engineering", icon: "cog" },
  { slug: "girisimcilik-kariyer", nameTr: "Girişimcilik-Kariyer", nameEn: "Entrepreneurship & Career", icon: "briefcase" },
  { slug: "sosyal-sorumluluk", nameTr: "Sosyal Sorumluluk", nameEn: "Social Responsibility", icon: "heart-handshake" },
  { slug: "doga-outdoor", nameTr: "Doğa-Outdoor", nameEn: "Nature & Outdoor", icon: "mountain" },
  { slug: "dil-kultur", nameTr: "Dil-Kültür", nameEn: "Language & Culture", icon: "languages" },
  { slug: "akademik", nameTr: "Akademik", nameEn: "Academic", icon: "graduation-cap" },
  { slug: "medya-yayin", nameTr: "Medya-Yayın", nameEn: "Media & Publishing", icon: "newspaper" },
  { slug: "diger", nameTr: "Diğer", nameEn: "Other", icon: "shapes" },
];

type Sub = [slug: string, nameTr: string, nameEn: string];
export const EVENT_CATEGORIES: { slug: string; nameTr: string; nameEn: string; children: Sub[] }[] = [
  {
    slug: "turnuva-yarisma",
    nameTr: "Turnuva / Yarışma",
    nameEn: "Tournament / Competition",
    children: [
      ["futbol", "Futbol", "Football"],
      ["basketbol", "Basketbol", "Basketball"],
      ["voleybol", "Voleybol", "Volleyball"],
      ["masa-tenisi", "Masa tenisi", "Table tennis"],
      ["satranc", "Satranç", "Chess"],
      ["e-spor-turnuvasi", "E-spor", "Esports"],
      ["bilgi-yarismasi", "Bilgi yarışması", "Quiz"],
      ["hackathon", "Hackathon", "Hackathon"],
      ["turnuva-diger", "Diğer", "Other"],
    ],
  },
  {
    slug: "atolye-egitim",
    nameTr: "Atölye / Eğitim",
    nameEn: "Workshop / Training",
    children: [
      ["workshop", "Workshop", "Workshop"],
      ["bootcamp", "Bootcamp", "Bootcamp"],
      ["kurs", "Kurs", "Course"],
    ],
  },
  {
    slug: "konferans-soylesi",
    nameTr: "Konferans / Söyleşi",
    nameEn: "Conference / Talk",
    children: [
      ["panel", "Panel", "Panel"],
      ["soylesi", "Söyleşi", "Talk"],
      ["seminer", "Seminer", "Seminar"],
    ],
  },
  {
    slug: "sosyal",
    nameTr: "Sosyal",
    nameEn: "Social",
    children: [
      ["bulusma", "Buluşma", "Meetup"],
      ["gezi", "Gezi", "Trip"],
      ["kamp", "Kamp", "Camp"],
      ["parti", "Parti", "Party"],
    ],
  },
  {
    slug: "sanat-gosteri",
    nameTr: "Sanat / Gösteri",
    nameEn: "Art / Performance",
    children: [
      ["konser", "Konser", "Concert"],
      ["tiyatro", "Tiyatro", "Theatre"],
      ["sergi", "Sergi", "Exhibition"],
      ["gosterim", "Gösterim", "Screening"],
    ],
  },
  {
    slug: "sosyal-sorumluluk-etkinlik",
    nameTr: "Sosyal Sorumluluk",
    nameEn: "Social Responsibility",
    children: [
      ["gonulluluk", "Gönüllülük", "Volunteering"],
      ["bagis-kampanyasi", "Bağış kampanyası", "Fundraiser"],
    ],
  },
  {
    slug: "kariyer",
    nameTr: "Kariyer",
    nameEn: "Career",
    children: [
      ["kariyer-gunu", "Kariyer günü", "Career day"],
      ["mulakat-simulasyonu", "Mülakat simülasyonu", "Mock interview"],
    ],
  },
  { slug: "diger-etkinlik", nameTr: "Diğer", nameEn: "Other", children: [] },
];
