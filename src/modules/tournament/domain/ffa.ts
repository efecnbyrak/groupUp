/**
 * FFA / Sıralama (TOURNAMENTS.md §2.6). Saf, DB'siz. Tek seviyeli heat'ler + opsiyonel
 * "sonraki tura geçenler" listesi (ikinci seviye braketi F9'da otomatik üretilmez).
 */
import type { StandingRow } from "./standings";
import type { DomainParticipant, PlannedMatch } from "./types";

export interface FfaHeatResult {
  participantIndex: number;
  rank: number;
  points?: number;
  time?: number;
  score?: number;
}

export interface FfaPointsTable {
  /** index 0 = 1. sıranın puanı, örn. [10,8,6,5,4,3,2,1]. */
  byRank: number[];
}

export interface GenerateFfaHeatsOptions {
  heatSize: number;
  /** Her heat'ten sonraki tura geçecek kişi sayısı (ikinci seviye F9'da üretilmez, sadece saklanır). */
  advancePerHeat?: number;
}

/** Katılımcıları `heatSize`'a göre ardışık heat'lere böler. */
export function generateFfaHeats(participants: DomainParticipant[], opts: GenerateFfaHeatsOptions): PlannedMatch[] {
  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const heats: PlannedMatch[] = [];
  let position = 0;
  for (let i = 0; i < sorted.length; i += opts.heatSize) {
    const chunk = sorted.slice(i, i + opts.heatSize);
    heats.push({
      round: 1,
      position: position++,
      groupKey: `HEAT_${position}`,
      homeIndex: null,
      awayIndex: null,
      status: "PENDING",
      participantIndexes: chunk.map((p) => p.index),
    });
  }
  return heats;
}

/** Puan tablosu verilmişse ve `points` zaten doldurulmamışsa, rank'a göre puan atar. time/score bazlı heat'lerde dokunmaz. */
export function scoreFfaHeat(results: FfaHeatResult[], table?: FfaPointsTable): FfaHeatResult[] {
  if (!table) return results;
  return results.map((r) => (r.points !== undefined ? r : { ...r, points: table.byRank[r.rank - 1] ?? 0 }));
}

/** Heat'ler arası basitleştirilmiş standings: toplam points, played. wins/goalDiff kullanılmaz. */
export function computeFfaStandings(heats: { results: FfaHeatResult[] }[]): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  for (const heat of heats) {
    for (const r of heat.results) {
      const row = rows.get(r.participantIndex) ?? { index: r.participantIndex, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, form: [] };
      row.played++;
      row.points += r.points ?? 0;
      if (r.rank === 1) row.wins++;
      rows.set(r.participantIndex, row);
    }
  }
  return [...rows.values()];
}
