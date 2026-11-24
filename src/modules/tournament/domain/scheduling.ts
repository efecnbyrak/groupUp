/**
 * Planlama / saha-zaman atama (TOURNAMENTS.md §5). Saf, DB'siz. Açgözlü deterministik algoritma:
 * maçları bağımlılık sırasına göre sırala → her maç için en erken uygun (saha, slot) bul →
 * yerleşemeyenler "planlanamadı" listesinde döner.
 */

export interface VenueSlotTemplate {
  venueId: string;
  /** 0-6 (Pzt=0..Paz=6) — tekrarlayan müsaitlik penceresi. */
  weekday: number;
  /** Gün içi dakika, 0-1439. */
  startMinute: number;
  endMinute: number;
  matchMinutes: number;
}

export interface SlotInstance {
  venueId: string;
  start: Date;
  end: Date;
}

export interface SchedulableMatch {
  id: string;
  round: number;
  /** Bu maçın oynanabilmesi için önce bitmiş olması gereken maç id'leri. */
  dependsOn: string[];
  participantIds: string[];
}

export interface ParticipantAvailability {
  participantId: string;
  unavailable: { start: Date; end: Date }[];
}

export interface ScheduleConstraints {
  minRestMin: number;
  maxMatchesPerDay: number;
}

export interface ScheduleResult {
  placed: { matchId: string; venueId: string; start: Date }[];
  unplaced: string[];
}

/** Şablonları `[from, to)` aralığında somut slot örneklerine çevirir (venue bazlı, kronolojik). */
export function expandSlotTemplates(templates: VenueSlotTemplate[], from: Date, to: Date): SlotInstance[] {
  const slots: SlotInstance[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor < to) {
    const weekday = (cursor.getDay() + 6) % 7; // JS: 0=Pazar → Pzt=0 tabanlıya çevir
    for (const t of templates) {
      if (t.weekday !== weekday) continue;
      for (let minute = t.startMinute; minute + t.matchMinutes <= t.endMinute; minute += t.matchMinutes) {
        const start = new Date(cursor);
        start.setMinutes(start.getMinutes() + minute);
        if (start < from || start >= to) continue;
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + t.matchMinutes);
        slots.push({ venueId: t.venueId, start, end });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Açgözlü yerleştirme: maçları `round` artan sırayla işler (bağımlı maçlar önceki turlardan
 * sonra); her maç için kronolojik ilk uygun slotu arar (katılımcı çakışması yok, minRestMin,
 * maxMatchesPerDay, müsaitlik, bağımlılık bitişinden sonra).
 */
export function scheduleGreedy(matches: SchedulableMatch[], slots: SlotInstance[], availability: ParticipantAvailability[], constraints: ScheduleConstraints): ScheduleResult {
  const sorted = [...matches].sort((a, b) => a.round - b.round);
  const placedByMatch = new Map<string, { venueId: string; start: Date; end: Date }>();
  const placedByParticipant = new Map<string, { start: Date; end: Date }[]>();
  const unavailableByParticipant = new Map(availability.map((a) => [a.participantId, a.unavailable]));

  const unplaced: string[] = [];
  const placed: ScheduleResult["placed"] = [];

  for (const match of sorted) {
    const earliestDependency = match.dependsOn.reduce<Date | null>((max, depId) => {
      const dep = placedByMatch.get(depId);
      if (!dep) return max;
      return !max || dep.end > max ? dep.end : max;
    }, null);
    // Bağımlılığı henüz yerleşmemişse (ör. döngüsel ya da henüz planlanmamış) bu maç şimdilik atlanır.
    if (match.dependsOn.length > 0 && match.dependsOn.some((d) => !placedByMatch.has(d))) {
      unplaced.push(match.id);
      continue;
    }

    let chosen: SlotInstance | undefined;
    for (const slot of slots) {
      if (earliestDependency && slot.start < earliestDependency) continue;
      if (hasConflict(match, slot, placedByMatch, placedByParticipant, unavailableByParticipant, constraints)) continue;
      chosen = slot;
      break;
    }

    if (!chosen) {
      unplaced.push(match.id);
      continue;
    }

    placedByMatch.set(match.id, { venueId: chosen.venueId, start: chosen.start, end: chosen.end });
    for (const pid of match.participantIds) {
      const list = placedByParticipant.get(pid) ?? [];
      list.push({ start: chosen.start, end: chosen.end });
      placedByParticipant.set(pid, list);
    }
    placed.push({ matchId: match.id, venueId: chosen.venueId, start: chosen.start });
  }

  return { placed, unplaced };
}

function hasConflict(
  match: SchedulableMatch,
  slot: SlotInstance,
  placedByMatch: Map<string, { venueId: string; start: Date; end: Date }>,
  placedByParticipant: Map<string, { start: Date; end: Date }[]>,
  unavailableByParticipant: Map<string, { start: Date; end: Date }[]>,
  constraints: ScheduleConstraints,
): boolean {
  // Aynı saha+zaman başka bir maçta kullanılmış mı.
  for (const placed of placedByMatch.values()) {
    if (placed.venueId === slot.venueId && overlaps(placed.start, placed.end, slot.start, slot.end)) return true;
  }

  for (const pid of match.participantIds) {
    const windows = unavailableByParticipant.get(pid) ?? [];
    if (windows.some((w) => overlaps(w.start, w.end, slot.start, slot.end))) return true;

    const existing = placedByParticipant.get(pid) ?? [];
    const sameDay = existing.filter((e) => isSameDay(e.start, slot.start)).length;
    if (sameDay >= constraints.maxMatchesPerDay) return true;

    for (const e of existing) {
      const restBefore = (slot.start.getTime() - e.end.getTime()) / 60_000;
      const restAfter = (e.start.getTime() - slot.end.getTime()) / 60_000;
      if (overlaps(e.start, e.end, slot.start, slot.end)) return true;
      if (slot.start >= e.end && restBefore < constraints.minRestMin) return true;
      if (slot.end <= e.start && restAfter < constraints.minRestMin) return true;
    }
  }
  return false;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
