#!/usr/bin/env node
// WCAG kontrast denetimi — app/tokens.css (sıfır bağımlılık).
// professional-design-system skill'indeki scriptten uyarlandı; ek olarak her [data-panel]
// bloğunu (DESIGN §3.2) :root üzerine bindirip panel vurgu çiftlerini denetler.
// Kullanım: npm run check:contrast   (çıkış kodu 1 → en az bir çift AA altında)
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2] ?? path.join(process.cwd(), "app", "tokens.css");
const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(body) {
  const vars = {};
  for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
  return vars;
}
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
if (!rootMatch) throw new Error(":root bloğu bulunamadı");
const root = declarations(rootMatch[1]);
const panels = [...css.matchAll(/\[data-panel="([\w-]+)"\]\s*\{([^}]*)\}/g)].map(([, name, body]) => [name, { ...root, ...declarations(body) }]);

function resolve(vars, value, depth = 0) {
  if (depth > 10) return value;
  return value.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fb) => resolve(vars, vars[name] ?? fb ?? "", depth + 1));
}
function toRgb(v) {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lum = (rgb) => {
  const c = rgb.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const TEXT = 4.5;
const UI = 3;
const basePairs = [
  ["--color-text", "--color-bg", TEXT], ["--color-text", "--color-bg-subtle", TEXT], ["--color-text", "--color-surface-muted", TEXT],
  ["--color-text-secondary", "--color-bg", TEXT], ["--color-text-secondary", "--color-bg-subtle", TEXT], ["--color-text-secondary", "--color-surface-muted", TEXT],
  ["--color-text-tertiary", "--color-bg", TEXT], ["--color-text-tertiary", "--color-surface", TEXT],
  ["--color-success", "--color-bg", TEXT], ["--color-success", "--color-success-subtle", TEXT],
  ["--color-warning", "--color-bg", TEXT], ["--color-warning", "--color-warning-subtle", TEXT],
  ["--color-danger", "--color-bg", TEXT], ["--color-danger", "--color-danger-subtle", TEXT],
  ["--color-info", "--color-info-subtle", TEXT],
  ["--color-on-danger", "--color-danger-fill", TEXT, "tehlike düğmesi / sayaç rozeti"],
  ["--color-text-inverse", "--color-surface-inverse", TEXT, "toast / dil seçici"],
  ["--color-border-input", "--color-bg", UI, "form kontrol sınırı"], ["--color-border-input", "--color-surface", UI, "form kontrol sınırı"],
];
// Panel rengine bağlı çiftler: hem :root (marka) hem her panel için.
const accentPairs = [
  ["--color-on-primary", "--color-primary", TEXT, "birincil düğme"],
  ["--color-on-primary", "--color-primary-hover", TEXT], ["--color-on-primary", "--color-primary-active", TEXT],
  ["--color-primary", "--color-bg", TEXT, "aktif sekme / hayalet etiket"], ["--color-primary", "--color-surface", TEXT],
  ["--color-primary", "--color-primary-subtle", TEXT, "aktif menü öğesi"],
  ["--color-primary-active", "--color-primary-subtle", TEXT, "marka rozeti / avatar"],
  ["--color-link", "--color-bg", TEXT], ["--color-link", "--color-bg-subtle", TEXT], ["--color-link", "--color-surface", TEXT],
  ["--color-focus", "--color-bg", UI, "odak halkası"], ["--color-focus", "--color-surface", UI, "odak halkası"],
  ["--color-primary", "--color-bg", UI, "panel şeridi"],
];

let failures = 0;
function check(title, vars, pairs) {
  console.log(`\n${title}`);
  for (const [fg, bg, min, note] of pairs) {
    const a = toRgb(resolve(vars, vars[fg] ?? ""));
    const b = toRgb(resolve(vars, vars[bg] ?? ""));
    if (!a || !b) {
      failures++;
      console.log(`  FAIL çözülemedi: ${fg} / ${bg}`);
      continue;
    }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1 (min ${min}) ${fg} / ${bg}${note ? ` — ${note}` : ""}`);
  }
}

check(":root (marka)", root, [...basePairs, ...accentPairs]);
for (const [name, vars] of panels) check(`[data-panel="${name}"]`, vars, accentPairs);
console.log(failures ? `\n${failures} çift WCAG AA altında.` : `\nTüm çiftler WCAG AA'yı geçiyor (${panels.length} panel).`);
process.exit(failures ? 1 : 0);
