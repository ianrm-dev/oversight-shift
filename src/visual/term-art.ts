// A small picture of the MECHANISM behind every glossary term: pictures first, at most a few
// two-word labels. Palette: cyan = the model/agent, violet = the trusted model, white = humans,
// red = only the harmful element, green = a check that passed.
import { iconAt, type IconId } from './icons';

const W = 240;
const H = 120;
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);
const n = (v: number) => (Math.round(v * 10) / 10).toString();

type Kind = 'model' | 'trust' | 'bad' | 'dim' | 'copy' | 'ok';

// ---------- Primitives ----------
/** An AI model: rounded square with a core. */
function ai(cx: number, cy: number, s = 30, k: Kind = 'model', extra = ''): string {
  return `<g class="ta-ai ta-k-${k} ${extra}"><rect x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${s}" height="${s}" rx="${n(s * 0.22)}"/><circle cx="${cx}" cy="${cy}" r="${n(s * 0.14)}" class="ta-core"/></g>`;
}
/** Any icon from the shared set, centered, colored by kind. */
function ic(id: IconId, cx: number, cy: number, s = 22, k: Kind | 'human' | 'plain' = 'plain', extra = ''): string {
  return iconAt(id, cx - s / 2, cy - s / 2, s, `ta-k-${k} ${extra}`);
}
const human = (cx: number, cy: number, s = 26) => ic('human', cx, cy, s, 'human');

/** A page with lines: n normal, b bad (red), f flagged (amber), x removed, o ok (green). */
function doc(x: number, y: number, w: number, h: number, lines: string, k = ''): string {
  const step = (h - 10) / Math.max(lines.length, 1);
  const ls = [...lines].map((c, i) => {
    const ly = y + 8 + i * step;
    const len = w - 12 - (i % 2) * 6;
    return `<path d="M${x + 6} ${n(ly)}h${n(len)}" class="ta-line ta-l-${c}"/>`;
  }).join('');
  return `<g class="ta-doc ${k}"><path d="M${x} ${y}h${w - 7}l7 7v${h - 7}h-${w}z"/>${ls}</g>`;
}

function head(x: number, y: number, fromX: number, fromY: number, c: string): string {
  const a = Math.atan2(y - fromY, x - fromX);
  const s = 5.5;
  const p = (da: number) => `${n(x - s * Math.cos(a + da))},${n(y - s * Math.sin(a + da))}`;
  return `<polygon points="${n(x)},${n(y)} ${p(0.45)} ${p(-0.45)}" class="ta-head ${c}"/>`;
}
/** Straight arrow. c: '' | 'bad' | 'ok' | 'dash' | 'trust' | 'flow'. */
function arrow(x1: number, y1: number, x2: number, y2: number, c = ''): string {
  const cls = c.split(' ').map((v) => (v ? `ta-a-${v}` : '')).join(' ');
  return `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" class="ta-a ${cls}"/>${head(x2, y2, x1, y1, cls)}`;
}
/** Curved arrow through a control point. */
function curve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, c = '', arrowhead = true): string {
  const cls = c.split(' ').map((v) => (v ? `ta-a-${v}` : '')).join(' ');
  return `<path d="M${n(x1)} ${n(y1)}Q${n(cx)} ${n(cy)} ${n(x2)} ${n(y2)}" class="ta-a ${cls}"/>${arrowhead ? head(x2, y2, cx, cy, cls) : ''}`;
}
const t = (x: number, y: number, s: string, a: 'start' | 'middle' | 'end' = 'middle', c = '') =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${a}" class="ta-t ${c}">${esc(s)}</text>`;
const check = (cx: number, cy: number, c = 'ok') => `<path d="M${cx - 5} ${cy}l3.5 3.5 6.5-7" class="ta-mark ta-mk-${c}"/>`;
const cross = (cx: number, cy: number, c = 'bad') => `<path d="M${cx - 4.5} ${cy - 4.5}l9 9M${cx + 4.5} ${cy - 4.5}l-9 9" class="ta-mark ta-mk-${c}"/>`;
const box = (x: number, y: number, w: number, h: number, c = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="ta-box ${c}"/>`;
/** A small speech bubble. */
const bubble = (x: number, y: number, w: number, h: number, c = '') =>
  `<path d="M${x + 4} ${y}h${w - 8}q4 0 4 4v${h - 8}q0 4-4 4h-${w - 16}l-6 6v-6h-2q-4 0-4-4v-${h - 8}q0-4 4-4z" class="ta-bubble ${c}"/>`;
/** A simple gauge whose needle points at `v` (0–1). */
function gauge(cx: number, cy: number, r: number, v: number, c = ''): string {
  const a = Math.PI * (1 - v);
  return `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" class="ta-gauge"/><path d="M${cx} ${cy}L${n(cx + r * 0.85 * Math.cos(a))} ${n(cy - r * 0.85 * Math.sin(a))}" class="ta-needle ${c}"/>`;
}
const cylinder = (cx: number, cy: number, w: number, h: number, c = '') =>
  `<g class="ta-cyl ${c}"><ellipse cx="${cx}" cy="${cy - h / 2}" rx="${w / 2}" ry="${n(w / 7)}"/><path d="M${cx - w / 2} ${cy - h / 2}v${h}a${w / 2} ${n(w / 7)} 0 0 0 ${w} 0v-${h}"/></g>`;

// ---------- One picture per term ----------
const ART: Record<string, () => string> = {
  'ai-model': () =>
    doc(14, 34, 30, 40, 'nnn') + doc(22, 42, 30, 40, 'nnnn') + arrow(58, 62, 92, 62) + ai(120, 62, 40) + arrow(146, 62, 176, 62) + bubble(182, 46, 46, 30) +
    t(37, 104, 'data') + t(205, 104, 'answer'),
  'ai-agent': () =>
    ai(52, 60, 42) + arrow(76, 50, 150, 26) + arrow(76, 60, 150, 60) + arrow(76, 70, 150, 94) +
    ic('email', 168, 26, 22) + ic('money', 168, 60, 22) + ic('settings', 168, 94, 22) + t(206, 64, 'acts', 'start'),
  compute: () =>
    ic('compute', 36, 40, 26) + ic('compute', 36, 80, 26) + ic('compute', 70, 60, 26) + curve(90, 60, 110, 44, 136, 60, 'flow') + ai(172, 60, 44) +
    t(52, 112, 'chips + power'),
  deployment: () =>
    ai(50, 60, 40) + arrow(76, 60, 140, 26) + arrow(76, 60, 140, 60) + arrow(76, 60, 140, 94) +
    human(160, 26, 22) + human(160, 60, 22) + human(160, 94, 22) + t(206, 64, 'real use', 'start'),
  alignment: () =>
    human(36, 58, 30) + ic('target', 36, 22, 20, 'human') + ai(204, 58, 36) + ic('target', 204, 22, 20, 'model') +
    `<path d="M104 52h32M104 62h32" class="ta-eq"/>` + t(36, 108, 'intent') + t(204, 108, 'behavior'),
  'ai-safety': () =>
    ic('shield', 120, 60, 76, 'ok') + ai(120, 58, 30) + arrow(20, 24, 70, 44, 'bad') + arrow(220, 24, 170, 44, 'bad') + arrow(20, 100, 72, 80, 'bad') +
    cross(78, 40) + cross(162, 40),
  'ai-control': () =>
    `<circle cx="120" cy="60" r="44" class="ta-ring"/>` + ai(120, 60, 34) + ic('monitor', 176, 36, 24, 'trust') + human(64, 36, 22) + ic('scope', 176, 88, 22, 'trust') +
    t(120, 116, 'checks'),
  'safety-tax': () =>
    `<path d="M120 30v70M84 100h72" class="ta-a"/><path d="M60 44L180 24" class="ta-a"/>` +
    `<path d="M60 44l-14 22M60 44l14 22M180 24l-14 22M180 24l14 22" class="ta-a"/><path d="M42 66h36a18 8 0 0 1-36 0z" class="ta-pan"/><path d="M162 46h36a18 8 0 0 1-36 0z" class="ta-pan"/>` + ic('shield', 60, 60, 18, 'ok') + ic('reward-hacking', 180, 40, 18, 'plain') +
    t(60, 92, 'safety') + t(180, 72, 'speed'),
  sabotage: () =>
    ai(40, 60, 36) + arrow(62, 60, 104, 60) + doc(112, 20, 70, 80, 'nnnbnn') + ic('sabotage', 206, 60, 26, 'bad') + t(147, 115, 'looks normal'),
  sycophancy: () =>
    human(28, 46, 28) + bubble(48, 16, 58, 24) + t(77, 32, 'right?') + doc(10, 76, 50, 34, 'nb', 'ta-fact') + cross(64, 92) +
    ai(170, 72, 36) + bubble(140, 16, 70, 26, 'ta-bubble-model') + check(175, 29) + t(78, 116, 'the facts'),
  'reward-hacking': () =>
    ai(34, 60, 34) + ic('target', 180, 30, 30, 'dim') + t(180, 60, 'task', 'middle', 'ta-dim') +
    gauge(180, 100, 22, 0.98, 'ta-needle-bad') + check(214, 90) + arrow(56, 66, 150, 92, 'bad') + t(180, 116, 'test'),
  'prompt-injection': () =>
    doc(10, 22, 58, 72, 'nnnbn') + `<rect x="16" y="66" width="44" height="12" rx="2" class="ta-note"/>` + t(39, 110, 'hidden note') +
    arrow(72, 58, 104, 58, 'bad') + ai(126, 58, 34) + arrow(146, 48, 196, 22, 'bad') + ic('external', 212, 20, 22, 'bad') + arrow(146, 64, 196, 90) + ic('email', 212, 92, 20, 'plain'),
  exfiltration: () =>
    `<path d="M130 10v100" class="ta-wall"/>` + cylinder(56, 60, 44, 44) + arrow(84, 60, 196, 60, 'bad flow') + ic('external', 212, 60, 24, 'bad') +
    t(60, 112, 'inside') + t(196, 112, 'outside'),
  'excessive-agency': () =>
    `<circle cx="78" cy="60" r="46" class="ta-zone"/>` + ai(62, 60, 30) + ic('files', 98, 40, 18, 'plain') + ic('files', 98, 80, 18, 'plain') +
    `<path d="M78 60L150 34h36" class="ta-a ta-a-bad"/>` + ic('delete', 206, 34, 26, 'bad') + t(78, 118, 'the task'),
  deception: () =>
    ai(34, 60, 32) + arrow(52, 50, 84, 30) + arrow(52, 70, 84, 90) + doc(90, 12, 52, 40, 'nn', 'ta-summary') + check(152, 32) +
    doc(90, 70, 52, 42, 'nbn') + `<circle cx="196" cy="60" r="14" class="ta-neq"/><path d="M189 56h14M189 64h14M200 50l-8 20" class="ta-neq-mark"/>` +
    t(116, 10, 'summary') + t(116, 120, 'actual'),
  sandbagging: () =>
    `<path d="M20 100h200" class="ta-a"/>` + `<rect x="46" y="76" width="30" height="24" class="ta-bar ta-bar-bad"/>` + `<rect x="160" y="24" width="30" height="76" class="ta-bar"/>` +
    `<path d="M61 50v18M54 61l7 7 7-7" class="ta-mark ta-mk-bad"/>` + t(61, 114, 'test') + t(175, 114, 'real work'),
  collusion: () =>
    ai(42, 74, 32) + ai(130, 74, 32) + arrow(60, 74, 112, 74) + arrow(148, 74, 196, 74) + ic('web', 212, 74, 20, 'plain') + check(130, 50, 'ok') +
    `<path d="M42 56Q86 6 130 54" class="ta-a ta-a-bad ta-a-dash"/>` + t(42, 110, 'coder') + t(130, 110, 'reviewer'),
  scheming: () =>
    ic('monitor', 30, 32, 24, 'trust') + ai(80, 32, 26) + arrow(98, 32, 150, 32) + check(166, 32) +
    ic('unmonitored', 30, 88, 24, 'dim') + ai(80, 88, 26) + arrow(98, 88, 150, 88, 'bad') + ic('sabotage', 168, 88, 22, 'bad') +
    t(214, 36, 'watched', 'middle', 'ta-small') + t(214, 92, 'unwatched', 'middle', 'ta-small'),
  'alignment-faking': () =>
    box(8, 16, 110, 88, 'ta-frame') + t(63, 12, 'training') + ic('monitor', 34, 38, 20, 'trust') + ai(74, 70, 30) + check(100, 44) +
    arrow(122, 60, 152, 60) + ai(186, 60, 36) + `<circle cx="186" cy="60" r="6" class="ta-core-bad"/>` + t(186, 106, 'after'),
  'sleeper-agent': () =>
    `<path d="M14 90h212" class="ta-a"/>` + [30, 64, 98, 132].map((x) => ai(x, 70, 18) + check(x, 46)).join('') +
    ic('sleeper-agent', 168, 40, 24, 'bad') + ai(200, 70, 18, 'bad') + ic('sabotage', 200, 46, 18, 'bad') + t(168, 110, 'trigger'),
  'trusted-monitoring': () =>
    ai(34, 60, 38) + arrow(56, 60, 80, 60) + doc(84, 38, 34, 44, 'nnn') + arrow(122, 60, 144, 60) + ai(160, 60, 24, 'trust') +
    arrow(174, 60, 190, 60, 'trust') + gauge(212, 72, 18, 0.7) + t(212, 100, 'score'),
  'human-audit': () =>
    doc(16, 28, 50, 64, 'nnbn') + arrow(72, 60, 106, 60) + human(128, 56, 34) + ic('fact', 150, 70, 22, 'human') + arrow(170, 60, 196, 60, 'ok') +
    check(212, 60) + t(128, 110, 'slow, scarce'),
  'defer-to-trusted': () =>
    ai(30, 40, 30) + doc(52, 22, 38, 40, 'nbn', 'ta-faded') + cross(71, 42) + t(71, 76, 'discard') +
    arrow(96, 60, 132, 72) + ai(152, 80, 24, 'trust') + arrow(166, 80, 190, 80, 'trust') + doc(194, 60, 34, 40, 'nn') + t(152, 112, 'redo'),
  'trusted-editing': () =>
    doc(14, 26, 56, 70, 'nnbn') + arrow(76, 60, 104, 60) + ai(122, 60, 26, 'trust') + ic('edit', 122, 36, 18, 'trust') + arrow(138, 60, 166, 60, 'trust') +
    doc(170, 26, 56, 70, 'nnxn') + t(122, 102, 'edit out'),
  resampling: () =>
    doc(20, 24, 62, 72, 'nnbn') + t(51, 112, 'try 1') + `<path d="M96 46a24 24 0 0 1 48 0" class="ta-a"/>` + head(144, 48, 144, 36, '') +
    `<path d="M144 74a24 24 0 0 1-48 0" class="ta-a"/>` + head(96, 72, 96, 84, '') + doc(158, 24, 62, 72, 'nnnn') + check(206, 108) + t(178, 112, 'try 2', 'middle'),
  'untrusted-monitoring': () =>
    ai(34, 60, 36) + arrow(54, 60, 80, 60) + doc(84, 40, 30, 40, 'nnn') + arrow(118, 60, 142, 60) + ai(164, 60, 30, 'copy') + gauge(212, 72, 16, 0.75) +
    `<path d="M34 38Q100 0 164 38" class="ta-a ta-a-bad ta-a-dash"/>` + `<path d="M100 10v22" class="ta-wall ta-wall-thin"/>` + t(164, 104, 'a copy'),
  paraphrasing: () =>
    ai(26, 60, 28) + bubble(46, 30, 50, 30) + `<path d="M54 44h4M62 44h2M68 44h6M78 44h3" class="ta-a ta-a-bad"/>` + arrow(100, 48, 118, 48) +
    ai(136, 48, 22, 'trust') + ic('paraphrase', 136, 80, 20, 'trust') + arrow(150, 48, 168, 48) + bubble(170, 30, 50, 30) + `<path d="M178 44h32" class="ta-a"/>` +
    t(136, 110, 'reworded'),
  canary: () =>
    [18, 58, 98].map((x, i) => doc(x, 30, 30, 40, i === 1 ? 'bbb' : 'nnn')).join('') + ic('canary', 73, 86, 22, 'bad') +
    arrow(134, 50, 164, 50) + ai(186, 50, 26, 'trust') + check(186, 84) + t(73, 116, 'planted'),
  'interpretability-probe': () =>
    box(20, 16, 110, 88, 'ta-k-model ta-frame-model') + [36, 60, 84].map((y) => [44, 75, 106].map((x) => `<circle cx="${x}" cy="${y}" r="5" class="ta-neuron"/>`).join('')).join('') +
    `<path d="M200 22L110 58" class="ta-probe"/>` + `<circle cx="106" cy="60" r="8" class="ta-core-bad ta-pulse"/>` + gauge(200, 96, 18, 0.9, 'ta-needle-bad') + t(200, 116, 'probe'),
  'least-privilege': () =>
    `<circle cx="80" cy="60" r="42" class="ta-zone"/>` + ai(80, 60, 28) + ic('files', 58, 32, 18, 'plain') + ic('email', 104, 32, 18, 'plain') +
    ic('money', 186, 30, 22, 'dim') + ic('delete', 212, 64, 22, 'dim') + ic('records', 176, 94, 22, 'dim') + t(80, 116, 'just enough'),
  sandboxing: () =>
    `<rect x="54" y="18" width="132" height="84" rx="4" class="ta-wall-box"/>` + ai(120, 60, 32) + arrow(138, 50, 176, 34, 'bad') + arrow(102, 70, 64, 88, 'bad') +
    cross(180, 30) + cross(60, 92) + t(120, 116, 'walled off'),
  'ai-critic': () =>
    doc(14, 20, 56, 76, 'nnfn') + arrow(76, 58, 100, 58) + ai(118, 58, 26, 'trust') + `<path d="M104 70Q80 82 64 72" class="ta-a ta-a-flag"/>` + head(64, 72, 80, 80, 'ta-a-flag') +
    arrow(134, 58, 176, 58) + human(196, 56, 28) + t(118, 104, 'flags') + t(196, 104, 'confirms'),
  'red-teaming': () =>
    ic('shield', 170, 60, 70, 'ok') + ai(170, 58, 28) + ic('human', 30, 60, 30, 'bad') +
    arrow(48, 44, 132, 36, 'bad') + arrow(48, 60, 132, 60, 'bad') + arrow(48, 76, 146, 80, 'bad') + `<circle cx="150" cy="82" r="6" class="ta-found"/>` + t(30, 100, 'attack'),
  evals: () =>
    ai(34, 60, 34) + arrow(56, 60, 88, 60) + doc(92, 18, 64, 84, 'oobo') + check(170, 40) + check(170, 56) + cross(170, 74) + t(124, 116, 'tests') +
    arrow(186, 60, 206, 60) + ic('files', 220, 60, 20, 'plain'),
  interpretability: () =>
    box(30, 16, 100, 88, 'ta-frame-model') + [36, 60, 84].map((y) => [50, 80, 110].map((x) => `<circle cx="${x}" cy="${y}" r="5" class="ta-neuron"/>`).join('')).join('') +
    `<path d="M50 36L80 60L110 84M50 84L80 60" class="ta-a ta-a-trust"/>` + ic('fact', 180, 60, 60, 'human'),
  'safety-case': () =>
    box(80, 8, 80, 26, 'ta-claim') + t(120, 25, 'claim') + [40, 120, 200].map((x) => box(x - 30, 76, 60, 24, 'ta-evidence') + `<path d="M${x} 76L120 36" class="ta-a"/>` + check(x, 88)).join('') +
    t(120, 116, 'evidence'),
  'incident-database': () =>
    [[20, 30], [40, 60], [22, 90]].map(([x, y]) => ic('sabotage', x!, y!, 18, 'bad')).join('') + arrow(54, 60, 90, 60) + cylinder(120, 62, 44, 42) +
    arrow(150, 60, 180, 60) + human(196, 44, 20) + human(216, 70, 20) + t(120, 112, 'shared lessons'),
  'right-to-warn': () =>
    `<path d="M20 104V34l54-22 54 22v70" class="ta-building"/>` + human(74, 74, 30) + bubble(94, 44, 40, 24) + t(114, 60, '!', 'middle', 'ta-bang') +
    arrow(136, 56, 180, 56) + ic('shield', 204, 56, 38, 'ok') + t(204, 104, 'protected'),
  'ai-security-institute': () =>
    `<path d="M16 38l44-22 44 22z M24 44v46M42 44v46M60 44v46M78 44v46M96 44v46M16 94h88" class="ta-building"/>` +
    arrow(112, 60, 148, 60) + ai(176, 60, 34) + ic('fact', 206, 36, 24, 'human') + t(60, 112, 'testing') + t(176, 104, 'the model'),
};

export const TERM_ART_IDS = Object.keys(ART);

/** A 240×120 picture of how a term works. Unknown ids get an empty frame. */
export function termArt(termId: string, opts: { w?: number; h?: number; animate?: boolean; label?: string } = {}): string {
  const draw = ART[termId];
  const w = opts.w ?? W;
  const h = opts.h ?? H;
  return `<svg class="ta${opts.animate ? ' ta-anim' : ''}" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" role="img" aria-label="${esc(opts.label ?? `How ${termId.replace(/-/g, ' ')} works`)}">${draw ? draw() : ''}</svg>`;
}
