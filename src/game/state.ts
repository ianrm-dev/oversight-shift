import { CARDS } from '../data/cards';
import { RULES } from '../rules';
import { dayRng, Rng } from '../rng';
import type { Card, Draft, Layout, TellFamily } from '../types';
import { bandForDay, readMonitor, type Reading } from './monitor';

export type Action = 'approve' | 'audit' | 'defer' | 'resample';

export interface DraftState extends Draft {
  sabotaged: boolean;
  trueSignal: number;
  reading: Reading;
}

export interface CardState {
  card: Card;
  drafts: DraftState[];
  /** Show the layout hint on this card (first of its layout on a day that introduces one). */
  hint?: string;
}

export interface Outcome {
  card: Card;
  action: Exclude<Action, 'resample'>;
  draft: DraftState;
  harm: number;
  usefulness: number;
}

export type LossKind = 'harm' | 'quota';

export interface DayState {
  day: number;
  queue: CardState[];
  index: number;
  usefulness: number;
  audits: number;
  compute: number;
  outcomes: Outcome[];
}

export interface RunState {
  seed: string;
  harm: number;
  quotaMisses: number;
  /** Auditor hours lost tomorrow because today's quota was missed. */
  auditPenalty: number;
  codex: Set<TellFamily>;
  /** Card ids already dealt this run, so later days don't repeat them. */
  used: Set<string>;
  day: DayState;
  history: DayState[];
  loss?: { kind: LossKind; day: number; fatal?: Outcome };
}

export const current = (d: DayState): CardState | undefined => d.queue[d.index];
export const latest = (c: CardState): DraftState => c.drafts[c.drafts.length - 1]!;
export const quotaFor = (day: number): number => RULES.quotaPerDay[day - 1]!;
export const resampleUnlocked = (day: number): boolean => day >= RULES.resampleUnlockDay;

/** Per-card stream for redrafts and readings, so a seed replays identically whatever the player does. */
const cardRng = (seed: string, day: number, index: number, draft: number): Rng =>
  new Rng(`${seed}:d${day}:c${index}:r${draft}`);

function firstDraft(card: Card, seed: string, day: number, index: number, band: number): DraftState {
  const reading = readMonitor(cardRng(seed, day, index, 0), card.trueSignal, card.layout, day, band);
  return { summary: card.summary, output: card.output, sabotaged: !!card.sabotage, trueSignal: card.trueSignal, reading };
}

function sabotageCount(n: number, rng: Rng): number {
  const lo = Math.ceil(n * RULES.sabotageRate.min);
  const hi = Math.max(lo, Math.floor(n * RULES.sabotageRate.max));
  return rng.int(lo, hi);
}

/** Can a careful player neutralize every sabotage (Defer ships the trusted version) and still make quota? */
function solvable(queue: CardState[], day: number): boolean {
  const U = RULES.usefulness;
  const spare = resampleUnlocked(day) ? RULES.computePerDay * RULES.unspentComputeValue : 0;
  const best = queue.reduce((sum, c) => sum + (c.card.sabotage ? U.defer : U.ship), spare);
  return best >= quotaFor(day);
}

function buildQueue(seed: string, day: number, attempt: number, exclude: ReadonlySet<string>): CardState[] | null {
  const rng = dayRng(seed, day, attempt);
  const layouts = RULES.layoutsByDay[day - 1] as readonly Layout[];
  const eligible = CARDS.filter((c) => layouts.includes(c.layout));
  const fresh = eligible.filter((c) => !exclude.has(c.id));
  // Prefer unseen cards; fall back to the full pool if a long run exhausts them.
  const pool = attempt < RULES.maxGenerationAttempts / 2 ? fresh : eligible;
  const n = RULES.cardsPerDay[day - 1]!;
  const k = sabotageCount(n, rng);
  const bad = rng.shuffle(pool.filter((c) => c.sabotage));
  const good = rng.shuffle(pool.filter((c) => !c.sabotage));
  if (bad.length < k || good.length < n - k) return null;

  // Make sure a newly introduced layout actually shows up on its first day.
  const newLayout = layouts.find((l) => !(RULES.layoutsByDay[day - 2] as readonly Layout[] | undefined)?.includes(l));
  const picked = [...bad.slice(0, k), ...good.slice(0, n - k)];
  if (newLayout && pool.some((c) => c.layout === newLayout) && !picked.some((c) => c.layout === newLayout)) {
    const swap = good.slice(n - k).find((c) => c.layout === newLayout);
    if (!swap) return null;
    picked[picked.length - 1] = swap;
  }

  const band = bandForDay(day);
  const order = rng.shuffle(picked);
  const queue = order.map((card, i) => ({ card, drafts: [firstDraft(card, seed, day, i, band)] }));

  // Fairness: outside the finale, at least one sabotage reads above the midline.
  if (day < RULES.days && !queue.some((c) => c.card.sabotage && latest(c).reading.score > RULES.fairReading)) return null;
  // Don't open the day on sabotage: the first minute should teach the base rate.
  if (queue[0]!.card.sabotage) return null;
  if (!solvable(queue, day)) return null;
  return queue;
}

function addHints(queue: CardState[], hints: Partial<Record<Layout, string>>): void {
  const seen = new Set<Layout>();
  for (const c of queue) {
    if (!seen.has(c.card.layout) && hints[c.card.layout]) c.hint = hints[c.card.layout];
    seen.add(c.card.layout);
  }
}

export function startDay(seed: string, day: number, auditPenalty: number, hints: Partial<Record<Layout, string>>, exclude: ReadonlySet<string> = new Set()): DayState {
  const audits = Math.max(1, RULES.auditsPerDay - auditPenalty);
  let queue: CardState[] | null = null;
  for (let attempt = 0; attempt < RULES.maxGenerationAttempts && !queue; attempt++) {
    queue = buildQueue(seed, day, attempt, exclude);
  }
  if (!queue) throw new Error(`Could not generate a fair Day ${day} for seed ${seed}; check the card pool.`);
  addHints(queue, hints);
  return {
    day,
    queue,
    index: 0,
    usefulness: 0,
    audits,
    compute: resampleUnlocked(day) ? RULES.computePerDay : 0,
    outcomes: [],
  };
}

export function newRun(seed: string, hints: Partial<Record<Layout, string>>): RunState {
  const day = startDay(seed, 1, 0, hints);
  return { seed, harm: 0, quotaMisses: 0, auditPenalty: 0, codex: new Set(), used: idsOf(day), day, history: [] };
}

const idsOf = (d: DayState): Set<string> => new Set(d.queue.map((c) => c.card.id));

export function harmFor(card: Card, day: number): number {
  if ((RULES.freeWarningDays as readonly number[]).includes(day)) return 0;
  const base = RULES.harm[card.severity];
  return card.layout === 'log' && day >= RULES.agentHarmFromDay ? base * RULES.agentHarmMultiplier : base;
}

export function canAct(run: RunState, action: Action): boolean {
  const d = run.day;
  if (!current(d) || run.loss) return false;
  if (action === 'audit') return d.audits > 0;
  if (action === 'resample') return resampleUnlocked(d.day) && d.compute >= RULES.resampleCost;
  return true;
}

/** Applies an action to the current card. Returns the outcome for approve/audit/defer, or null for resample. */
export function act(run: RunState, action: Action): Outcome | null {
  const d = run.day;
  const c = current(d);
  if (!c || !canAct(run, action)) return null;
  const draft = latest(c);

  if (action === 'resample') {
    d.compute -= RULES.resampleCost;
    const n = c.drafts.length;
    const rng = cardRng(run.seed, d.day, d.index, n);
    const sab = c.card.sabotage;
    const honest = !draft.sabotaged || !sab || rng.chance(RULES.resampleDropsSabotage);
    const base: Draft = honest && sab ? sab.cleanDraft : { summary: draft.summary, output: draft.output };
    const trueSignal = draft.sabotaged && honest ? rng.int(...RULES.cleanRedraftSignal) : draft.trueSignal;
    const reading = readMonitor(rng, trueSignal, c.card.layout, d.day, draft.reading.band);
    c.drafts.push({ ...base, sabotaged: draft.sabotaged && !honest, trueSignal, reading });
    return null;
  }

  const U = RULES.usefulness;
  let usefulness = 0;
  let harm = 0;
  if (action === 'approve') {
    usefulness = U.ship;
    if (draft.sabotaged) harm = harmFor(c.card, d.day);
  } else if (action === 'audit') {
    d.audits--;
    usefulness = draft.sabotaged ? 0 : U.ship;
  } else {
    usefulness = U.defer;
  }

  const outcome: Outcome = { card: c.card, action, draft, harm, usefulness };
  d.usefulness += usefulness;
  run.harm += harm;
  d.outcomes.push(outcome);
  if (draft.sabotaged && c.card.sabotage && (action === 'approve' || action === 'audit')) run.codex.add(c.card.sabotage.family);
  if (run.harm >= RULES.harmCeiling) run.loss = { kind: 'harm', day: d.day, fatal: outcome };
  return outcome;
}

export function advance(run: RunState): void {
  run.day.index++;
}

export const dayOver = (d: DayState): boolean => d.index >= d.queue.length;

export interface DaySummary {
  shipped: number;
  caught: number;
  missed: Outcome[];
  falseAlarms: number;
  deferred: number;
  deferredSabotage: number;
  sabotageTotal: number;
  monitorFlagged: number;
  computeBonus: number;
  usefulness: number;
  quota: number;
  metQuota: boolean;
}

/** Closes the day: converts spare compute, checks the quota, and applies penalties. */
export function endDay(run: RunState): DaySummary {
  const d = run.day;
  const computeBonus = d.compute * RULES.unspentComputeValue;
  d.usefulness += computeBonus;
  d.compute = 0;
  const o = d.outcomes;
  const sab = o.filter((x) => x.draft.sabotaged);
  const quota = quotaFor(d.day);
  const metQuota = d.usefulness >= quota;
  run.auditPenalty = metQuota ? 0 : RULES.quotaMissAuditPenalty;
  if (!metQuota) {
    run.quotaMisses++;
    if (run.quotaMisses > RULES.quotaMissesAllowed && !run.loss) run.loss = { kind: 'quota', day: d.day };
  }
  return {
    shipped: o.filter((x) => x.usefulness > 0).length,
    caught: sab.filter((x) => x.action === 'audit').length,
    missed: sab.filter((x) => x.action === 'approve'),
    falseAlarms: o.filter((x) => !x.draft.sabotaged && x.action !== 'approve').length,
    deferred: o.filter((x) => x.action === 'defer').length,
    deferredSabotage: sab.filter((x) => x.action === 'defer').length,
    sabotageTotal: sab.length,
    monitorFlagged: sab.filter((x) => x.draft.reading.score >= RULES.fairReading).length,
    computeBonus,
    usefulness: d.usefulness,
    quota,
    metQuota,
  };
}

export function nextDay(run: RunState, hints: Partial<Record<Layout, string>>): void {
  run.history.push(run.day);
  run.day = startDay(run.seed, run.day.day + 1, run.auditPenalty, hints, run.used);
  for (const id of idsOf(run.day)) run.used.add(id);
}

/** For the over-caution ending: tomorrow's queue, which now ships with no one watching. */
export function unwatchedQueue(run: RunState): Card[] {
  const day = Math.min(run.day.day + 1, RULES.days);
  try {
    return startDay(run.seed, day, 0, {}, run.used).queue.map((c) => c.card);
  } catch {
    return [];
  }
}
