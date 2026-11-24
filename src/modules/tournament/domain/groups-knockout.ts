/**
 * Grup + eleme (TOURNAMENTS.md §2.4). İki ayrı adım, saf fonksiyonlar:
 *  1. `assignGroups` — yılan (serpentine) tohumlama ile gruplara dağıtım.
 *  2. `seedKnockoutFromGroups` — grup sonuçlarından (yönetici "Eleme aşamasını oluştur" deyince,
 *     otomatik değil) eleme braketi için tohum listesi: aynı gruptan çıkanlar mümkün olduğunca
 *     geç karşılaşsın diye serpentine (yılan) tohum numarası verilir (çapraz eşleşme — §2.4).
 */
import type { DomainParticipant } from "./types";

export interface GroupAssignment {
  groupKey: string;
  participants: DomainParticipant[];
}

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Yılan (serpentine) tohumlama: torba sırası 0,1,…,g-1,g-1,…,1,0,0,1,… */
export function assignGroups(participants: DomainParticipant[], groupCount: number): GroupAssignment[] {
  if (groupCount < 1) throw new Error("groupCount >= 1 olmalı");
  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const groups: GroupAssignment[] = Array.from({ length: groupCount }, (_, i) => ({ groupKey: GROUP_LETTERS[i] ?? `G${i + 1}`, participants: [] }));
  let g = 0;
  let dir = 1;
  for (const p of sorted) {
    groups[g]!.participants.push(p);
    if (groupCount > 1) {
      if (g + dir < 0 || g + dir >= groupCount) dir *= -1;
      else g += dir;
    }
  }
  return groups;
}

export interface GroupQualifiers {
  groupKey: string;
  /** Grup içi sıralama — 0 = grup birincisi (`rankStandings` çıktısı, index = katılımcı index'i). */
  rankedIndexes: number[];
}

/**
 * Grup sonuçlarından eleme tohumlaması. `advancePerGroup` kişi doğrudan gider. `bestThirdsGroupOrder`
 * verilirse (gruplar arası karşılaştırma tablosuyla en iyiden en kötüye sıralanmış grup anahtarları
 * — hesaplama çağırana aittir, bkz. `rankStandings`), o sıradaki ilk `bestThirdsGroupOrder.length`
 * grubun `advancePerGroup`. sıradaki (ilk elenen) katılımcısı da eklenir.
 */
export function seedKnockoutFromGroups(groups: GroupQualifiers[], advancePerGroup: number, bestThirdsGroupOrder: string[] = []): DomainParticipant[] {
  const out: DomainParticipant[] = [];
  let seed = 1;
  // Tier'ler sabit grup sırasıyla eklenir (standart braket tohum sırasıyla birleşince
  // aynı gruptan çıkanlar round1'de karşılaşmaz — bkz. test). Yılan sırası burada YANLIŞ olur:
  // standart braketin seed4'ü seed1 ile eşleşir; ters tier sırası aynı grubu seed1&seed4'e düşürür.
  for (let tier = 0; tier < advancePerGroup; tier++) {
    for (const g of groups) {
      const idx = g.rankedIndexes[tier];
      if (idx !== undefined) out.push({ index: idx, seed: seed++ });
    }
  }
  const byGroupKey = new Map(groups.map((g) => [g.groupKey, g]));
  for (const key of bestThirdsGroupOrder) {
    const idx = byGroupKey.get(key)?.rankedIndexes[advancePerGroup];
    if (idx !== undefined) out.push({ index: idx, seed: seed++ });
  }
  return out;
}
