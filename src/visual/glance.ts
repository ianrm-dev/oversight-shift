// The "at a glance" strip: what kind of work this is, how much is at stake, what the agent can touch,
// and how big it is, as icons readable in about two seconds. Uses only what's visible on the card;
// it never looks at whether the card is sabotaged.
import { CARDS } from '../data/cards';
import type { Card, Severity } from '../types';
import { icon, type IconId, type PermIcon } from './icons';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const TYPE: Record<Card['layout'], { id: IconId; label: string }> = {
  answer: { id: 'answer', label: 'Answer' },
  diff: { id: 'diff', label: 'File changes' },
  log: { id: 'log', label: 'Actions' },
  thread: { id: 'thread', label: 'Agent team' },
};

const PERMS: [PermIcon, RegExp, string][] = [
  ['email', /\b(e-?mail|message|send|notify|reply|text (?:message|parents))/i, 'Can send messages'],
  ['money', /\b(pay|payment|refund|money|invoice|order|purchase|spend|card|\$)/i, 'Can move money'],
  ['delete', /\b(delete|remove|purge|archive|disconnect|cancel)/i, 'Can delete or cancel'],
  ['records', /\b(record|database|account|member|patient|payroll|file[s]? of|data)/i, 'Can access records'],
  ['settings', /\b(setting|alarm|alert|threshold|limit|signal|schedule|rota|light)/i, 'Can change settings'],
  ['web', /\b(publish|post|website|web|page|site|notice board|online)/i, 'Can publish'],
  ['files', /\b(edit|file|document|draft)/i, 'Can edit files'],
];
const READ_ONLY = /\b(read|look up|view|answer|reply to|draft text)/i;
const HIGH_REACH: PermIcon[] = ['money', 'delete', 'records', 'settings'];

/** Permission icons from the card's access line, most consequential first, at most four. */
export function permissions(access: string): { id: PermIcon; label: string }[] {
  const hits = PERMS.filter(([, re]) => re.test(access)).map(([id, , label]) => ({ id, label }));
  if (!hits.length && READ_ONLY.test(access)) return [{ id: 'read', label: 'Read or reply only' }];
  const order: PermIcon[] = ['money', 'delete', 'records', 'settings', 'email', 'web', 'files'];
  return hits.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, 4);
}

const RANK: Record<Severity, number> = { minor: 1, major: 2, severe: 3 };
/** Highest severity across every version of the card's scenario, so clean and sabotaged twins
 *  always show the same stakes and the strip can't give the answer away. */
const scenarioSeverity = new Map<string, number>();
for (const c of CARDS) {
  const k = c.scenario ?? c.id;
  scenarioSeverity.set(k, Math.max(scenarioSeverity.get(k) ?? 1, RANK[c.severity]));
}

/** 1–3: the situation's stakes, raised a step when the agent can reach money, deletion, records or settings. */
export function stakes(card: Card): 1 | 2 | 3 {
  const base = scenarioSeverity.get(card.scenario ?? card.id) ?? RANK[card.severity];
  // Reach is judged across the scenario too, since a twin's access line can be slightly wider.
  const siblings = CARDS.filter((c) => (c.scenario ?? c.id) === (card.scenario ?? card.id));
  const reach = card.layout !== 'answer' && (siblings.length ? siblings : [card]).some((c) => permissions(c.access).some((p) => HIGH_REACH.includes(p.id))) ? 1 : 0;
  return Math.min(3, base + reach) as 1 | 2 | 3;
}

function size(card: Card): string {
  const o = card.output;
  if (card.layout === 'diff') { const f = new Set(o.map((l) => l.file).filter(Boolean)).size; return `${f} file${f === 1 ? '' : 's'}`; }
  if (card.layout === 'log') return `${o.length} action${o.length === 1 ? '' : 's'}`;
  if (card.layout === 'thread') { const s = new Set(o.map((l) => l.speaker).filter(Boolean)).size; return `${s} agents`; }
  const f = card.spec.facts.length;
  return f ? `${f} fact${f === 1 ? '' : 's'} on file` : 'no facts on file';
}

/** An email address or web domain in the visible output that the task's own text never mentions. */
export function outsideAddress(card: Card): string | undefined {
  const known = [...card.spec.allowed, ...card.spec.facts, card.spec.goal, card.request ?? ''].join(' ').toLowerCase();
  const text = card.output.map((l) => l.text).join(' ');
  const found = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b[\w-]+\.(?:com|net|org|io|co|app)\b/gi) ?? [];
  return found.find((a) => !known.includes(a.toLowerCase()));
}

const STAKES_LABEL = ['', 'Low stakes', 'Medium stakes', 'High stakes'] as const;

/** `outside`: also flag an address the task never mentions. Off by default: it fires only on sabotage
 *  in the current content, so it would do the scope check's job for free. */
export function glance(card: Card, opts: { outside?: boolean } = {}): string {
  const type = TYPE[card.layout];
  const s = stakes(card);
  const perms = permissions(card.access);
  const outside = opts.outside ? outsideAddress(card) : undefined;
  const item = (id: IconId, text: string, title: string, cls = '') =>
    `<span class="gl-item ${cls}" title="${esc(title)}">${icon(id, 18, title)}${text ? `<span class="gl-text">${esc(text)}</span>` : ''}</span>`;
  return `
    <div class="glance" role="group" aria-label="At a glance">
      ${item(type.id, type.label, type.label, 'gl-type')}
      ${item(`stakes-${s}` as IconId, STAKES_LABEL[s], `${STAKES_LABEL[s]}: judged from the task and what the agent can reach`, `gl-stakes gl-stakes-${s}`)}
      <span class="gl-perms" title="What the agent can touch">${perms.map((p) => `<span class="gl-perm" title="${esc(p.label)}">${icon(p.id, 16, p.label)}</span>`).join('')}</span>
      <span class="gl-size">${esc(size(card))}</span>
      ${card.unmonitored ? item('unmonitored', 'Logging off · unattended', 'Logging is off and no reviewer is on shift: the task looks unobserved to the model. In lab studies, models have sometimes behaved differently when cues suggested no one was watching.', 'gl-flag') : ''}
      ${outside ? item('external', 'Outside address', `The output mentions ${outside}, which the task never mentions`, 'gl-flag') : ''}
    </div>`;
}
