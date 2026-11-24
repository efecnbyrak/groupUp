/**
 * Puan tablosu + eşitlik bozma (TOURNAMENTS.md §4). Saf, DB'siz: maç sonuçlarından hesaplanır,
 * saklanmaz. İkili averaj çoklu eşitlikte mini lig olarak hesaplanır.
 */

export interface PointsSettings {
  win: number;
  draw: number;
  loss: number;
}

export type Tiebreaker = "POINTS" | "HEAD_TO_HEAD" | "GOAL_DIFF" | "GOALS_FOR" | "WINS" | "LOT";

export interface StandingsMatch {
  homeIndex: number;
  awayIndex: number;
  homeScore: number;
  awayScore: number;
}

export interface StandingRow {
  index: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Son 5 maç: "W"|"D"|"L" (en yeniden en eskiye). */
  form: ("W" | "D" | "L")[];
}

function emptyRow(index: number): StandingRow {
  return { index, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, form: [] };
}

/** Temel satırlar — eşitlik bozma uygulanmadan önce, yalnızca tamamlanmış maçlardan. */
export function computeStandings(participantIndexes: number[], matches: StandingsMatch[], points: PointsSettings, allowDraws = true): StandingRow[] {
  const rows = new Map(participantIndexes.map((i) => [i, emptyRow(i)]));
  for (const m of matches) {
    const home = rows.get(m.homeIndex);
    const away = rows.get(m.awayIndex);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins++;
      away.losses++;
      home.points += points.win;
      away.points += points.loss;
      home.form.unshift("W");
      away.form.unshift("L");
    } else if (m.homeScore < m.awayScore) {
      away.wins++;
      home.losses++;
      away.points += points.win;
      home.points += points.loss;
      home.form.unshift("L");
      away.form.unshift("W");
    } else {
      home.draws++;
      away.draws++;
      home.points += allowDraws ? points.draw : points.loss;
      away.points += allowDraws ? points.draw : points.loss;
      home.form.unshift("D");
      away.form.unshift("D");
    }
  }
  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(0, 5);
  }
  return [...rows.values()];
}

function tiebreakValue(row: StandingRow, tb: Tiebreaker): number {
  switch (tb) {
    case "POINTS":
      return row.points;
    case "GOAL_DIFF":
      return row.goalDiff;
    case "GOALS_FOR":
      return row.goalsFor;
    case "WINS":
      return row.wins;
    default:
      return 0;
  }
}

/**
 * Sıralar: önce `tiebreakers` sırasıyla (POINTS her zaman önce gelir, zaten eşitse sıradakine
 * bakılır). HEAD_TO_HEAD: eşit kalan grup için yalnızca aralarındaki maçlardan mini lig kurulur
 * (ikili averaj çoklu eşitlikte de doğru çalışır). LOT: kalan eşitlikte girdi sırası (kararlı).
 */
export function rankStandings(rows: StandingRow[], allMatches: StandingsMatch[], points: PointsSettings, tiebreakers: Tiebreaker[], allowDraws = true): StandingRow[] {
  const byIndex = new Map(rows.map((r) => [r.index, r]));
  const groups = groupByTie(rows, tiebreakers[0] === "HEAD_TO_HEAD" ? [] : [tiebreakers[0] ?? "POINTS"]);
  const resolved: StandingRow[] = [];
  for (const group of groups) {
    resolved.push(...resolveGroup(group, allMatches, points, tiebreakers, 1, byIndex, allowDraws));
  }
  return resolved;
}

function groupByTie(rows: StandingRow[], tbs: Tiebreaker[]): StandingRow[][] {
  const sorted = [...rows].sort((a, b) => compareBy(b, a, tbs));
  const groups: StandingRow[][] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && tbs.every((tb) => tiebreakValue(last[0]!, tb) === tiebreakValue(row, tb))) last.push(row);
    else groups.push([row]);
  }
  return groups;
}

function compareBy(a: StandingRow, b: StandingRow, tbs: Tiebreaker[]): number {
  for (const tb of tbs) {
    const d = tiebreakValue(a, tb) - tiebreakValue(b, tb);
    if (d !== 0) return d;
  }
  return 0;
}

function resolveGroup(
  group: StandingRow[],
  allMatches: StandingsMatch[],
  points: PointsSettings,
  tiebreakers: Tiebreaker[],
  fromIdx: number,
  byIndex: Map<number, StandingRow>,
  allowDraws: boolean,
): StandingRow[] {
  if (group.length <= 1) return group;
  for (let i = fromIdx; i < tiebreakers.length; i++) {
    const tb = tiebreakers[i]!;
    if (tb === "LOT") return group; // girdi sırası korunur (kararlı sort)
    if (tb === "HEAD_TO_HEAD") {
      const ids = new Set(group.map((r) => r.index));
      const mini = allMatches.filter((m) => ids.has(m.homeIndex) && ids.has(m.awayIndex));
      const miniStandings = computeStandings([...ids], mini, points, allowDraws);
      const miniByIndex = new Map(miniStandings.map((r) => [r.index, r]));
      const remaining = [...tiebreakers.slice(i + 1)];
      const subGroups = groupByTie(
        group.map((r) => miniByIndex.get(r.index)!),
        ["POINTS", ...remaining.filter((t): t is Exclude<Tiebreaker, "HEAD_TO_HEAD"> => t !== "HEAD_TO_HEAD")],
      );
      const out: StandingRow[] = [];
      for (const sub of subGroups) {
        const originals = sub.map((s) => byIndex.get(s.index)!);
        out.push(...resolveGroup(originals, allMatches, points, tiebreakers, i + 1, byIndex, allowDraws));
      }
      return out;
    }
    const subGroups = groupByTie(group, [tb]);
    if (subGroups.length > 1) {
      const out: StandingRow[] = [];
      for (const sub of subGroups) out.push(...resolveGroup(sub, allMatches, points, tiebreakers, i + 1, byIndex, allowDraws));
      return out;
    }
  }
  return group;
}
