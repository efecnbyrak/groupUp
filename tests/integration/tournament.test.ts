import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createEventDraft } from "@/modules/event";
import {
  addParticipant,
  createTournament,
  generateBracket,
  generateKnockoutStage,
  getStageMatches,
  getStandings,
  getTournament,
  recordScore,
  removeParticipant,
  renameParticipant,
  updateGroupsSettings,
  updateSeeds,
} from "@/modules/tournament";

import { clubFixture, errorCode, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;

beforeEach(async () => {
  fx = await resetDatabase();
});

async function setupEvent() {
  const fixture = await clubFixture(fx.university.id, { members: 16 });
  const category = await db.eventCategory.create({ data: { slug: `kat-${Date.now()}-${Math.random()}`, nameTr: "Turnuva", nameEn: "Tournament" } });
  const { id: eventId } = await createEventDraft(fixture.president, fixture.club.id, { categoryId: category.id, titleTr: "Satranç" });
  await db.event.update({ where: { id: eventId }, data: { status: "PUBLISHED", summaryTr: "x", locationName: "Salon", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), applyOpensAt: new Date(Date.now() - 1000), applyClosesAt: new Date(Date.now() + 3600_000), publishedAt: new Date() } });
  return { ...fixture, eventId };
}

/** `count` kabul edilmiş bireysel kayıt oluşturur (doğrudan DB, F7'de test edilen başvuru akışını tekrar etmez). */
async function acceptIndividuals(eventId: string, members: { id: string }[], count: number) {
  for (let i = 0; i < count; i++) {
    await db.registration.create({ data: { eventId, userId: members[i]!.id, status: "ACCEPTED", answers: {}, profileSnapshot: {} } });
  }
}

describe("turnuva oluşturma", () => {
  it("kabul edilmiş bireysel başvurulardan katılımcı çeker", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 5);
    const { id } = await createTournament(president, club.id, eventId, { name: "Satranç Turnuvası", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    const t = await getTournament(club.id, id);
    expect(t?.participants).toHaveLength(5);
    expect(t?.status).toBe("DRAFT");
  });

  it("katılımcı yoksa NO_PARTICIPANTS verir", async () => {
    const { club, president, eventId } = await setupEvent();
    expect(await errorCode(createTournament(president, club.id, eventId, { name: "T", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false }))).toBe("NO_PARTICIPANTS");
  });

  it("elle liste ile oluşturulabilir", async () => {
    const { club, president, eventId } = await setupEvent();
    const { id } = await createTournament(president, club.id, eventId, { name: "T", format: "ROUND_ROBIN", source: "MANUAL", manualNames: ["Ali", "Veli", "Ayşe"], isPublic: false });
    const t = await getTournament(club.id, id);
    expect(t?.participants.map((p) => p.displayName).sort()).toEqual(["Ali", "Ayşe", "Veli"]);
  });
});

describe("tek eleme: tohum, braket üretimi, skor + ilerleme", () => {
  async function makeSingleElim(n: number) {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, n);
    const { id } = await createTournament(president, club.id, eventId, { name: "T", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    return { club, president, tournamentId: id };
  }

  it("TOO_FEW_PARTICIPANTS tek katılımcıda", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 1);
    const { id } = await createTournament(president, club.id, eventId, { name: "T", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    expect(await errorCode(generateBracket(president, club.id, id))).toBe("TOO_FEW_PARTICIPANTS");
  });

  it("tohumlar düzenlenebilir (DRAFT iken), braket üretilince kilitlenir", async () => {
    const { club, president, tournamentId } = await makeSingleElim(4);
    const t = await getTournament(club.id, tournamentId);
    const seeds = t!.participants.map((p, i) => ({ participantId: p.id, seed: t!.participants.length - i }));
    await updateSeeds(president, club.id, tournamentId, seeds);
    await generateBracket(president, club.id, tournamentId);
    expect(await errorCode(updateSeeds(president, club.id, tournamentId, seeds))).toBe("NOT_EDITABLE");
  });

  it("5 katılımcı: 3 bye, round1'de 1 gerçek maç, round2 finalde yarı final kazananıyla eşleşir", async () => {
    const { club, president, tournamentId } = await makeSingleElim(5);
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const stage = t!.stages[0]!;
    const matches = await getStageMatches(stage.id);
    const byes = matches.filter((m) => m.status === "BYE");
    expect(byes).toHaveLength(3);
    expect(matches.filter((m) => m.round === 1 && m.status === "PENDING")).toHaveLength(1);
    expect(matches.filter((m) => m.round === 2)).toHaveLength(2); // final + 3.lük yok (varsayılan kapalı)
  });

  it("skor girilince kazanan bir sonraki maça ilerler", async () => {
    const { club, president, tournamentId } = await makeSingleElim(4);
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const stage = t!.stages[0]!;
    let matches = await getStageMatches(stage.id);
    const m1 = matches.find((m) => m.round === 1 && m.position === 0)!;
    await recordScore(president, club.id, m1.id, { homeScore: 2, awayScore: 1 });
    matches = await getStageMatches(stage.id);
    const updated = matches.find((m) => m.id === m1.id)!;
    expect(updated.status).toBe("COMPLETED");
    expect(updated.winnerId).toBe(m1.homeId);
    const final = matches.find((m) => m.round === 2)!;
    expect(final.homeId === m1.homeId || final.awayId === m1.homeId).toBe(true);
  });

  it("eleme maçında beraberlik INVALID_SCORE verir", async () => {
    const { club, president, tournamentId } = await makeSingleElim(4);
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const matches = await getStageMatches(t!.stages[0]!.id);
    const m1 = matches.find((m) => m.round === 1)!;
    expect(await errorCode(recordScore(president, club.id, m1.id, { homeScore: 1, awayScore: 1 }))).toBe("INVALID_SCORE");
  });

  it("düzeltme: sonraki maç oynanmadıysa doğrudan güncellenir, oynandıysa onay ister ve zincirleme sıfırlar", async () => {
    const { club, president, tournamentId } = await makeSingleElim(4);
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const stage = t!.stages[0]!;
    let matches = await getStageMatches(stage.id);
    const m1 = matches.find((m) => m.round === 1 && m.position === 0)!;
    const m2 = matches.find((m) => m.round === 1 && m.position === 1)!;
    await recordScore(president, club.id, m1.id, { homeScore: 2, awayScore: 0 });

    // Sonraki maç (final) henüz oynanmadı → düzeltme serbest.
    await recordScore(president, club.id, m1.id, { homeScore: 0, awayScore: 2 });
    matches = await getStageMatches(stage.id);
    expect(matches.find((m) => m.id === m1.id)!.winnerId).toBe(m1.awayId);

    // Final de oynandıktan sonra m1'i düzeltmeye çalış → onay gerekir.
    await recordScore(president, club.id, m2.id, { homeScore: 1, awayScore: 0 });
    matches = await getStageMatches(stage.id);
    const final = matches.find((m) => m.round === 2)!;
    await recordScore(president, club.id, final.id, { homeScore: 3, awayScore: 1 });

    expect(await errorCode(recordScore(president, club.id, m1.id, { homeScore: 2, awayScore: 0 }))).toBe("DOWNSTREAM_PLAYED");
    await recordScore(president, club.id, m1.id, { homeScore: 2, awayScore: 0, forceCascade: true });
    matches = await getStageMatches(stage.id);
    const finalAfter = matches.find((m) => m.round === 2)!;
    // Final sıfırlandı: eski kazananın yeri boşaldı, yeniden oynanmayı bekliyor.
    expect(finalAfter.status).toBe("PENDING");
    expect(finalAfter.homeScore).toBeNull();
  });

  it("3.lük maçı: yarı final kaybedenleri ayrı maça yerleşir", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id: tournamentId } = await createTournament(president, club.id, eventId, { name: "T", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    const current = (await getTournament(club.id, tournamentId))!;
    await db.tournament.update({ where: { id: tournamentId }, data: { settings: { ...(current.settings as object), thirdPlaceMatch: true } } });
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const stage = t!.stages[0]!;
    let matches = await getStageMatches(stage.id);
    const round1 = matches.filter((m) => m.round === 1);
    expect(round1).toHaveLength(4);
    for (const m of round1) await recordScore(president, club.id, m.id, { homeScore: 3, awayScore: 1 });

    matches = await getStageMatches(stage.id);
    const semis = matches.filter((m) => m.round === 2 && !m.groupKey);
    expect(semis).toHaveLength(2);
    for (const semi of semis) await recordScore(president, club.id, semi.id, { homeScore: 3, awayScore: 1 });
    matches = await getStageMatches(stage.id);
    const third = matches.find((m) => m.groupKey === "THIRD_PLACE")!;
    expect(third.homeId).not.toBeNull();
    expect(third.awayId).not.toBeNull();
    // Üçüncülük maçındaki iki kişi, yarı finalin KAYBEDENLERİ olmalı (kazananlar final'e gitti).
    const finalists = new Set(matches.filter((m) => m.round === 3 && !m.groupKey).flatMap((m) => [m.homeId, m.awayId]));
    expect(finalists.has(third.homeId)).toBe(false);
    expect(finalists.has(third.awayId)).toBe(false);
  });
});

describe("lig (round robin)", () => {
  it("fikstür üretilir, puan tablosu doğru hesaplanır", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 4);
    const { id: tournamentId } = await createTournament(president, club.id, eventId, { name: "Lig", format: "ROUND_ROBIN", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const stage = t!.stages[0]!;
    const matches = await getStageMatches(stage.id);
    expect(matches).toHaveLength(6); // 4*3/2

    // Tohum sırasındaki ilk katılımcı her maçını kazansın (ev/deplasman fark etmeksizin).
    const champion = t!.participants[0]!.id;
    for (const m of matches) {
      const championIsHome = m.homeId === champion;
      await recordScore(president, club.id, m.id, { homeScore: championIsHome ? 2 : 0, awayScore: championIsHome ? 0 : 2 });
    }
    const { rows, names } = await getStandings(t!.settings, { stageId: stage.id });
    const championRow = rows.find((r) => names.get(r.index) === t!.participants[0]!.displayName)!;
    expect(championRow.points).toBe(9); // 3 galibiyet
    expect(rows[0]).toBe(championRow); // açık ara 1.
    const finished = await getTournament(club.id, tournamentId);
    expect(finished?.status).toBe("COMPLETED");
  });
});

describe("grup + eleme", () => {
  it("grup ayarları eksikse braket üretilemez; grup maçları bitmeden eleme oluşturulamaz", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id: tournamentId } = await createTournament(president, club.id, eventId, { name: "T", format: "GROUPS_KNOCKOUT", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    expect(await errorCode(generateBracket(president, club.id, tournamentId))).toBe("NOT_EDITABLE");
    await updateGroupsSettings(president, club.id, tournamentId, { groupCount: 2, advancePerGroup: 2, bestThirds: 0 });
    await generateBracket(president, club.id, tournamentId);
    const t = await getTournament(club.id, tournamentId);
    const groupStage = t!.stages[0]!;
    expect(await errorCode(generateKnockoutStage(president, club.id, tournamentId, groupStage.id))).toBe("GROUPS_NOT_DONE");
  });

  it("uçtan uca: 2 grup × 4, grup maçları biter, eleme aşaması çapraz eşleşmeli oluşur", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 8);
    const { id: tournamentId } = await createTournament(president, club.id, eventId, { name: "T", format: "GROUPS_KNOCKOUT", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await updateGroupsSettings(president, club.id, tournamentId, { groupCount: 2, advancePerGroup: 2, bestThirds: 0 });
    await generateBracket(president, club.id, tournamentId);
    let t = await getTournament(club.id, tournamentId);
    const groupStage = t!.stages[0]!;
    expect(groupStage.groups).toHaveLength(2);

    const matches = await getStageMatches(groupStage.id);
    for (const m of matches) await recordScore(president, club.id, m.id, { homeScore: m.homeId! < m.awayId! ? 2 : 1, awayScore: m.homeId! < m.awayId! ? 1 : 2 });

    await generateKnockoutStage(president, club.id, tournamentId, groupStage.id);
    t = await getTournament(club.id, tournamentId);
    expect(t!.stages).toHaveLength(2);
    const koStage = t!.stages.find((s) => s.type === "KNOCKOUT")!;
    const koMatches = await getStageMatches(koStage.id);
    expect(koMatches.filter((m) => m.round === 1)).toHaveLength(2);

    // İkinci kez oluşturmaya çalışmak STAGE_EXISTS vermeli.
    expect(await errorCode(generateKnockoutStage(president, club.id, tournamentId, groupStage.id))).toBe("STAGE_EXISTS");
  });
});

describe("katılımcı yönetimi", () => {
  it("DRAFT'ta katılımcı eklenebilir/çıkarılabilir; başladıktan sonra yalnızca isim değişir", async () => {
    const { club, president, eventId, members } = await setupEvent();
    await acceptIndividuals(eventId, members, 4);
    const { id: tournamentId } = await createTournament(president, club.id, eventId, { name: "T", format: "SINGLE_ELIM", source: "INDIVIDUALS", manualNames: [], isPublic: false });
    await addParticipant(president, club.id, tournamentId, "Ek Katılımcı");
    let t = await getTournament(club.id, tournamentId);
    expect(t?.participants).toHaveLength(5);
    const toRemove = t!.participants[0]!;
    await removeParticipant(president, club.id, tournamentId, toRemove.id);
    t = await getTournament(club.id, tournamentId);
    expect(t?.participants).toHaveLength(4);

    await generateBracket(president, club.id, tournamentId);
    // SEEDED: fikstür hazır ama henüz oynanmadı — katılımcı eklemek hâlâ serbest (TOURNAMENTS §7).
    await addParticipant(president, club.id, tournamentId, "Geç Katılımcı");
    t = await getTournament(club.id, tournamentId);
    expect(t?.participants).toHaveLength(5);

    // İlk skor girilince turnuva IN_PROGRESS olur — artık katılımcı eklenemez/çıkarılamaz, yalnızca isim.
    const stage = t!.stages[0]!;
    const firstMatch = (await getStageMatches(stage.id)).find((m) => m.status === "PENDING")!;
    await recordScore(president, club.id, firstMatch.id, { homeScore: 2, awayScore: 0 });
    expect((await getTournament(club.id, tournamentId))?.status).toBe("IN_PROGRESS");
    expect(await errorCode(addParticipant(president, club.id, tournamentId, "Çok Geç"))).toBe("NOT_EDITABLE");

    const someone = (await getTournament(club.id, tournamentId))!.participants[0]!;
    await renameParticipant(president, club.id, someone.id, "Yeni İsim");
    t = await getTournament(club.id, tournamentId);
    expect(t?.participants.find((p) => p.id === someone.id)?.displayName).toBe("Yeni İsim");
  });
});
