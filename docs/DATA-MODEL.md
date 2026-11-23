# Veri Modeli — groupUp (taslak Prisma şeması)

> Bu bir **taslaktır**. Her faz kendi tablolarını `prisma/schema.prisma`'ya ekler ve migration üretir (F2: kimlik + üniversite, F5: kulüp + onay + ticket, F6–F7: etkinlik + başvuru, F8–F9: turnuva, F11: seçim). Alan adları İngilizce, kullanıcıya görünen metinler i18n'de.

## Genel kurallar
- ID: `cuid2` yerine Prisma `@default(cuid())` (URL'de kısa, tahmin edilemez).
- Zaman: `DateTime` (UTC), `createdAt @default(now())`, `updatedAt @updatedAt`.
- Silme: kullanıcı ve kulüp için **soft delete** (`deletedAt`); kayıtlar tarihsel olarak korunur. Hesap silmede kişisel alanlar anonimleştirilir.
- Tenant: University'ye bağlı her kök tabloda `universityId` + indeks.
- Çok dilli içerik: `xxxTr` (kaynak) + `xxxEn` (çeviri) + `translationHash` + `translatedAt`.
- JSON alanlar yalnızca şeması değişken olan veride (form cevapları, onay payload'u, turnuva ayarları); zod ile doğrulanır.

## Enum'lar
```prisma
enum PlatformRole       { USER SUPER_ADMIN }
enum UserType           { STUDENT ALUMNI }
enum UserStatus         { PENDING_VERIFICATION ACTIVE PENDING_ALUMNI_REVIEW SUSPENDED DELETED }
enum DomainType         { STUDENT ALUMNI }
enum AlumniVerifyMode   { DOMAIN MANUAL BOTH }
enum EmailTokenPurpose  { VERIFY_EMAIL PASSWORD_RESET CHANGE_EMAIL DELETE_ACCOUNT }
enum Gender             { FEMALE MALE OTHER PREFER_NOT_TO_SAY }
enum MembershipStatus   { ACTIVE LEFT REMOVED BANNED }
enum ClubStatus         { ACTIVE SUSPENDED ARCHIVED }
enum StaffPermission    { EVENT_MANAGE REGISTRATION_VIEW REGISTRATION_MANAGE TOURNAMENT_MANAGE MEMBER_INVITE ANNOUNCEMENT_POST TICKET_OPEN }
enum ChangeRequestType  { CLUB_UPDATE EVENT_PUBLISH EVENT_UPDATE EVENT_CANCEL MEMBER_REMOVE MEMBER_BAN STAFF_ASSIGN STAFF_REMOVE ALUMNI_VERIFY ELECTION_RESULT }
enum ChangeRequestStatus{ PENDING APPROVED REJECTED CANCELLED }
enum EventStatus        { DRAFT PENDING PUBLISHED CANCELLED COMPLETED }
enum ParticipationMode  { INDIVIDUAL TEAM }
enum Eligibility        { ALL_MEMBERS STUDENTS_ONLY ALUMNI_ONLY }
enum FormFieldType      { SHORT_TEXT LONG_TEXT SINGLE_CHOICE MULTI_CHOICE DROPDOWN NUMBER DATE YES_NO FILE CONSENT SECTION }
enum RegistrationStatus { APPLIED WAITLISTED ACCEPTED REJECTED CANCELLED }
enum TournamentFormat   { SINGLE_ELIM DOUBLE_ELIM ROUND_ROBIN GROUPS_KNOCKOUT SWISS FREE_FOR_ALL }
enum StageType          { KNOCKOUT DOUBLE_KNOCKOUT ROUND_ROBIN SWISS FFA }
enum TournamentStatus   { DRAFT SEEDED IN_PROGRESS COMPLETED CANCELLED }
enum MatchStatus        { PENDING SCHEDULED IN_PROGRESS COMPLETED WALKOVER POSTPONED BYE }
enum BracketSide        { WINNERS LOSERS FINAL }
enum TicketStatus       { OPEN ANSWERED CLOSED }
enum TicketScope        { CLUB_TO_ADMIN ADMIN_TO_PLATFORM }
enum ElectionStatus     { DRAFT CANDIDACY VOTING CLOSED RESULT_PENDING FINALIZED CANCELLED }
enum NotificationType   { APPROVAL_RESULT REGISTRATION_UPDATE TEAM_UPDATE MATCH_UPDATE TICKET_REPLY ELECTION ANNOUNCEMENT DEADLINE_REMINDER SYSTEM }
```

## Kimlik ve üniversite (F2)
```prisma
model University {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  city             String?
  logoKey          String?
  alumniVerifyMode AlumniVerifyMode @default(BOTH)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  domains    UniversityDomain[]
  faculties  Faculty[]
  admins     UniversityAdmin[]
  users      User[]
  clubs      Club[]
}

model UniversityDomain {
  id           String     @id @default(cuid())
  universityId String
  domain       String     @unique   // "ogr.kent.edu.tr" (küçük harf)
  type         DomainType
  university   University @relation(fields: [universityId], references: [id])
  @@index([universityId])
}

model Faculty {
  id           String @id @default(cuid())
  universityId String
  nameTr       String
  nameEn       String?
  departments  Department[]
  university   University @relation(fields: [universityId], references: [id])
  @@unique([universityId, nameTr])
}

model Department {
  id        String  @id @default(cuid())
  facultyId String
  nameTr    String
  nameEn    String?
  faculty   Faculty @relation(fields: [facultyId], references: [id])
  @@unique([facultyId, nameTr])
}

model UniversityAdmin {
  id           String   @id @default(cuid())
  universityId String
  userId       String
  createdAt    DateTime @default(now())
  createdById  String?
  @@unique([universityId, userId])
}

model UniversityRequest {           // "üniversitem listede yok" talebi
  id         String   @id @default(cuid())
  email      String
  name       String
  domain     String
  note       String?
  status     ChangeRequestStatus @default(PENDING)
  createdAt  DateTime @default(now())
}

model User {
  id              String       @id @default(cuid())
  email           String       @unique          // giriş maili (küçük harf)
  emailVerifiedAt DateTime?
  passwordHash    String
  platformRole    PlatformRole @default(USER)
  type            UserType     @default(STUDENT)
  status          UserStatus   @default(PENDING_VERIFICATION)
  universityId    String?                        // Süper Admin için null olabilir
  locale          String       @default("tr")
  lastLoginAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  university  University? @relation(fields: [universityId], references: [id])
  profile     Profile?
  sessions    Session[]
  @@index([universityId, type])
}

model Profile {
  userId         String   @id
  firstName      String
  lastName       String
  studentNo      String?
  facultyId      String?
  departmentId   String?
  classYear      Int?          // 1-6, hazırlık=0
  graduationYear Int?
  phone          String?       // E.164
  gender         Gender?
  birthDate      DateTime?     @db.Date
  avatarKey      String?
  bio            String?       @db.VarChar(300)
  kvkkConsentAt  DateTime
  user           User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AlumniVerification {          // manuel mezun yolu (belge) — F4
  id              String              @id @default(cuid())
  userId          String              @unique
  universityId    String
  storageKey      String              // private storage; F5'te Attachment'a taşınabilir
  fileName        String
  mimeType        String
  sizeBytes       Int
  status          ChangeRequestStatus @default(PENDING)
  rejectReason    String?
  changeRequestId String?             @unique   // F5: ALUMNI_VERIFY talebi
  submittedAt     DateTime            @default(now())
  decidedAt       DateTime?
  @@index([universityId, status, submittedAt])
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique      // sha256(token)
  userAgent   String?
  ipHash      String?
  expiresAt   DateTime
  lastSeenAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}

model EmailToken {                  // OTP kodları + link token'ları
  id         String            @id @default(cuid())
  userId     String?
  email      String
  purpose    EmailTokenPurpose
  codeHash   String            // sha256(OTP veya token)
  attempts   Int               @default(0)
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime          @default(now())
  @@index([email, purpose])
  @@index([expiresAt])
}

model RateLimit {
  key        String   @id          // "login:ip:1.2.3.4" / "otp:mail:x@y"
  count      Int
  windowEnd  DateTime
  @@index([windowEnd])
}

model AuditLog {
  id           String   @id @default(cuid())
  universityId String?
  actorId      String?
  action       String   // "club.member.removed"
  targetType   String
  targetId     String
  meta         Json?
  createdAt    DateTime @default(now())
  @@index([universityId, createdAt])
  @@index([targetType, targetId])
}
```

## Kulüp, onay, ticket (F5)
> **Uygulanan farklar (F5):** `Club.slug` genel `@unique` (public sayfa üniversitesiz), `Club.deletedAt`; `Membership.bannedUntil` (null + BANNED = süresiz); `StaffAssignment.updatedAt`; `ChangeRequest.updatedAt` + migration'da kısmi unique index `(type, targetId, COALESCE(clubId,'')) WHERE status='PENDING'`; `Ticket.category` (`TicketCategory`), `changeRequestId`, `closedAt`; `Attachment` FK'leri cascade. `AlumniVerification` yalnızca durum kaydı (belge alanları Attachment'a taşındı, `changeRequestId` son talep).
> `ClubCategory` ve `EventCategory` F4'te (Platform paneli kategorileri) eklendi; `EventCategory.parentId` iki seviyeli ağaç (`@@index([parentId, order])`).
```prisma
model ClubCategory {                // Spor, Kültür-Sanat, Bilim-Teknoloji, ...
  id     String @id @default(cuid())
  slug   String @unique
  nameTr String
  nameEn String
  icon   String?                    // lucide ikon adı
  order  Int    @default(0)
}

model Club {
  id             String     @id @default(cuid())
  universityId   String
  categoryId     String
  slug           String
  name           String
  shortDescTr    String     @db.VarChar(200)
  shortDescEn    String?
  descriptionTr  Json?                    // Tiptap JSON
  descriptionEn  Json?
  translationHash String?
  logoKey        String?
  coverKey       String?
  contactEmail   String?
  instagram      String?
  presidentId    String?
  status         ClubStatus @default(ACTIVE)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@unique([universityId, slug])
  @@unique([presidentId])              // bir kişi tek kulüpte başkan
  @@index([universityId, categoryId])
}

model Membership {
  id         String           @id @default(cuid())
  clubId     String
  userId     String
  status     MembershipStatus @default(ACTIVE)
  joinedAt   DateTime         @default(now())
  leftAt     DateTime?
  joinedVia  String?          // "code" | "link" | "admin"
  @@unique([clubId, userId])
  @@index([userId, status])
}

model ClubInvite {
  id         String    @id @default(cuid())
  clubId     String
  code       String    @unique   // 8 karakter, karışmayan alfabe (0/O, 1/I yok)
  createdById String
  maxUses    Int?
  usedCount  Int       @default(0)
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  @@index([clubId])
}

model StaffAssignment {
  id          String            @id @default(cuid())
  clubId      String
  userId      String
  title       String            @db.VarChar(60)    // "Turnuva Sorumlusu"
  permissions StaffPermission[]
  createdAt   DateTime          @default(now())
  @@unique([clubId, userId])
}

model Announcement {
  id        String   @id @default(cuid())
  clubId    String
  authorId  String
  titleTr   String
  titleEn   String?
  bodyTr    Json
  bodyEn    Json?
  pinned    Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([clubId, createdAt])
}

model ChangeRequest {
  id            String              @id @default(cuid())
  universityId  String
  clubId        String?
  type          ChangeRequestType
  targetId      String              // clubId / eventId / userId ...
  payload       Json                // tipine göre zod şeması; {before, after} veya parametreler
  reason        String?             @db.Text
  status        ChangeRequestStatus @default(PENDING)
  requestedById String
  reviewedById  String?
  decisionNote  String?             @db.Text
  decidedAt     DateTime?
  createdAt     DateTime            @default(now())
  attachments   Attachment[]
  @@index([universityId, status, createdAt])
  @@index([targetId, type, status])
}

model Attachment {                  // kanıt belgeleri, ticket ekleri
  id              String   @id @default(cuid())
  storageKey      String   @unique
  fileName        String
  mimeType        String
  sizeBytes       Int
  isPrivate       Boolean  @default(true)
  uploadedById    String
  changeRequestId String?
  ticketMessageId String?
  createdAt       DateTime @default(now())
}

model Ticket {
  id           String       @id @default(cuid())
  universityId String
  clubId       String?
  scope        TicketScope
  subject      String
  status       TicketStatus @default(OPEN)
  openedById   String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  messages     TicketMessage[]
  @@index([universityId, scope, status])
}

model TicketMessage {
  id        String   @id @default(cuid())
  ticketId  String
  authorId  String
  body      String   @db.Text
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
}
```

## Etkinlik ve başvuru (F6–F7)
```prisma
model EventCategory {               // üst kategori + alt (parentId)
  id       String  @id @default(cuid())
  parentId String?
  slug     String  @unique
  nameTr   String
  nameEn   String
  order    Int     @default(0)
}

model Event {
  id                 String            @id @default(cuid())
  universityId       String
  clubId             String
  categoryId         String
  slug               String
  status             EventStatus       @default(DRAFT)
  titleTr            String
  titleEn            String?
  summaryTr          String            @db.VarChar(280)
  summaryEn          String?
  descriptionTr      Json                         // Tiptap JSON
  descriptionEn      Json?
  translationHash    String?
  translatedAt       DateTime?
  coverKey           String?
  locationName       String
  locationAddress    String?
  mapUrl             String?
  isOnline           Boolean           @default(false)
  onlineUrl          String?
  startAt            DateTime
  endAt              DateTime
  applyOpensAt       DateTime
  applyClosesAt      DateTime                     // deadline
  capacity           Int?                          // null = sınırsız
  waitlistEnabled    Boolean           @default(true)
  autoPromoteWaitlist Boolean          @default(true)
  autoAccept         Boolean           @default(true)  // false: başvurular elle onaylanır
  mode               ParticipationMode @default(INDIVIDUAL)
  teamMinSize        Int?
  teamMaxSize        Int?
  eligibility        Eligibility       @default(ALL_MEMBERS)
  publishedAt        DateTime?
  createdById        String
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  images             EventImage[]
  formFields         EventFormField[]
  @@unique([clubId, slug])
  @@index([universityId, status, startAt])
  @@index([clubId, status, applyClosesAt])
}

model EventImage {
  id        String @id @default(cuid())
  eventId   String
  key       String          // storage anahtarı (400/1200 varyantları key'den türetilir)
  alt       String?
  order     Int    @default(0)
  event     Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
}

model EventFormField {
  id          String        @id @default(cuid())
  eventId     String
  type        FormFieldType
  labelTr     String
  labelEn     String?
  helpTr      String?
  helpEn      String?
  required    Boolean       @default(false)
  order       Int
  options     Json?         // [{value, labelTr, labelEn}] — seçim tipleri
  validation  Json?         // {min, max, maxLength, accept: ["pdf"], maxSizeMb}
  showIf      Json?         // {fieldId, equals} — basit koşul
  teamLevel   Boolean       @default(false)   // takım modunda kaptan bir kez doldurur
  event       Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  @@index([eventId, order])
}

model Registration {
  id           String             @id @default(cuid())
  eventId      String
  userId       String
  teamId       String?
  status       RegistrationStatus @default(APPLIED)
  answers      Json               // {fieldId: value}
  profileSnapshot Json            // başvuru anındaki profil (ad, no, bölüm...) — export için
  waitlistPos  Int?
  decidedById  String?
  decidedAt    DateTime?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  @@unique([eventId, userId])
  @@index([eventId, status])
  @@index([userId, status])
}

model Team {
  id          String   @id @default(cuid())
  eventId     String
  name        String   @db.VarChar(50)
  code        String   @unique              // 6 karakter takım davet kodu
  captainId   String
  status      RegistrationStatus @default(APPLIED)
  createdAt   DateTime @default(now())
  members     TeamMember[]
  @@unique([eventId, name])
}

model TeamMember {
  teamId    String
  userId    String
  joinedAt  DateTime @default(now())
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  @@id([teamId, userId])
}
```

## Turnuva (F8–F9)
```prisma
model Tournament {
  id          String           @id @default(cuid())
  eventId     String
  name        String
  format      TournamentFormat
  status      TournamentStatus @default(DRAFT)
  settings    Json             // puanlar, eşitlik bozma sırası, 3.lük maçı, çift devre, tur sayısı...
  isPublic    Boolean          @default(false)
  createdAt   DateTime         @default(now())
  stages      Stage[]
  participants Participant[]
  @@index([eventId])
}

model Stage {
  id           String     @id @default(cuid())
  tournamentId String
  order        Int
  type         StageType
  name         String     // "Grup Aşaması", "Eleme"
  settings     Json
  groups       TournamentGroup[]
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
}

model TournamentGroup {
  id       String @id @default(cuid())
  stageId  String
  name     String // "A Grubu"
  stage    Stage  @relation(fields: [stageId], references: [id], onDelete: Cascade)
}

model Participant {
  id           String   @id @default(cuid())
  tournamentId String
  teamId       String?
  userId       String?
  displayName  String
  seed         Int?
  groupId      String?
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  @@index([tournamentId])
}

model Match {
  id            String      @id @default(cuid())
  stageId       String
  groupId       String?
  round         Int
  position      Int                       // tur içindeki sıra (braket çizimi)
  side          BracketSide?
  homeId        String?                   // Participant
  awayId        String?
  homeScore     Int?
  awayScore     Int?
  homeAgg       Int?                      // iki maçlı eleme toplamı
  awayAgg       Int?
  winnerId      String?
  status        MatchStatus @default(PENDING)
  nextMatchId   String?                   // kazanan buraya
  nextSlot      String?                   // "home" | "away"
  loserMatchId  String?                   // çift eleme: kaybeden buraya
  loserSlot     String?
  venueId       String?
  scheduledAt   DateTime?
  ffaResults    Json?                     // FFA: [{participantId, rank, points}]
  updatedById   String?
  updatedAt     DateTime    @updatedAt
  @@index([stageId, round])
  @@index([venueId, scheduledAt])
}

model Venue {
  id           String @id @default(cuid())
  tournamentId String
  name         String          // "Saha 1", "Salon B"
}

model TimeSlot {
  id           String   @id @default(cuid())
  tournamentId String
  venueId      String
  startAt      DateTime
  endAt        DateTime
  @@index([tournamentId, startAt])
}
```

## Seçim (F11)
```prisma
model Election {
  id              String         @id @default(cuid())
  universityId    String
  clubId          String
  title           String
  status          ElectionStatus @default(DRAFT)
  candidacyOpensAt  DateTime
  candidacyClosesAt DateTime
  votingOpensAt     DateTime
  votingClosesAt    DateTime
  eligibleSnapshotAt DateTime?   // seçmen listesi bu anda dondurulur
  winnerUserId    String?
  createdById     String
  createdAt       DateTime       @default(now())
  @@index([clubId, status])
}

model Candidate {
  id          String   @id @default(cuid())
  electionId  String
  userId      String
  statementTr String?  @db.Text
  approved    Boolean  @default(false)
  @@unique([electionId, userId])
}

model BallotReceipt {               // KİM oy verdi (ne verdiği yok)
  electionId String
  userId     String
  castAt     DateTime @default(now())
  @@id([electionId, userId])
}

model Vote {                         // NE oy verildi (kim verdiği yok)
  id          String @id @default(uuid())   // rastgele v4: zaman sızdırmaz
  electionId  String
  candidateId String
  @@index([electionId, candidateId])
}
```
> `BallotReceipt` ve `Vote` aynı transaction'da yazılır; `Vote`'ta zaman damgası veya sıralı ID tutulmaz (cuid zaman sızdırmasın diye `Vote.id` rastgele UUID v4 kullanılır) → oy ile seçmen eşleştirilemez.

## Bildirim (F10)
```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  titleTr   String
  titleEn   String
  bodyTr    String?
  bodyEn    String?
  href      String?
  readAt    DateTime?
  createdAt DateTime         @default(now())
  @@index([userId, readAt, createdAt])
}
```

## Seed (F2)
- Süper Admin: `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` env'den.
- İstanbul Kent Üniversitesi + domainler: `ogr.kent.edu.tr` (STUDENT) + `mezun.kent.edu.tr` (ALUMNI) — kullanıcı tarafından teyit edildi (2026-11-23). `alumniVerifyMode = BOTH` (domain yolu + belge yolu).
- Kulüp kategorileri ve etkinlik üst kategorileri (bkz. [EVENTS-FORMS-I18N.md](EVENTS-FORMS-I18N.md)).
- `db:seed-demo`: örnek kulüpler, etkinlikler, takımlar, turnuva (landing ve geliştirme için).
