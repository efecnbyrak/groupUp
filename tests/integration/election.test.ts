import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { decideRequest, submitRequest } from "@/modules/approval";
import { applyCandidacy, castVote, createElection, decideCandidacy, markResultPending, stageClosedResults, syncElectionTimeStatus } from "@/modules/election";

import { clubFixture, errorCode, lastMailTo, resetDatabase } from "./helpers";

type Fixture = Awaited<ReturnType<typeof resetDatabase>>;
let fx: Fixture;

beforeEach(async () => {
  fx = await resetDatabase();
});

const HOUR = 3600_000;

/** Üyeliği `before`'dan önce katılmış gibi geriye tarihler (eligibleSnapshotAt testleri için). */
async function backdateMemberships(clubId: string, before: Date) {
  await db.membership.updateMany({ where: { clubId }, data: { joinedAt: new Date(before.getTime() - HOUR) } });
}

function windowFrom(now: number, offsets: { candidacyOpensAt: number; candidacyClosesAt: number; votingOpensAt: number; votingClosesAt: number }) {
  return {
    candidacyOpensAt: new Date(now + offsets.candidacyOpensAt),
    candidacyClosesAt: new Date(now + offsets.candidacyClosesAt),
    votingOpensAt: new Date(now + offsets.votingOpensAt),
    votingClosesAt: new Date(now + offsets.votingClosesAt),
  };
}

describe("createElection", () => {
  it("tarihler sıralı değilse INVALID_DATES", async () => {
    const { club, admin } = await clubFixture(fx.university.id);
    const now = Date.now();
    const bad = windowFrom(now, { candidacyOpensAt: 0, candidacyClosesAt: 2 * HOUR, votingOpensAt: HOUR, votingClosesAt: 3 * HOUR });
    await expect(createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...bad })).rejects.toMatchObject({ code: "INVALID_DATES" });
  });

  it("aynı kulüpte devam eden seçim varsa ACTIVE_ELECTION_EXISTS", async () => {
    const { club, admin } = await clubFixture(fx.university.id);
    const now = Date.now();
    const w = windowFrom(now, { candidacyOpensAt: 0, candidacyClosesAt: HOUR, votingOpensAt: HOUR, votingClosesAt: 2 * HOUR });
    await createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...w });
    expect(await errorCode(createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık 2", ...w }))).toBe("ACTIVE_ELECTION_EXISTS");
  });
});

describe("adaylık", () => {
  it("adaylık penceresi dışında NOT_CANDIDACY_WINDOW", async () => {
    const { club, admin, members } = await clubFixture(fx.university.id);
    const now = Date.now();
    const w = windowFrom(now, { candidacyOpensAt: HOUR, candidacyClosesAt: 2 * HOUR, votingOpensAt: 2 * HOUR, votingClosesAt: 3 * HOUR });
    await createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...w });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    expect(await errorCode(applyCandidacy(members[0]!, election.id, "Merhaba"))).toBe("NOT_CANDIDACY_WINDOW");
  });

  it("başka kulübün başkanı aday olamaz", async () => {
    const { club, admin, members } = await clubFixture(fx.university.id, { prefix: "a" });
    const other = await clubFixture(fx.university.id, { prefix: "b" });
    const now = Date.now();
    const w = windowFrom(now, { candidacyOpensAt: -HOUR, candidacyClosesAt: HOUR, votingOpensAt: HOUR, votingClosesAt: 2 * HOUR });
    await createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...w });
    await db.membership.create({ data: { clubId: club.id, userId: other.president.id, joinedVia: "code" } });
    await syncElectionTimeStatus(new Date(now));
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    expect(election.status).toBe("CANDIDACY");
    expect(await errorCode(applyCandidacy(other.president, election.id, "Merhaba"))).toBe("NOT_ELIGIBLE");
    expect(await errorCode(applyCandidacy(members[0]!, election.id, "Merhaba"))).toBe("NO_ERROR");
    expect(await errorCode(applyCandidacy(members[0]!, election.id, "Tekrar"))).toBe("ALREADY_CANDIDATE");
  });
});

describe("oy verme ve sayım", () => {
  async function votingElection(prefix = "v") {
    const { club, admin, members } = await clubFixture(fx.university.id, { prefix, members: 4 });
    const now = Date.now();
    const w = windowFrom(now, { candidacyOpensAt: -2 * HOUR, candidacyClosesAt: -HOUR, votingOpensAt: -HOUR, votingClosesAt: HOUR });
    await createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...w });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    // adaylık penceresi de geçmişte kalacak şekilde kuruldu (votingOpensAt < şimdi): adaylar doğrudan eklenir,
    // oy penceresi gerçekten açık olduğundan castVote (servis) testle birebir aynı yoldan çağrılabilir.
    const candidateA = await db.candidate.create({ data: { electionId: election.id, userId: members[0]!.id, statementTr: "Program A", approved: true } });
    const candidateB = await db.candidate.create({ data: { electionId: election.id, userId: members[1]!.id, statementTr: "Program B", approved: true } });
    const snapshot = new Date(now - HOUR);
    await backdateMemberships(club.id, snapshot);
    await db.election.update({ where: { id: election.id }, data: { status: "VOTING", eligibleSnapshotAt: snapshot } });
    return { club, admin, members, election, candidates: [candidateA, candidateB] };
  }

  it("kişi başı bir oy; ikinci oy ALREADY_VOTED", async () => {
    const { members, election, candidates } = await votingElection();
    await castVote(members[2]!, election.id, candidates[0]!.id);
    expect(await errorCode(castVote(members[2]!, election.id, candidates[0]!.id))).toBe("ALREADY_VOTED");
  });

  it("onaylanmamış/yanlış adaya oy INVALID_CANDIDATE", async () => {
    const { members, election } = await votingElection();
    expect(await errorCode(castVote(members[2]!, election.id, "olmayan-id"))).toBe("INVALID_CANDIDATE");
  });

  it("Vote ve BallotReceipt bağlantısız: oy sayısı doğru, kimin kime oy verdiği Vote'tan çıkmaz", async () => {
    const { members, election, candidates } = await votingElection();
    await castVote(members[2]!, election.id, candidates[0]!.id);
    await castVote(members[3]!, election.id, candidates[0]!.id);
    await castVote(members[0]!, election.id, candidates[1]!.id); // kendine oy veremez diye bir kural yok, aday da üye
    const votes = await db.vote.findMany({ where: { electionId: election.id } });
    expect(votes.every((v) => !("userId" in v))).toBe(true);
    expect(await db.ballotReceipt.count({ where: { electionId: election.id } })).toBe(3);
    expect(votes.filter((v) => v.candidateId === candidates[0]!.id).length).toBe(2);
  });

  it("stageClosedResults: çoklu adaylıkta en çok oyu alan kazanır", async () => {
    const { election, candidates, members } = await votingElection("m");
    await castVote(members[2]!, election.id, candidates[0]!.id);
    await castVote(members[3]!, election.id, candidates[0]!.id);
    await castVote(members[0]!, election.id, candidates[1]!.id);
    await db.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });
    const [staged] = await stageClosedResults();
    expect(staged).toMatchObject({ electionId: election.id, winnerUserId: candidates[0]!.userId, tie: false, totalBallots: 3 });
  });

  it("tek adaylıkta Evet/Hayır: Hayır fazlaysa kazanan yok", async () => {
    const { club, admin, members } = await clubFixture(fx.university.id, { prefix: "s", members: 3 });
    const now = Date.now();
    const w = windowFrom(now, { candidacyOpensAt: -2 * HOUR, candidacyClosesAt: -HOUR, votingOpensAt: -HOUR, votingClosesAt: HOUR });
    await createElection(admin, fx.university.id, { clubId: club.id, title: "Başkanlık", ...w });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    const candidate = await db.candidate.create({ data: { electionId: election.id, userId: members[0]!.id, statementTr: "Program A", approved: true } });
    const snapshot = new Date(now - HOUR);
    await backdateMemberships(club.id, snapshot);
    await db.election.update({ where: { id: election.id }, data: { status: "VOTING", eligibleSnapshotAt: snapshot } });
    await castVote(members[1]!, election.id, "NO");
    await castVote(members[2]!, election.id, "NO");
    await db.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });
    const [staged] = await stageClosedResults();
    expect(staged).toMatchObject({ winnerUserId: null, tie: false });
    void candidate;
  });
});

describe("zaman tabanlı geçiş + onay akışı (ELECTION_RESULT)", () => {
  it("DRAFT→CANDIDACY→VOTING→CLOSED senkronu ve sonuç onayı başkanı değiştirir", async () => {
    const { club, admin, members } = await clubFixture(fx.university.id, { prefix: "e", members: 3 });
    const now = Date.now();
    await createElection(admin, fx.university.id, {
      clubId: club.id,
      title: "Başkanlık",
      candidacyOpensAt: new Date(now - 10 * HOUR),
      candidacyClosesAt: new Date(now - 9 * HOUR),
      votingOpensAt: new Date(now - 8 * HOUR),
      votingClosesAt: new Date(now - HOUR),
    });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    expect(election.status).toBe("DRAFT");

    // sync, zamanı geçmiş tüm pencereleri atlayıp doğrudan CLOSED'a taşır
    await syncElectionTimeStatus(new Date(now));
    const closed = await db.election.findUniqueOrThrow({ where: { id: election.id } });
    expect(closed.status).toBe("CLOSED");
    expect(closed.eligibleSnapshotAt).not.toBeNull();

    // adaylık/oy pencereleri zaten geçmiş; sonucu elle kurup (candidacy adaylık penceresi kapanmış olduğundan
    // applyCandidacy burada kullanılamaz) doğrudan aday ekleyip oy veriyoruz, ardından CLOSED'a geri alıyoruz
    // castVote gerçek "şimdi"ye göre pencere kontrolü yapar: votingClosesAt'i geçici olarak ileri alıyoruz.
    await db.election.update({ where: { id: election.id }, data: { status: "VOTING", votingClosesAt: new Date(now + HOUR) } });
    await backdateMemberships(club.id, new Date(now - 8 * HOUR));
    const candidate = await db.candidate.create({ data: { electionId: election.id, userId: members[0]!.id, approved: true } });
    await castVote(members[1]!, election.id, candidate.id);
    await castVote(members[2]!, election.id, candidate.id);
    await db.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });

    const [staged] = await stageClosedResults();
    expect(staged).toMatchObject({ winnerUserId: members[0]!.id, tie: false, totalBallots: 2 });
    const { id: requestId } = await submitRequest({ id: staged!.createdById }, {
      type: "ELECTION_RESULT",
      universityId: fx.university.id,
      clubId: club.id,
      payload: { electionId: staged!.electionId, winnerUserId: staged!.winnerUserId, tie: staged!.tie, counts: staged!.counts, totalBallots: staged!.totalBallots },
    });
    await markResultPending(election.id);
    expect((await db.election.findUniqueOrThrow({ where: { id: election.id } })).status).toBe("RESULT_PENDING");

    // ikinci kez stage edilmez (ChangeRequest zaten var)
    expect(await stageClosedResults()).toHaveLength(0);

    await decideRequest(admin, fx.university.id, requestId, "APPROVE", null);
    const finalElection = await db.election.findUniqueOrThrow({ where: { id: election.id } });
    expect(finalElection.status).toBe("FINALIZED");
    expect(finalElection.winnerUserId).toBe(members[0]!.id);
    const finalClub = await db.club.findUniqueOrThrow({ where: { id: club.id } });
    expect(finalClub.presidentId).toBe(members[0]!.id);
    expect(lastMailTo(members[0]!.email)?.subject).toMatch(/seçim/i);
  });

  it("ret: seçim CANCELLED olur, başkan değişmez", async () => {
    const { club, admin, president, members } = await clubFixture(fx.university.id, { prefix: "r", members: 2 });
    const now = Date.now();
    await createElection(admin, fx.university.id, {
      clubId: club.id,
      title: "Başkanlık",
      candidacyOpensAt: new Date(now - 4 * HOUR),
      candidacyClosesAt: new Date(now - 3 * HOUR),
      votingOpensAt: new Date(now - 2 * HOUR),
      votingClosesAt: new Date(now + HOUR), // oy penceresi hâlâ açık: castVote gerçek "şimdi"ye göre kontrol eder
    });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    await syncElectionTimeStatus(new Date(now));
    expect((await db.election.findUniqueOrThrow({ where: { id: election.id } })).status).toBe("VOTING");
    await backdateMemberships(club.id, new Date(now - 2 * HOUR));
    const candidate = await db.candidate.create({ data: { electionId: election.id, userId: members[0]!.id, approved: true } });
    await castVote(members[1]!, election.id, candidate.id);
    await db.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });
    const [staged] = await stageClosedResults();
    const { id: requestId } = await submitRequest({ id: staged!.createdById }, {
      type: "ELECTION_RESULT",
      universityId: fx.university.id,
      clubId: club.id,
      payload: { electionId: staged!.electionId, winnerUserId: staged!.winnerUserId, tie: staged!.tie, counts: staged!.counts, totalBallots: staged!.totalBallots },
    });
    await markResultPending(election.id);
    await decideRequest(admin, fx.university.id, requestId, "REJECT", "Oy sayımında şüpheli durum.");
    expect((await db.election.findUniqueOrThrow({ where: { id: election.id } })).status).toBe("CANCELLED");
    expect((await db.club.findUniqueOrThrow({ where: { id: club.id } })).presidentId).toBe(president.id);
  });
});

describe("decideCandidacy", () => {
  it("reddedilen aday pusuladan silinir", async () => {
    const { club, admin, members } = await clubFixture(fx.university.id);
    const now = Date.now();
    await createElection(admin, fx.university.id, {
      clubId: club.id,
      title: "Başkanlık",
      candidacyOpensAt: new Date(now - HOUR),
      candidacyClosesAt: new Date(now + HOUR),
      votingOpensAt: new Date(now + HOUR),
      votingClosesAt: new Date(now + 2 * HOUR),
    });
    const election = await db.election.findFirstOrThrow({ where: { clubId: club.id } });
    await syncElectionTimeStatus(new Date(now));
    await applyCandidacy(members[0]!, election.id, "Merhaba");
    const candidate = await db.candidate.findFirstOrThrow({ where: { electionId: election.id } });
    await decideCandidacy(fx.university.id, candidate.id, false);
    expect(await db.candidate.count({ where: { electionId: election.id } })).toBe(0);
  });
});
