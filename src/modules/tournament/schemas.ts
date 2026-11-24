import { z } from "zod";

const id = z.string().trim().min(1).max(40);
const text = (max: number) => z.string().trim().min(1, { error: "validation.required" }).max(max, { error: "validation.tooLong" });

export const TOURNAMENT_FORMATS = ["SINGLE_ELIM", "ROUND_ROBIN", "GROUPS_KNOCKOUT"] as const;
export const PARTICIPANT_SOURCES = ["TEAMS", "INDIVIDUALS", "MANUAL"] as const;
export const TIEBREAKERS = ["POINTS", "HEAD_TO_HEAD", "GOAL_DIFF", "GOALS_FOR", "WINS", "LOT"] as const;

const jsonField = <S extends z.ZodType>(schema: S) =>
  z
    .string()
    .max(100_000)
    .transform((v, ctx) => {
      try {
        return JSON.parse(v || "null") as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "validation.invalid" });
        return z.NEVER;
      }
    })
    .pipe(schema);

export const settingsSchema = z.object({
  points: z.object({ win: z.number().int().min(0).max(10), draw: z.number().int().min(0).max(10), loss: z.number().int().min(0).max(10) }),
  allowDraws: z.boolean(),
  tiebreakers: z.array(z.enum(TIEBREAKERS)).max(6),
  thirdPlaceMatch: z.boolean(),
  doubleRoundRobin: z.boolean(),
  groups: z.object({ count: z.number().int().min(2).max(16), advancePerGroup: z.number().int().min(1).max(8), bestThirds: z.number().int().min(0).max(8).optional() }).nullish(),
  scoreLabel: z.string().max(20).default("Skor"),
});
export type TournamentSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: TournamentSettings = {
  points: { win: 3, draw: 1, loss: 0 },
  allowDraws: true,
  tiebreakers: ["POINTS", "HEAD_TO_HEAD", "GOAL_DIFF", "GOALS_FOR", "WINS"],
  thirdPlaceMatch: false,
  doubleRoundRobin: false,
  groups: null,
  scoreLabel: "Skor",
};

export const createTournamentSchema = z.object({
  eventId: id,
  name: text(120),
  format: z.enum(TOURNAMENT_FORMATS),
  source: z.enum(PARTICIPANT_SOURCES),
  manualNames: z
    .string()
    .max(10_000)
    .optional()
    .transform((v) => (v ? v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 256) : [])),
  isPublic: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const tournamentIdSchema = z.object({ tournamentId: id });
export const updateSettingsSchema = z.object({ tournamentId: id, settings: jsonField(settingsSchema) });
export const seedSchema = z.object({ tournamentId: id, seeds: jsonField(z.array(z.object({ participantId: id, seed: z.number().int().min(1).max(1000) }))) });
export const groupsSchema = z.object({ tournamentId: id, groupCount: z.coerce.number().int().min(2).max(16), advancePerGroup: z.coerce.number().int().min(1).max(8), bestThirds: z.coerce.number().int().min(0).max(8).default(0) });
export const generateBracketSchema = z.object({ tournamentId: id });
export const generateKnockoutSchema = z.object({ tournamentId: id, stageId: id });

export const recordScoreSchema = z.object({
  matchId: id,
  homeScore: z.coerce.number().int().min(0).max(999),
  awayScore: z.coerce.number().int().min(0).max(999),
  forceCascade: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
export const walkoverSchema = z.object({ matchId: id, winner: z.enum(["home", "away"]), reason: text(300) });
export const postponeSchema = z.object({ matchId: id, note: z.string().trim().max(300).optional() });
export const matchIdSchema = z.object({ matchId: id });

export const participantNameSchema = z.object({ participantId: id, displayName: text(80) });
export const removeParticipantSchema = z.object({ tournamentId: id, participantId: id });
export const addParticipantSchema = z.object({ tournamentId: id, displayName: text(80), seed: z.coerce.number().int().min(1).max(1000).optional() });
