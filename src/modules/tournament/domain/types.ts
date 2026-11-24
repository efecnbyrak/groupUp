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
  /** Kaybedenin ilerlediği yuva (yalnızca 3.lük maçı olan braketlerde yarı finaller için). */
  loserNext?: NextRef;
}

export interface MatchPlan {
  rounds: number;
  matches: PlannedMatch[];
}
