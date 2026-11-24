import { z } from "zod";

import { validateWindow } from "./domain/state-machine";

export const CANDIDACY_STATEMENT_MAX = 2000;

const isoDate = z
  .string()
  .min(1, { error: "validation.required" })
  .transform((s) => new Date(s));

/** Admin: seçim oluştur (ELECTIONS §3 — kulüp, başlık, 4 tarih). */
export const createElectionSchema = z
  .object({
    clubId: z.string().min(1),
    title: z
      .string()
      .trim()
      .min(2, { error: "validation.required" })
      .max(120, { error: "validation.tooLong" }),
    candidacyOpensAt: isoDate,
    candidacyClosesAt: isoDate,
    votingOpensAt: isoDate,
    votingClosesAt: isoDate,
  })
  .refine((v) => validateWindow(v), { message: "election.errors.invalidDates", path: ["candidacyOpensAt"] });
export type CreateElectionInput = z.infer<typeof createElectionSchema>;

export const candidacySchema = z.object({
  electionId: z.string().min(1),
  statementTr: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(CANDIDACY_STATEMENT_MAX, { error: "validation.tooLong" }),
});
export type CandidacyInput = z.infer<typeof candidacySchema>;

/** Oy: `candidateId` gerçek bir Candidate.id, ya da tek adaylıkta "NO" (Hayır). Değiştirilemez. */
export const castVoteSchema = z.object({
  electionId: z.string().min(1),
  candidateId: z.string().min(1),
});
export type CastVoteInput = z.infer<typeof castVoteSchema>;

/** Yalnızca gizli alanlardan (universityId, electionId/candidateId) okunan action'lar için. */
export const emptySchema = z.object({});
