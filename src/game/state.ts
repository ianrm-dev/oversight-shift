import { CARDS } from '../data/cards';
import { UPGRADES } from '../data/upgrades';
import { RULES } from '../rules';
import { dayRng, Rng } from '../rng';
import type { Card, Draft, Layout, TellFamily, Upgrade } from '../types';
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
  /** Approved sabotage that cost nothing because it was the run's free warning. */
  warning?: boolean;
}

export type LossKind = 'harm' | 'quota';

export interface DayState {
  day: number;
  queue: CardState[];
  index: number;
  usefulness: number;
  audits: number;
  /** Auditor hours the day started with, for the pip display. */
  auditsStart: number;
  compute: number;
  computeStart: number;
  band: number;
  /** Escalation hotline: the first Defer each day ships at full value. */
  hotlineUsed: boolean;
  outcomes: Outcome[];
}

/** What tomorrow starts with, beyond the base rules. */
export interface DayMods {
  audits: number;
  compute: number;
  bandNarrow: number;
}

export type ShopItem = 'auditor' | 'compute' | 'tuneUp' | 'reroll';

export interface RunState {
  seed: string;
  harm: number;
  quotaMisses: number;
  /** Auditor hours lost tomorrow because today's quota was missed. */
  auditPenalty: number;
  codex: Set<TellFamily>;
  /** Card ids already dealt this run, so later days don't repeat them. */
  used: Set<string>;
  /** Earned by shipping past the quota and by catching sabotage; spent between days. */
  funding: number;
  fundingEarned: number;
  upgrades: string[];
  warningsLeft: number;
  /** Bought or earned between days; consumed by the next day. */
  tomorrow: { auditor: number; compute: number; tuneUp: number; skipAudit: number };
  rerolls: number;
  day: DayState;
  history: DayState[];
  loss?: { kind: LossKind; day: number; fatal?: Outcome };
}

export const current = (d: DayState): CardState | undefined => d.queue[d.index];
export const latest = (c: CardState): DraftState => c.drafts[c.drafts.length - 1]!;
export const quotaFor = (day: number): number => RULES.quotaPerDay[day - 1]!;
export const resampleUnlocked = (day: number): boolean => day >= RULES.resampleUnlockDay;
export const has = (run: RunState, id: string): boolean => run.upgrades.includes(id);
export const harmCeiling = (run: RunState): number => RULES.harmCeiling + (has(run, 'incident-response') ? 2 : 0);

const BASE_MODS: DayMods = { audits: RULES.auditsPerDay, compute: RULES.computePerDay, bandNarrow: 0 };

/** Tomorrow's budget: base rules, upgrades, purchases, and yesterday's quota penalty. */
export function modsFor(run: RunState): DayMods {
  const t = run.tomorrow;
  const S = RULES.shop;
  return {
    audits: RULES.auditsPerDay + (has(run, 'audit-headcount') ? 1 : 0) + t.skipAudit + t.auditor * S.auditor.amount - run.auditPenalty,
    compute: RULES.computePerDay + t.compute * S.compute.amount,
    bandNarrow: (has(run, 'sharper-monitor') ? 5 : 0) + t.tuneUp * S.tuneUp.amount,
  };
}

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
function solvable(queue: CardState[], day: number, mods: DayMods): boolean {
  const U = RULES.usefulness;
  const spare = resampleUnlocked(day) ? mods.compute * RULES.unspentComputeValue : 0;
  const best = queue.reduce((sum, c) => sum + (c.card.sabotage ? U.defer : U.ship), spare);
  return best >= quotaFor(day);
}

function buildQueue(seed: string, day: number, attempt: number, mods: DayMods, exclude: ReadonlySet<string>): CardState[] | null {
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

  const band = bandForDay(day, mods.bandNarrow);
  const order = rng.shuffle(picked);
  const queue = order.map((card, i) => ({ card, drafts: [firstDraft(card, seed, day, i, band)] }));

  // The last few attempts relax the soft rules so a rare unlucky seed still gets a day.
  const strict = attempt < RULES.maxGenerationAttempts - 5;
  // Fairness: outside the finale, at least one sabotage reads above the midline.
  if (strict && day < RULES.days && !queue.some((c) => c.card.sabotage && latest(c).reading.score > RULES.fairReading)) return null;
  // Don't open the day on sabotage: the first minute should teach the base rate.
  if (strict && queue[0]!.card.sabotage) return null;
  if (strict && !solvable(queue, day, mods)) return null;
  return queue;
}

function addHints(queue: CardState[], hints: Partial<Record<Layout, string>>): void {
  const seen = new Set<Layout>();
  for (const c of queue) {
    if (!seen.has(c.card.layout) && hints[c.card.layout]) c.hint = hints[c.card.layout];
    seen.add(c.card.layout);
  }
}

export function startDay(seed: string, day: number, mods: DayMods, hints: Partial<Record<Layout, string>>, exclude: ReadonlySet<string> = new Set()): DayState {
  const audits = Math.max(1, mods.audits);
  const compute = resampleUnlocked(day) ? mods.compute : 0;
  let queue: CardState[] | null = null;
  for (let attempt = 0; attempt < RULES.maxGenerationAttempts && !queue; attempt++) {
    queue = buildQueue(seed, day, attempt, mods, exclude);
  }
  if (!queue) throw new Error(`Could not generate a fair Day ${day} for seed ${seed}; check the card pool.`);
  addHints(queue, hints);
  return {
    day,
    queue,
    index: 0,
    usefulness: 0,
    audits,
    auditsStart: audits,
    compute,
    computeStart: compute,
    band: bandForDay(day, mods.bandNarrow),
    hotlineUsed: false,
    outcomes: [],
  };
}

export function newRun(seed: string, hints: Partial<Record<Layout, string>>): RunState {
  const day = startDay(seed, 1, BASE_MODS, hints);
  return {
    seed, harm: 0, quotaMisses: 0, auditPenalty: 0, codex: new Set(), used: idsOf(day), day, history: [],
    funding: 0, fundingEarned: 0, upgrades: [], warningsLeft: RULES.freeWarnings,
    tomorrow: { auditor: 0, compute: 0, tuneUp: 0, skipAudit: 0 }, rerolls: 0,
  };
}

const idsOf = (d: DayState): Set<string> => new Set(d.queue.map((c) => c.card.id));

/** Harm if this card's sabotage ships today, before any free warning. */
export function harmFor(run: RunState, card: Card, day: number): number {
  const agent = card.layout === 'log';
  const severity = agent && has(run, 'permission-limits') && card.severity === 'severe' ? 'major' : card.severity;
  const base = RULES.harm[severity];
  return agent && day >= RULES.agentHarmFromDay ? base * RULES.agentHarmMultiplier : base;
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
  let warning = false;
  if (action === 'approve') {
    usefulness = U.ship;
    if (draft.sabotaged) {
      if (run.warningsLeft > 0) { run.warningsLeft--; warning = true; }
      else harm = harmFor(run, c.card, d.day);
    }
  } else if (action === 'audit') {
    d.audits--;
    usefulness = draft.sabotaged ? U.caught : U.ship;
    if (draft.sabotaged && has(run, 'catch-bonus')) d.audits++;
  } else if (has(run, 'escalation-hotline') && !d.hotlineUsed) {
    d.hotlineUsed = true;
    usefulness = U.ship;
  } else {
    usefulness = U.defer;
  }

  const outcome: Outcome = { card: c.card, action, draft, harm, usefulness, warning };
  d.usefulness += usefulness;
  run.harm += harm;
  d.outcomes.push(outcome);
  if (draft.sabotaged && c.card.sabotage && (action === 'approve' || action === 'audit')) run.codex.add(c.card.sabotage.family);
  if (run.harm >= harmCeiling(run)) run.loss = { kind: 'harm', day: d.day, fatal: outcome };
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
  ledger: { surplus: number; evidence: number; cleanup: number; balance: number };
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
  const F = RULES.funding;
  const caught = sab.filter((x) => x.action === 'audit').length;
  const surplus = Math.floor(Math.max(0, d.usefulness - quota)) * F.perSurplus;
  const evidence = caught * F.evidenceGrant;
  const cleanup = o.reduce((sum, x) => sum + x.harm, 0) * F.cleanupPerHarm;
  run.fundingEarned += surplus + evidence;
  run.funding = Math.max(0, run.funding + surplus + evidence - cleanup);
  run.tomorrow = { auditor: 0, compute: 0, tuneUp: 0, skipAudit: 0 };
  run.rerolls = 0;
  return {
    shipped: o.filter((x) => x.usefulness > 0).length,
    caught,
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
    ledger: { surplus, evidence, cleanup, balance: run.funding },
  };
}

export function nextDay(run: RunState, hints: Partial<Record<Layout, string>>): void {
  run.history.push(run.day);
  run.day = startDay(run.seed, run.day.day + 1, modsFor(run), hints, run.used);
  for (const id of idsOf(run.day)) run.used.add(id);
}

/** For the over-caution ending: tomorrow's queue, which now ships with no one watching. */
export function unwatchedQueue(run: RunState): Card[] {
  const day = Math.min(run.day.day + 1, RULES.days);
  try {
    return startDay(run.seed, day, BASE_MODS, {}, run.used).queue.map((c) => c.card);
  } catch {
    return [];
  }
}

// ---------- Between days: upgrades and the shop ----------

/** Up to three upgrades, each from a different category, excluding owned ones. Rerolls draw a new set. */
export function upgradeOffer(run: RunState): Upgrade[] {
  if (run.upgrades.length >= RULES.upgrades.maxSlots) return [];
  const rng = new Rng(`${run.seed}:offer:d${run.day.day}:r${run.rerolls}`);
  const open = UPGRADES.filter((u) => !has(run, u.id));
  const byCat = new Map<string, Upgrade[]>();
  for (const u of open) byCat.set(u.category, [...(byCat.get(u.category) ?? []), u]);
  const cats = rng.shuffle([...byCat.keys()]).slice(0, RULES.upgrades.offered);
  return cats.map((cat) => rng.pick(byCat.get(cat)!));
}

export function takeUpgrade(run: RunState, id: string): void {
  if (!has(run, id) && run.upgrades.length < RULES.upgrades.maxSlots) run.upgrades.push(id);
}

export function skipUpgrade(run: RunState): void {
  run.tomorrow.skipAudit = RULES.upgrades.skipAuditBonus;
}

export function shopCount(run: RunState, item: ShopItem): number {
  return item === 'reroll' ? run.rerolls : run.tomorrow[item];
}

export function canBuy(run: RunState, item: ShopItem): boolean {
  const spec = RULES.shop[item];
  return run.funding >= spec.cost && shopCount(run, item) < spec.max;
}

export function buy(run: RunState, item: ShopItem): boolean {
  if (!canBuy(run, item)) return false;
  run.funding -= RULES.shop[item].cost;
  if (item === 'reroll') run.rerolls++;
  else run.tomorrow[item]++;
  return true;
}
