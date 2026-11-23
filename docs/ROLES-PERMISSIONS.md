# Roller ve Yetkiler

## 1. Rol modeli
Roller tek bir alanda değil, **ilişkilerden** türetilir:
| Rol | Nasıl belirlenir |
|---|---|
| SUPER_ADMIN | `User.platformRole = SUPER_ADMIN` |
| UNIVERSITY_ADMIN | `UniversityAdmin(universityId, userId)` kaydı |
| PRESIDENT | `Club.presidentId = userId` |
| STAFF | `StaffAssignment(clubId, userId)` + `permissions[]` |
| MEMBER | `Membership(clubId, userId, status=ACTIVE)` |
| STUDENT / ALUMNI | `User.type` |

Bir kişi aynı anda birden çok rolde olabilir (ör. Admin + başka kulüpte üye değil — Admin'in kulüp üyesi olmaması önerilir ama engellenmez).

## 2. Yetki fonksiyonları (`src/lib/authz.ts`)
```ts
requireUser(): Promise<SessionUser>                       // ACTIVE + emailVerified
requireSuperAdmin(): Promise<SessionUser>
requireUniversityAdmin(universityId): Promise<SessionUser>
requireClubPermission(clubId, perm: StaffPermission | 'PRESIDENT'): Promise<SessionUser>
requireClubMember(clubId): Promise<SessionUser>
can(user, action, resource): boolean                       // UI'da buton göster/gizle için
```
Başarısızlıkta `ForbiddenError` → 403 sayfası / action hata sonucu. UI gizleme **güvenlik değildir**; her action sunucuda kontrol eder.

## 3. Görevli yetkileri
| Yetki | Açıklama |
|---|---|
| `EVENT_MANAGE` | Etkinlik taslağı oluştur/düzenle, onaya gönder, form alanlarını düzenle |
| `REGISTRATION_VIEW` | Başvuruları görüntüle |
| `REGISTRATION_MANAGE` | Başvuru kabul/ret, yedek listeyi yönet, Excel/CSV indir |
| `TOURNAMENT_MANAGE` | Turnuva oluştur, tohumla, skor gir, maç planla |
| `MEMBER_INVITE` | Davet kodu/link oluştur ve iptal et |
| `ANNOUNCEMENT_POST` | Kulüp duyurusu yayınla |
| `TICKET_OPEN` | Kulüp adına Admin'e ticket aç |

Başkan tüm yetkilere + şunlara sahiptir (görevliye verilemez): görevli atama/çıkarma talebi, üye çıkarma/engelleme talebi, kulüp bilgisi değişikliği talebi.
**Max ekip:** Başkan + 9 görevli = 10. Kontrol: `count(StaffAssignment) + count(PENDING STAFF_ASSIGN talepleri) < 9` transaction içinde.

## 4. Yetki matrisi
| İşlem | Süper Admin | Üni. Admin | Başkan | Görevli | Üye |
|---|---|---|---|---|---|
| Üniversite/domain ekle, Admin ata | ✅ | — | — | — | — |
| Kulüp aç, Başkan ata | ✅ | ✅ | — | — | — |
| Onay kuyruğu karar ver | ✅ | ✅ (kendi üni.) | — | — | — |
| Seçim aç/sonuçlandır | — | ✅ | — | — | — |
| Kulüp bilgisi değiştir | — | doğrudan ✅ | talep → onay | — | — |
| Görevli ata/çıkar | — | doğrudan ✅ | talep → onay | — | — |
| Üye çıkar/engelle | — | doğrudan ✅ | talep (+kanıt) → onay | — | — |
| Etkinlik oluştur (taslak) | — | — | ✅ | `EVENT_MANAGE` | — |
| Etkinlik yayınla/düzenle | — | doğrudan ✅ | talep → onay | talep → onay (`EVENT_MANAGE`) | — |
| Başvuru kabul/ret, export | — | görüntüle | ✅ | `REGISTRATION_MANAGE` | — |
| Turnuva yönet | — | — | ✅ | `TOURNAMENT_MANAGE` | — |
| Davet kodu/link | — | — | ✅ | `MEMBER_INVITE` | — |
| Duyuru | — | — | ✅ | `ANNOUNCEMENT_POST` | — |
| Ticket aç | Admin'e yanıt | Süper Admin'e aç | ✅ | `TICKET_OPEN` | — |
| Kulübe katıl / ayrıl | — | — | — | — | ✅ |
| Etkinliğe başvur, takım kur | — | — | ✅ | ✅ | ✅ (üye) |
| Seçimde oy | — | — | ✅ (öğrenci) | ✅ (öğrenci) | ✅ (öğrenci) |

Admin "doğrudan" yaptığı işlemler de `AuditLog`'a yazılır.

## 5. Paneller ve renkler
| Panel | Rota | `data-panel` | Vurgu rengi |
|---|---|---|---|
| Platform (Süper Admin) | `/panel/platform` | `platform` | Grafit / slate |
| Üniversite Admin | `/panel/admin` | `admin` | Mor (violet) |
| Kulüp (Başkan) | `/panel/kulup/[slug]` | `president` | Zümrüt (emerald) |
| Kulüp (Görevli) | `/panel/kulup/[slug]` | `staff` | Teal |
| Öğrenci uygulaması | `/`, `/kesfet`, `/profil` | `student` | Mavi |
| Mezun uygulaması | aynı | `alumni` | Amber / bronz |
Renk değerleri ve kontrast: [DESIGN.md](DESIGN.md).
