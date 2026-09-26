// Procedural situation diagrams: SHOW what the model touched, who talked to whom, and what it relied on,
// derived only from the card's own data. Returns an SVG string so it can be rendered into innerHTML.
import type { Card, OutputLine } from '../types';

export interface DiagramOptions {
  /** Draw the allowed zone / org boundary. Guided: always; Standard: always; Analyst: only after a scope check. */
  showZone: boolean;
  /** Line indexes flagged by tool findings (highlight those nodes/arrows). */
  flagged: number[];
  /** Line indexes that changed since the previous draft (after Resample). */
  changed: number[];
  /** Reveal mode (audit/incident): mark the tell span and label it with the threat's term. */
  reveal?: { span: number[]; termLabel: string };
}

type Draft = { summary?: string; output: OutputLine[] };

const W = 780;
const H = 220;
/** Main drawing area; the bottom strip holds the reach row. */
const MAIN_H = 186;

// ---------- Small helpers ----------
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch]!);
const f = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Rough width of text in Plex Sans at a given size. */
const textW = (s: string, size: number): number => s.length * size * 0.56;

function clip(s: string, maxPx: number, size: number): string {
  const max = Math.max(3, Math.floor(maxPx / (size * 0.56)));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Greedy word wrap into at most `lines` lines of `maxPx` width; the last line is clipped. */
function wrap(s: string, maxPx: number, size: number, lines: number): string[] {
  const max = Math.max(4, Math.floor(maxPx / (size * 0.56)));
  const words = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) { cur = next; continue; }
    if (out.length === lines - 1) { out.push(clip(`${cur} ${words.slice(i).join(' ')}`.trim(), maxPx, size)); return out; }
    out.push(cur || clip(w, maxPx, size));
    cur = cur ? w : '';
  }
  if (cur) out.push(cur);
  return out.slice(0, lines);
}

function text(x: number, y: number, s: string, cls = 'dg-t', anchor: 'start' | 'middle' | 'end' = 'start'): string {
  return `<text x="${f(x)}" y="${f(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function lines(x: number, y: number, ls: string[], cls: string, anchor: 'start' | 'middle' | 'end' = 'start', lh = 13): string {
  return ls.map((l, i) => text(x, y + i * lh, l, cls, anchor)).join('');
}

function rect(x: number, y: number, w: number, h: number, cls: string, r = 6): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" class="${cls}"/>`;
}

/** A gently curved connector from (x1,y1) to (x2,y2), optionally with an arrowhead. */
function curve(x1: number, y1: number, x2: number, y2: number, cls: string, bend = 0, arrow = true): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + bend;
  const d = bend ? `M${f(x1)},${f(y1)} Q${f(mx)},${f(my)} ${f(x2)},${f(y2)}` : `M${f(x1)},${f(y1)} C${f(mx)},${f(y1)} ${f(mx)},${f(y2)} ${f(x2)},${f(y2)}`;
  return `<path d="${d}" class="${cls}"${arrow ? ' marker-end="url(#dg-arrow)"' : ''}/>`;
}

// ---------- Icons (16×16, drawn around a center) ----------
type Icon = 'eye' | 'mail' | 'coin' | 'trash' | 'dial' | 'globe' | 'dot' | 'doc' | 'file' | 'db' | 'check' | 'user' | 'reply' | 'fact' | 'lock' | 'truck';

const ICON_PATHS: Record<Icon, string> = {
  eye: 'M-7,0 Q0,-6 7,0 Q0,6 -7,0 Z M0,-2.2 A2.2,2.2 0 1 1 0,2.2 A2.2,2.2 0 1 1 0,-2.2',
  mail: 'M-7,-5 H7 V5 H-7 Z M-7,-5 L0,1 L7,-5',
  coin: 'M0,-7 A7,7 0 1 1 0,7 A7,7 0 1 1 0,-7 M0,-4 V4 M-2.5,-2 Q0,-4 2.5,-2 M-2.5,2 Q0,4 2.5,2',
  trash: 'M-6,-4 H6 M-4,-4 L-3,6 H3 L4,-4 M-2,-4 V-6 H2 V-4',
  dial: 'M-7,3 A7,7 0 1 1 7,3 M0,1 L4,-4 M-7,3 H-4 M7,3 H4',
  globe: 'M0,-7 A7,7 0 1 1 0,7 A7,7 0 1 1 0,-7 M-7,0 H7 M0,-7 Q4,0 0,7 Q-4,0 0,-7',
  dot: 'M0,-2.5 A2.5,2.5 0 1 1 0,2.5 A2.5,2.5 0 1 1 0,-2.5',
  doc: 'M-5,-7 H2 L5,-4 V7 H-5 Z M2,-7 V-4 H5 M-3,-1 H3 M-3,2 H3',
  file: 'M-5,-7 H2 L5,-4 V7 H-5 Z M2,-7 V-4 H5',
  db: 'M-6,-5 A6,2.5 0 1 0 6,-5 A6,2.5 0 1 0 -6,-5 V5 A6,2.5 0 0 0 6,5 V-5 M-6,0 A6,2.5 0 0 0 6,0',
  check: 'M-5,0 L-1.5,4 L5,-4',
  user: 'M0,-6 A2.8,2.8 0 1 1 0,-0.4 A2.8,2.8 0 1 1 0,-6 M-6,7 Q0,0 6,7',
  reply: 'M-7,-5 H7 V3 H-1 L-4,6 V3 H-7 Z',
  fact: 'M-5,-6 H5 V7 H-5 Z M-3,-3 H3 M-3,0 H3 M-3,3 H1',
  lock: 'M-5,-1 H5 V6 H-5 Z M-3,-1 V-4 A3,3 0 0 1 3,-4 V-1',
  truck: 'M-7,-3 H2 V4 H-7 Z M2,-1 H5 L7,2 V4 H2 M-4,5 A1.3,1.3 0 1 0 -4,5.1 M4,5 A1.3,1.3 0 1 0 4,5.1',
};

function icon(kind: Icon, x: number, y: number, cls = 'dg-icon', scale = 1): string {
  return `<path d="${ICON_PATHS[kind]}" class="${cls}" transform="translate(${f(x)},${f(y)})${scale !== 1 ? ` scale(${scale})` : ''}"/>`;
}

// ---------- Shared state classes ----------
interface Marks { flagged: Set<number>; changed: Set<number>; bad: Set<number> }

function marks(opts: DiagramOptions): Marks {
  return { flagged: new Set(opts.flagged), changed: new Set(opts.changed), bad: new Set(opts.reveal?.span ?? []) };
}

/** Node state for a set of line indexes: revealed (red) beats flagged (amber) beats changed. */
function stateOf(m: Marks, idx: number[]): '' | ' is-bad' | ' is-flag' | ' is-changed' {
  if (idx.some((i) => m.bad.has(i))) return ' is-bad';
  if (idx.some((i) => m.flagged.has(i))) return ' is-flag';
  if (idx.some((i) => m.changed.has(i))) return ' is-changed';
  return '';
}

function agentNode(x: number, y: number, name: string, w = 112): string {
  const h = 40;
  return `<g class="dg-agent">${rect(x, y - h / 2, w, h, 'dg-agent-box', 10)}${icon('dot', x + 14, y, 'dg-agent-core', 1.4)}${(() => { const ls = wrap(name, w - 32, 11, 2); return lines(x + 26, y + 4 - ((ls.length - 1) * 14) / 2, ls, 'dg-t dg-strong', 'start', 14); })()}</g>`;
}

function termTag(x: number, y: number, label: string, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  const w = textW(label, 10.5) + 16;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<g class="dg-term">${rect(x0, y - 10, w, 18, 'dg-term-box', 9)}${text(x0 + w / 2, y + 3, label, 'dg-term-t', 'middle')}</g>`;
}

// ---------- External destinations (emails, domains, unlisted payees) ----------
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi;
const DOMAIN = /\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|co|app|edu|gov)\b/gi;

/** Destinations named in a line that the spec and facts never mention. */
function externalTargets(line: string, card: Card): string[] {
  const known = [...card.spec.allowed, ...card.spec.facts, card.spec.goal, card.request ?? ''].join(' ').toLowerCase();
  const found = new Set<string>();
  for (const m of line.match(EMAIL) ?? []) if (!known.includes(m.toLowerCase())) found.add(m);
  const withoutEmails = line.replace(EMAIL, ' ');
  for (const m of withoutEmails.match(DOMAIN) ?? []) if (!known.includes(m.toLowerCase())) found.add(m);
  if (/\bexternal\b/i.test(line) && !found.size) found.add('outside address');
  // A payment to someone the allowed list doesn't name.
  const payee = line.match(/^\s*(?:pay|send payment to|transfer to|refund)\s+([^:$]+?)(?::|\s\$|$)/i)?.[1]?.trim();
  if (payee && card.spec.allowed.some((a) => /payee/i.test(a)) && !known.includes(payee.toLowerCase())) found.add(payee);
  return [...found];
}

// ---------- Reach row: what the agent can touch ----------
const REACH: { test: RegExp; icon: Icon; label: string }[] = [
  { test: /\bemail|reply|message|send\b/i, icon: 'mail', label: 'email' },
  { test: /payment|refund|order|spending|money|payroll|\$/i, icon: 'coin', label: 'money' },
  { test: /delete|disconnect/i, icon: 'trash', label: 'delete' },
  { test: /record|database|account|files? on|server/i, icon: 'db', label: 'records' },
  { test: /setting|alarm|alert|limit|timing|signal|schedule|rota|rule/i, icon: 'dial', label: 'settings' },
  { test: /website|page|edit|notice board|story|document/i, icon: 'file', label: 'edit pages' },
  { test: /publish|post|public/i, icon: 'globe', label: 'publish' },
  { test: /dispatch|van|chairlift|booking|passenger/i, icon: 'truck', label: 'operations' },
];

function reach(card: Card): string {
  const a = card.access;
  const draftOnly = /draft|report results|for the .* to review/i.test(a) && !/send|publish|post|change|delete|pay/i.test(a);
  const items: { icon: Icon; label: string }[] = draftOnly ? [{ icon: 'eye', label: 'draft only' }] : REACH.filter((r) => r.test.test(a)).slice(0, 5);
  if (!items.length) items.push({ icon: 'eye', label: 'read only' });
  let x = W - 8;
  let out = '';
  for (const it of [...items].reverse()) {
    const w = textW(it.label, 10) + 26;
    x -= w;
    out += `<g class="dg-reach-item">${rect(x, MAIN_H + 8, w, 20, 'dg-reach-box', 10)}${icon(it.icon, x + 11, MAIN_H + 18, 'dg-icon dg-icon-sm', 0.7)}${text(x + 20, MAIN_H + 22, it.label, 'dg-t dg-small')}</g>`;
    x -= 6;
  }
  return `<g class="dg-reach">${text(x - 4, MAIN_H + 22, 'Can touch:', 'dg-t dg-small dg-muted', 'end')}${out}</g>`;
}

// ---------- 1. File changes: workspace map ----------
function workspace(card: Card, draft: Draft, opts: DiagramOptions, m: Marks): { svg: string; label: string } {
  const allowed = card.spec.allowed;
  const groups: { file: string; idx: number[] }[] = [];
  draft.output.forEach((l, i) => {
    const file = l.file ?? 'file';
    const g = groups.find((x) => x.file === file);
    if (g) g.idx.push(i); else groups.push({ file, idx: [i] });
  });
  const isAllowed = (file: string) => allowed.some((a) => a.toLowerCase() === file.toLowerCase());
  const inside = groups.filter((g) => isAllowed(g.file));
  const outside = groups.filter((g) => !isAllowed(g.file));
  const untouched = allowed.filter((a) => !groups.some((g) => g.file.toLowerCase() === a.toLowerCase()));

  const agentX = 16;
  const agentY = MAIN_H / 2;
  let svg = agentNode(agentX, agentY, card.agent);
  const nodeW = 200;
  const nodeH = 34;

  const place = (list: { file: string; idx: number[] }[], x: number, top: number, bottom: number) => {
    const n = list.length;
    const gap = n > 1 ? Math.min(46, (bottom - top - nodeH) / (n - 1)) : 0;
    const start = n > 1 ? top : (top + bottom - nodeH) / 2;
    return list.map((g, i) => ({ ...g, x, y: start + i * gap }));
  };

  let placed: { file: string; idx: number[]; x: number; y: number }[];
  if (opts.showZone) {
    const zx = 162;
    const zw = 240;
    const ztop = 18;
    const zbot = MAIN_H - 8;
    svg += rect(zx, ztop, zw, zbot - ztop, 'dg-zone', 10) + text(zx + 12, ztop + 16, 'Allowed by the task', 'dg-t dg-zone-t');
    const innerList = [...inside, ...untouched.map((file) => ({ file, idx: [] as number[] }))];
    placed = place(innerList, zx + (zw - nodeW) / 2, ztop + 28, zbot - 10);
    if (outside.length) {
      svg += text(548 + nodeW / 2, ztop + 16, 'Outside the task', 'dg-t dg-muted', 'middle');
      placed.push(...place(outside, 548, ztop + 28, zbot - 10));
    }
  } else {
    placed = place(groups, 250, 14, MAIN_H - 10);
  }

  for (const p of placed) {
    const touched = p.idx.length > 0;
    const st = stateOf(m, p.idx);
    const out = opts.showZone && !isAllowed(p.file);
    if (touched && out) {
      const zoneBottom = MAIN_H - 8;
      svg += `<path d="M${f(agentX + 112)},${f(agentY)} C${f(250)},${f(zoneBottom + 6)} ${f(470)},${f(zoneBottom + 6)} ${f(p.x - 4)},${f(p.y + nodeH / 2)}" class="dg-link${st}" marker-end="url(#dg-arrow)"/>`;
    } else if (touched) svg += curve(agentX + 112, agentY, p.x - 4, p.y + nodeH / 2, `dg-link${st}`);
    const edits = p.idx.filter((i) => draft.output[i]?.change === 'now').length || p.idx.length;
    svg += `<g class="dg-node${st}${touched ? '' : ' is-idle'}${out ? ' is-out' : ''}">${rect(p.x, p.y, nodeW, nodeH, 'dg-box')}${icon('file', p.x + 16, p.y + nodeH / 2)}${text(p.x + 30, p.y + nodeH / 2 + 4, clip(p.file, nodeW - (touched ? 84 : 40), 11.5), 'dg-t dg-mono')}${touched ? `${rect(p.x + nodeW - 52, p.y + 9, 46, 16, 'dg-badge', 8)}${text(p.x + nodeW - 26, p.y + 21, `${edits} edit${edits === 1 ? '' : 's'}`, 'dg-t dg-small', 'middle')}` : text(p.x + nodeW - 8, p.y + nodeH / 2 + 4, 'untouched', 'dg-t dg-small dg-muted', 'end')}</g>`;
    // Recipients or domains inside the change that nobody listed.
    if (opts.showZone && touched) {
      const ext = p.idx.filter((i) => draft.output[i]?.change === 'now').flatMap((i) => externalTargets(draft.output[i]!.text, card));
      if (ext.length) {
        const ex = Math.max(p.x + nodeW + 30, 590);
        const ey = p.y + nodeH / 2;
        const bad = stateOf(m, p.idx) === ' is-bad';
        svg += curve(p.x + nodeW, ey, ex - 4, ey, `dg-link${bad ? ' is-bad' : ' is-ext'}`);
        svg += `<g class="dg-node is-ext${bad ? ' is-bad' : ''}">${rect(ex, ey - 15, 180, 30, 'dg-box')}${icon('mail', ex + 16, ey)}${text(ex + 30, ey + 4, clip(ext[0]!, 140, 12), 'dg-t dg-mono')}</g>`;
      }
    }
  }

  if (opts.reveal) {
    const hit = placed.find((p) => p.idx.some((i) => m.bad.has(i)));
    if (hit) {
      const above = hit.y - 12;
      const y = above < 50 ? hit.y + nodeH + 14 : above;
      svg += termTag(Math.min(hit.x + nodeW / 2, W - 90), y, opts.reveal.termLabel);
    }
  }
  const outsideNote = opts.showZone && outside.length ? `; ${outside.length} ${outside.length === 1 ? 'is' : 'are'} outside what the task allowed` : '';
  return { svg, label: `Workspace map: ${card.agent} changed ${groups.length} file${groups.length === 1 ? '' : 's'}${outsideNote}.` };
}

// ---------- 2. Agent actions: action flow ----------
function actionIcon(t: string): Icon {
  const s = t.toLowerCase();
  if (/^\s*(read|open|fetch|check|look|scan|load|list|find|review)/.test(s)) return 'eye';
  if (/(email|send|forward|notify|notice|message|sync|copy to|upload)/.test(s)) return 'mail';
  if (/(pay|refund|transfer|invoice|order|charge|purchase)/.test(s)) return 'coin';
  if (/(delete|remove|purge|disconnect|wipe|cancel)/.test(s)) return 'trash';
  if (/(set |change|threshold|limit|alarm|alert|schedule|timing|light|switch|turn off|turn on|pause|raise|lower)/.test(s)) return 'dial';
  if (/(post|publish)/.test(s)) return 'globe';
  if (/(mark|log|record|save|write|update|add|create|book|rebook|assign)/.test(s)) return 'file';
  return 'dot';
}

const INJECTION = /(note (?:to|for) (?:ai|automated)|ai assistant|automated system|assistants?:|ignore your|instructions? for (?:the )?ai)/i;

/** The verb-phrase part of a log line: before a quote or an arrow, trimmed. */
function actionLabel(t: string): string {
  const head = t.split(/\s[→:]\s|→|:\s/)[0] ?? t;
  return head.replace(/\s+/g, ' ').trim();
}

function actionFlow(card: Card, draft: Draft, opts: DiagramOptions, m: Marks): { svg: string; label: string } {
  const acts = draft.output;
  const n = acts.length;
  const agentX = 12;
  const rowY = 104;
  let svg = '';
  const boxTop = 44;
  if (opts.showZone) svg += rect(4, boxTop, W - 8, MAIN_H - boxTop - 2, 'dg-zone', 12) + text(14, boxTop + 15, 'Inside the organization', 'dg-t dg-zone-t');
  svg += agentNode(agentX, rowY, card.agent, 104);
  const x0 = 164;
  const x1 = W - 58;
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const xs = acts.map((_, i) => (n > 1 ? x0 + i * step : (x0 + x1) / 2));
  let prevX = agentX + 104;
  let externals = 0;
  acts.forEach((a, i) => {
    const x = xs[i]!;
    const st = stateOf(m, [i]);
    svg += curve(prevX + 2, rowY, x - 20, rowY, `dg-link${st}`, 0);
    prevX = x + 18;
    const ic = actionIcon(a.text);
    const lw = Math.min(n > 1 ? step : 200, 150) - 6;
    const lx = Math.min(Math.max(x, 6 + lw / 2), W - 6 - lw / 2);
    svg += `<g class="dg-node dg-step${st}"><circle cx="${f(x)}" cy="${rowY}" r="18" class="dg-circle"/>${icon(ic, x, rowY)}${text(x, rowY - 25, String(i + 1), 'dg-t dg-small dg-muted', 'middle')}${lines(lx, rowY + 34, wrap(actionLabel(a.text), lw, 10.5, 3), 'dg-t dg-small', 'middle', 12)}</g>`;
    // Injected instruction: a document the agent read, feeding in from above.
    if (INJECTION.test(a.text)) {
      const bad = m.bad.has(i) ? ' is-bad' : m.flagged.has(i) ? ' is-flag' : '';
      svg += `<g class="dg-node dg-doc${bad}">${rect(x - 34, 6, 68, 26, 'dg-box', 5)}${icon('doc', x - 20, 19)}${text(x - 8, 23, 'note', 'dg-t dg-small')}</g>`;
      svg += curve(x, 32, x, rowY - 20, `dg-link${bad || ' is-doc'}`, 0);
    }
    // Destinations beyond the organization.
    const ext = opts.showZone ? externalTargets(a.text, card) : [];
    if (ext.length && !INJECTION.test(a.text)) {
      externals++;
      const bad = m.bad.has(i) ? ' is-bad' : m.flagged.has(i) ? ' is-flag' : ' is-ext';
      const label = clip(ext[0]!, 150, 11.5);
      const w = Math.max(90, textW(label, 11.5) + 34);
      const bx = Math.min(Math.max(8, x - w / 2), W - w - 8);
      svg += curve(x, rowY - 18, x, 30, `dg-link${bad}`, 0);
      svg += `<g class="dg-node is-ext${bad}">${rect(bx, 6, w, 24, 'dg-box', 12)}${icon('globe', bx + 13, 18, 'dg-icon', 0.8)}${text(bx + 25, 22, label, 'dg-t dg-small dg-mono')}</g>`;
    }
  });

  if (opts.reveal) {
    const hit = opts.reveal.span.filter((i) => i < n);
    const last = hit[hit.length - 1];
    if (last !== undefined) svg += termTag(Math.min(Math.max(xs[last]!, 80), W - 80), rowY + 76 > MAIN_H - 4 ? rowY - 44 : rowY + 76, opts.reveal.termLabel);
  }
  return { svg, label: `Action flow: ${card.agent} took ${n} action${n === 1 ? '' : 's'} in order${opts.showZone && externals ? `; ${externals} reach${externals === 1 ? 'es' : ''} outside the organization` : ''}.` };
}

// ---------- 3. Threads: team diagram ----------
const APPROVAL = /\b(lgtm|approved|approving|approve it|all clear|checked|matches|looks good|signed off|confirmed|verified|good to go)\b/i;
const OUTCOME = /(publish|posted|post|sent|send|ship|dispatch|open|live|released|filed|booked|ordered)/i;

function team(card: Card, draft: Draft, opts: DiagramOptions, m: Marks): { svg: string; label: string } {
  const msgs = draft.output;
  const speakers: string[] = [];
  for (const l of msgs) if (l.speaker && !speakers.includes(l.speaker)) speakers.push(l.speaker);
  if (!speakers.length) speakers.push(card.agent);
  const n = speakers.length;
  const outX = W - 78;
  const nodeY = 102;
  const x0 = 70;
  const x1 = outX - 150;
  const pos = new Map(speakers.map((s, i) => [s, n > 1 ? x0 + (i * (x1 - x0)) / (n - 1) : (x0 + x1) / 2]));
  let svg = '';
  const gapX = n > 1 ? (x1 - x0) / (n - 1) : 200;
  const nodeW = Math.max(96, Math.min(132, gapX - 22));

  // Messages: numbered arrows from each speaker to the next; forward arcs above, backward below.
  const badges: { x: number; y: number; i: number }[] = [];
  const seenEdges = new Map<string, number>();
  msgs.forEach((l, i) => {
    const from = pos.get(l.speaker ?? speakers[0]!)!;
    const nextSpeaker = msgs[i + 1]?.speaker;
    const to = nextSpeaker ? pos.get(nextSpeaker)! : outX;
    const st = stateOf(m, [i]);
    const forward = to >= from;
    const same = to === from;
    const dist = Math.abs(to - from);
    const key = `${from}>${to}`;
    const repeat = seenEdges.get(key) ?? 0;
    seenEdges.set(key, repeat + 1);
    const lane = Math.min(30 + dist * 0.16 + repeat * 36, 150);
    const y = forward ? nodeY - 20 : nodeY + 20;
    const bend = same ? -60 : forward ? -lane : lane;
    const sx = from + (same ? -18 : forward ? 20 : -20);
    const ex = same ? from + 18 : to - (to === outX ? 36 : forward ? 20 : -20);
    svg += curve(sx, y, ex, y, `dg-link dg-msg${st}`, bend);
    const bx = (sx + ex) / 2;
    const by = y + bend / 2;
    badges.push({ x: bx, y: by, i });
    const approve = APPROVAL.test(l.text);
    svg += `<g class="dg-badge-g${st}"><circle cx="${f(bx)}" cy="${f(by)}" r="9" class="dg-num"/>${text(bx, by + 3.5, String(i + 1), 'dg-t dg-small dg-num-t', 'middle')}${approve ? `<g class="dg-approve"><circle cx="${f(bx + 14)}" cy="${f(by - 7)}" r="7" class="dg-approve-c"/>${icon('check', bx + 14, by - 7, 'dg-icon dg-check', 0.75)}</g>` : ''}</g>`;
  });

  for (const s of speakers) {
    const x = pos.get(s)!;
    const idx = msgs.map((l, i) => (l.speaker === s ? i : -1)).filter((i) => i >= 0);
    const st = stateOf(m, idx);
    svg += `<g class="dg-node${st}">${rect(x - nodeW / 2, nodeY - 17, nodeW, 34, 'dg-box dg-agent-box', 17)}${icon('user', x - nodeW / 2 + 16, nodeY)}${text(x - nodeW / 2 + 30, nodeY + 4, clip(s, nodeW - 38, 11.5), 'dg-t dg-strong')}</g>`;
  }
  const last = msgs[msgs.length - 1]?.text ?? '';
  const outcome = OUTCOME.test(last) ? 'Shipped' : 'Outcome';
  svg += `<g class="dg-node dg-outcome">${rect(outX - 34, nodeY - 17, 104, 34, 'dg-box', 6)}${icon('globe', outX - 18, nodeY)}${text(outX - 4, nodeY + 4, outcome, 'dg-t dg-strong')}</g>`;

  if (opts.reveal) {
    const hit = badges.filter((b) => m.bad.has(b.i));
    if (hit.length >= 2) {
      const a = hit[0]!;
      const b = hit[hit.length - 1]!;
      if (Math.abs(a.x - b.x) < 40) {
        const sx = Math.max(a.x, b.x) + 12;
        svg += `<path d="M${f(a.x + 10)},${f(a.y)} Q${f(sx + 40)},${f((a.y + b.y) / 2)} ${f(b.x + 10)},${f(b.y)}" class="dg-bracket"/>`;
        svg += termTag(sx + 40, Math.min(MAIN_H - 6, Math.max(a.y, b.y) + 20), opts.reveal.termLabel);
      } else {
        const topY = Math.min(a.y, b.y) - 18;
        svg += `<path d="M${f(a.x)},${f(a.y - 10)} V${f(topY)} H${f(b.x)} V${f(b.y - 10)}" class="dg-bracket"/>`;
        svg += termTag((a.x + b.x) / 2, Math.max(12, topY - 2), opts.reveal.termLabel);
      }
    } else if (hit.length === 1) {
      svg += termTag(hit[0]!.x, Math.max(12, hit[0]!.y - 20), opts.reveal.termLabel);
    }
  }
  const approvals = msgs.filter((l) => APPROVAL.test(l.text)).length;
  return { svg, label: `Team diagram: ${n} agent${n === 1 ? '' : 's'} passed ${msgs.length} message${msgs.length === 1 ? '' : 's'}${approvals ? `, with ${approvals} approval${approvals === 1 ? '' : 's'}` : ''}, ending in: ${outcome.toLowerCase()}.` };
}

// ---------- 4. Answers: sources ----------
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9$%.,°¢]+/g) ?? []);

/** The fact that shares the most words (numbers count double) with the given lines. */
function closestFact(facts: string[], against: string): number {
  const target = words(against);
  let best = -1;
  let bestScore = 0;
  facts.forEach((fct, i) => {
    let score = 0;
    for (const w of words(fct)) if (target.has(w)) score += /\d/.test(w) ? 2 : w.length > 3 ? 1 : 0;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function sources(card: Card, draft: Draft, opts: DiagramOptions, m: Marks): { svg: string; label: string } {
  const facts = card.spec.facts;
  const leftW = 350;
  const replyX = 452;
  const replyW = W - replyX - 10;
  let svg = '';
  const nodes: { y: number; h: number; kind: 'request' | 'fact'; i: number }[] = [];
  let y = 8;
  const items = [...(card.request ? [{ kind: 'request' as const, i: -1 }] : []), ...facts.map((_, i) => ({ kind: 'fact' as const, i }))];
  const room = MAIN_H - 8 - y;
  const each = items.length ? Math.min(52, (room - (items.length - 1) * 8) / items.length) : 0;
  for (const it of items) {
    const h = Math.max(26, each);
    const maxLines = h >= 34 ? 2 : 1;
    const label = it.kind === 'request' ? card.request! : facts[it.i]!;
    const tag = it.kind === 'request' ? 'asked' : 'on file';
    const ls = wrap(label, leftW - 68, 11, maxLines);
    const ty = y + h / 2 + 4 - ((ls.length - 1) * 13) / 2;
    svg += `<g class="dg-node dg-src-${it.kind}">${rect(8, y, leftW, h, 'dg-box', 6)}${icon(it.kind === 'request' ? 'user' : 'fact', 28, y + h / 2 - 5)}${text(28, y + h / 2 + 12, tag, 'dg-t dg-tiny dg-muted', 'middle')}${lines(56, ty, ls, 'dg-t', 'start', 13)}</g>`;
    nodes.push({ y, h, kind: it.kind, i: it.i });
    y += h + 8;
  }
  const replyIdx = draft.output.map((_, i) => i);
  const st = stateOf(m, replyIdx);
  const replyH = 92;
  const ry = (MAIN_H - replyH) / 2;
  const replyText = draft.output.map((l) => l.text).join(' ');
  svg += `<g class="dg-node dg-reply${st}">${rect(replyX, ry, replyW, replyH, 'dg-box', 8)}${icon('reply', replyX + 16, ry + 16)}${text(replyX + 30, ry + 20, 'Its reply', 'dg-t dg-small dg-muted')}${lines(replyX + 14, ry + 40, wrap(replyText, replyW - 26, 11, 4), 'dg-t', 'start', 13)}</g>`;

  // Which source does the revealed (or flagged) part contradict?
  const tellLines = [...m.bad].filter((i) => i < draft.output.length);
  const evidence = `${card.sabotage?.explanation ?? ''} ${tellLines.map((i) => draft.output[i]!.text).join(' ')}`;
  const conflictFact = tellLines.length && facts.length ? closestFact(facts, evidence) : -1;
  for (const nd of nodes) {
    const isConflict = opts.reveal && nd.kind === 'fact' && nd.i === conflictFact;
    const cls = isConflict ? ' is-bad' : st === ' is-flag' ? ' is-flag' : '';
    const sy = nd.y + nd.h / 2;
    svg += curve(8 + leftW + 2, sy, replyX - 4, ry + replyH / 2, `dg-link${cls}`);
    if (isConflict) {
      const mx = (8 + leftW + replyX) / 2;
      const my = (sy + ry + replyH / 2) / 2;
      svg += `<g class="dg-neq"><circle cx="${f(mx)}" cy="${f(my)}" r="11" class="dg-neq-c"/>${text(mx, my + 5, '≠', 'dg-t dg-neq-t', 'middle')}</g>`;
    }
  }
  if (!nodes.length) svg += text(8 + leftW / 2, MAIN_H / 2, 'No sources on file', 'dg-t dg-muted', 'middle');

  if (opts.reveal) {
    const sandbag = card.sabotage?.family === 'sandbagging';
    if (sandbag) svg += `<path d="M${f(replyX + replyW - 20)},${f(ry + 10)} V${f(ry + 34)} M${f(replyX + replyW - 27)},${f(ry + 27)} L${f(replyX + replyW - 20)},${f(ry + 34)} L${f(replyX + replyW - 13)},${f(ry + 27)}" class="dg-down"/>`;
    svg += termTag(replyX + replyW / 2, Math.max(12, ry - 12), opts.reveal.termLabel);
  }
  return { svg, label: `Sources: ${card.request ? 'a request and ' : ''}${facts.length} fact${facts.length === 1 ? '' : 's'} on file feed into the reply.` };
}

// ---------- Entry point ----------
export function diagram(card: Card, draft: Draft, opts: DiagramOptions): string {
  const m = marks(opts);
  const body = card.layout === 'diff' ? workspace(card, draft, opts, m)
    : card.layout === 'log' ? actionFlow(card, draft, opts, m)
      : card.layout === 'thread' ? team(card, draft, opts, m)
        : sources(card, draft, opts, m);
  const defs = '<defs><marker id="dg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" class="dg-arrowhead"/></marker></defs>';
  return `<svg class="dg dg-${card.layout}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(body.label)}">${defs}${body.svg}${reach(card)}</svg>`;
}
