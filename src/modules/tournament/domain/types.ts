/**
 * Turnuva üretim algoritmalarının ortak saf tipleri (TOURNAMENTS.md §1). Girdi = katılımcı
 * listesi + ayarlar, çıktı = maç planı; DB kimliği yok, yalnızca girdi dizisindeki `index`.
 * Servis katmanı bu planı transaction içinde gerçek Match satırlarına çevirir.
 */

/** Katılımcı girdisi — `index`, planın home/awayIndex alanlarında referans olarak kullanılır. */
export interface DomainParticipant {
  index: number;
  /** 1 = en iyi tohum. Belirtilmezse kayıt/liste sırası tohum sayılır. */
  seed: number;
}

export type MatchStatusPlan = "PENDING" | "BYE";

/** Bir sonraki maça bağlantı (kazanan ilerler). */
export interface NextRef {
  round: number;
  position: number;
  slot: "home" | "away";
}

/** Çift elemede maçın hangi brakete ait olduğu (Prisma `BracketSide` ile paralel string union — domain katmanı Prisma'dan bağımsız kalır). */
export type BracketSidePlan = "WINNERS" | "LOSERS" | "FINAL";

/** Üretilen tek bir maç — saf, DB'siz. `homeIndex`/`awayIndex` null = henüz belli değil (TBD). */
export interface PlannedMatch {
  round: number;
  /** Tur içindeki sıra (braket çiziminde yukarıdan aşağı), 0 tabanlı. */
  position: number;
  groupKey?: string;
  homeIndex: number | null;
  awayIndex: number | null;
  status: MatchStatusPlan;
  /** BYE maçında otomatik kazanan (girdi index'i). */
  byeWinnerIndex?: number;
  next?: NextRef;
  /** Kaybedenin ilerlediği yuva (3.lük maçı veya çift elemede üst braket→alt braket düşüşü). */
  loserNext?: NextRef;
  /** Çift elemede WINNERS/LOSERS/FINAL; diğer formatlarda tanımsız. */
  side?: BracketSidePlan;
  /** FFA heat rosteri — 2'den çok katılımcı olduğunda homeIndex/awayIndex yerine kullanılır. */
  participantIndexes?: number[];
  /** İki maçlı eşleşme işareti — topolojiyi değiştirmez, sadece skor girişi/toplama davranışını belirler. */
  legs?: 2;
}

export interface MatchPlan {
  rounds: number;
  matches: PlannedMatch[];
}
