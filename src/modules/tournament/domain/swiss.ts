/**
 * İsviçre sistemi (TOURNAMENTS.md §2.5). Saf, DB'siz. Tüm turlar baştan üretilmez — her tur,
 * önceki turun tamamen bitmiş sonuçlarından türetilen `SwissPlayerState[]` ile tek tek üretilir
 * (servis katmanı bu zorunluluğu dayatır, bkz. generateNextSwissRound).
 */
import type { PlannedMatch } from "./types";

export interface SwissPlayerState {
  index: number;
  points: number;
  /** Daha önce oynadığı rakiplerin index'leri — rövanş yasağı için. */
  opponents: number[];
  hadBye: boolean;
}

export interface SwissRoundOptions {
  roundNumber: number;
}

export function defaultSwissRounds(n: number): number {
  return Math.ceil(Math.log2(Math.max(n, 2)));
}

/** Backtracking derinliği — n≤128 için yeterli (TOURNAMENTS §2.5). */
const MAX_BACKTRACK = 500;

export function generateSwissRound(players: SwissPlayerState[], opts: SwissRoundOptions): PlannedMatch[] {
  if (players.length === 0) return [];

  // Puana göre azalan sırala (eşitlikte index'e göre kararlı).
  const sorted = [...players].sort((a, b) => (b.points !== a.points ? b.points - a.points : a.index - b.index));

  let byePlayer: SwissPlayerState | undefined;
  let pool = sorted;
  if (pool.length % 2 === 1) {
    // En düşük puanlı, bye almamış oyuncuya bye; herkes almışsa en düşük puanlıya tekrar.
    const candidates = [...pool].reverse();
    byePlayer = candidates.find((p) => !p.hadBye) ?? candidates[0];
    pool = pool.filter((p) => p.index !== byePlayer!.index);
  }

  const pairs = pairSwiss(pool);

  const matches: PlannedMatch[] = pairs.map(([home, away], i) => ({
    round: opts.roundNumber,
    position: i,
    homeIndex: home.index,
    awayIndex: away.index,
    status: "PENDING",
  }));

  if (byePlayer) {
    matches.push({
      round: opts.roundNumber,
      position: matches.length,
      homeIndex: byePlayer.index,
      awayIndex: null,
      status: "BYE",
      byeWinnerIndex: byePlayer.index,
    });
  }

  return matches;
}

/**
 * Puana göre azalan sıralı `pool`u üst-yarı/alt-yarı mantığıyla eşleştirir (Dutch sistemi
 * basitleştirilmiş): sıralı listenin ilk yarısı "üst", ikinci yarısı "alt"; üst[i] alt[i] ile
 * eşleşir. Çakışmada (rövanş) alt yarıda bir komşu ile takas edilir; hiçbiri uymazsa ilk müsait
 * rakiple eşleştirilir (backtracking derinliği n≤128 için yeterli — TOURNAMENTS §2.5).
 */
function pairSwiss(pool: SwissPlayerState[]): [SwissPlayerState, SwissPlayerState][] {
  const played = new Set<string>();
  for (const p of pool) for (const o of p.opponents) played.add(pairKey(p.index, o));

  const half = pool.length / 2;
  const upper = pool.slice(0, half);
  const lower = [...pool.slice(half)];
  const result: [SwissPlayerState, SwissPlayerState][] = [];
  let attempts = 0;

  for (const home of upper) {
    let idx = lower.findIndex((away) => !played.has(pairKey(home.index, away.index)));
    attempts++;
    if (idx === -1 || attempts > MAX_BACKTRACK) idx = 0; // uygun rakip yok (nadir) — ilk müsait olanla eşleştir
    const away = lower.splice(idx, 1)[0]!;
    result.push([home, away]);
  }

  return result;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
