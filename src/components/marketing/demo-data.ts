/**
 * Landing demo verisi (DESIGN §5). Canlıda istatistikler gerçek sayımla değişir (seed-demo).
 * Takım adları özel isimdir, çevrilmez.
 */
export const DEMO_STATS = { clubs: 24, events: 180, applications: 3200, tournaments: 40 } as const;

export type DemoMatch = { home: string; away: string; homeScore?: number; awayScore?: number };

export const DEMO_BRACKET: { semis: [DemoMatch, DemoMatch]; final: DemoMatch } = {
  semis: [
    { home: "Kartallar", away: "Yıldızlar", homeScore: 3, awayScore: 1 },
    { home: "Şimşekler", away: "Fırtına", homeScore: 0, awayScore: 2 },
  ],
  final: { home: "Kartallar", away: "Fırtına" },
};
