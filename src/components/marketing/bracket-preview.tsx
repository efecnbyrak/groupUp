import { DEMO_BRACKET, type DemoMatch } from "./demo-data";

/**
 * Statik dört takımlı eleme şeması (SVG). Gerçek Bracket bileşeni F8'de domain verisiyle gelir.
 * Renkler token sınıflarıyla → bulunduğu panelin rengini alır.
 */
const W = 120;
const H = 25;

function Match({ x, y, match }: { x: number; y: number; match: DemoMatch }) {
  const played = match.homeScore !== undefined && match.awayScore !== undefined;
  const homeWon = played && match.homeScore! > match.awayScore!;
  const rows = [
    { name: match.home, score: match.homeScore, win: played && homeWon },
    { name: match.away, score: match.awayScore, win: played && !homeWon },
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={W} height={H * 2} rx="6" className="fill-card stroke-line-strong" />
      <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" />
      {rows.map((r, i) => (
        <g key={r.name} transform={`translate(0 ${i * H})`}>
          {r.win ? <rect x="1" y="1" width="3" height={H - 2} className="fill-brand" /> : null}
          <text x="10" y={H / 2 + 4} className={r.win ? "fill-fg font-semibold" : "fill-(--color-text-secondary)"} fontSize="11">
            {r.name}
          </text>
          <text x={W - 10} y={H / 2 + 4} textAnchor="end" className={r.win ? "fill-fg font-semibold" : "fill-(--color-text-secondary)"} fontSize="11">
            {r.score ?? "–"}
          </text>
        </g>
      ))}
    </g>
  );
}

export function BracketPreview({ label, semiLabel, finalLabel, className }: { label: string; semiLabel: string; finalLabel: string; className?: string }) {
  const { semis, final } = DEMO_BRACKET;
  return (
    <svg viewBox="0 0 300 170" role="img" aria-label={label} className={className}>
      <text x="0" y="12" fontSize="10" className="fill-(--color-text-secondary) font-semibold uppercase">
        {semiLabel}
      </text>
      <text x="180" y="12" fontSize="10" className="fill-(--color-text-secondary) font-semibold uppercase">
        {finalLabel}
      </text>
      <Match x={0} y={20} match={semis[0]} />
      <Match x={0} y={110} match={semis[1]} />
      <path d={`M${W} 45 H150 V135 H${W} M150 90 H180`} className="fill-none stroke-line-strong" strokeWidth="1.5" />
      <Match x={180} y={65} match={final} />
    </svg>
  );
}
