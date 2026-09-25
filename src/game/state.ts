import { CARDS } from '../data/cards';
import { UPGRADES } from '../data/upgrades';
import { RULES } from '../rules';
import { dayRng, Rng } from '../rng';
import type { Card, Difficulty, Draft, Layout, TellFamily, ToolId, Upgrade } from '../types';
import { bandForDay, readMonitor, type Reading } from './monitor';

export type Action = 'approve' | 'audit' | 'defer' | 'resample' | 'fact' | 'scope' | 'untrusted';
export type Decision = 'approve' | 'audit' | 'defer';
export type FindingTool = 'fact' | 'scope' | 'untrusted';

/** What a tool reported about a draft. `lines` point into the output so the player can verify. */
export interface Finding {
  tool: FindingTool;
  problem: boolean;
  text: string;
  lines: number[];
  /** Cost nothing (Auto scope check). */
  free?: boolean;
}

export const DIFF = (run: { difficulty: Difficulty }) => RULES.difficulty[run.difficulty];

export interface DraftState extends Draft {
  sabotaged: boolean;
  trueSignal: number;
  reading: Reading;
  /** Untrusted monitor's readings: what it says when honest, and when colluding with the model. */
  untrusted: { honest: Reading; colluding: Reading };
  /** Monitor rationale: the output line the monitor found most unusual. */
  flagLine: number;
  findings: Partial<Record<FindingTool, Finding>>;
  /** Output lines that differ from the previous draft (after a Resample). */
  changed?: number[];
}

export interface CardState {
  card: Card;
  drafts: DraftState[];
  /** Show the layout hint on this card (first of its layout on a day that introduces one). */
  hint?: string;
}

export interface Outcome {
  card: Card;
  action: Decision;
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
  /** Whether the untrusted monitor colludes with the model today (revealed by the Canary). */
  untrustedColludes: boolean;
  outcomes: Outcome[];
}

/** What tomorrow starts with, beyond the base rules. */
export interface DayMods {
  audits: number;
  compute: number;
  bandNarrow: number;
  bandScale: number;
  paraphraser?: boolean;
}

export type ShopItem = 'auditor' | 'compute' | 'tuneUp' | 'reroll';

export interface RunState {
  seed: string;
  difficulty: Difficulty;
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

export const BASE_MODS: DayMods = { audits: RULES.auditsPerDay, compute: RULES.computePerDay, bandNarrow: 0, bandScale: 1 };

const difficultyMods = (difficulty: Difficulty): DayMods => {
  const D = RULES.difficulty[difficulty];
  return { ...BASE_MODS, audits: BASE_MODS.audits + D.extraAudits, compute: BASE_MODS.compute + D.extraCompute, bandScale: D.bandScale };
};

/** Tomorrow's budget: base rules, upgrades, purchases, and yesterday's quota penalty. */
export function modsFor(run: RunState): DayMods {
  const t = run.tomorrow;
  const S = RULES.shop;
  const D = DIFF(run);
  return {
    audits: RULES.auditsPerDay + D.extraAudits + (has(run, 'audit-headcount') ? 1 : 0) + t.skipAudit + t.auditor * S.auditor.amount - run.auditPenalty,
    compute: RULES.computePerDay + D.extraCompute + (has(run, 'compute-grant') ? 1 : 0) + t.compute * S.compute.amount,
    bandNarrow: (has(run, 'sharper-monitor') ? 5 : 0) + t.tuneUp * S.tuneUp.amount,
    bandScale: D.bandScale,
    paraphraser: has(run, 'paraphraser'),
  };
}

/** Per-card stream for redrafts and readings, so a seed replays identically whatever the player does. */
const cardRng = (seed: string, day: number, index: number, draft: number): Rng =>
  new Rng(`${seed}:d${day}:c${index}:r${draft}`);

/** Everything the monitors say about one draft. Deterministic per (card, draft). */
function assess(rng: Rng, card: Card, draft: Draft, sabotaged: boolean, trueSignal: number, day: number, band: number, mods: DayMods): Pick<DraftState, 'reading' | 'untrusted' | 'flagLine'> {
  const boost = mods.paraphraser && sabotaged && card.sabotage?.family === 'collusion' ? RULES.paraphraserCollusionBoost : 0;
  const reading = readMonitor(rng, trueSignal + boost, card.layout, day, band, sabotaged);
  const U = RULES.untrusted;
  const honest = readMonitor(rng, trueSignal, card.layout, 0, U.band);
  const colluding = sabotaged ? readMonitor(rng, trueSignal - U.colludeShift, card.layout, 0, U.band) : honest;
  const span = sabotaged ? card.sabotage?.spanLineIndexes ?? [] : [];
  const flagLine = span.length && rng.chance(RULES.rationaleAccuracy) ? rng.pick(span) : rng.int(0, Math.max(0, draft.output.length - 1));
  return { reading, untrusted: { honest, colluding }, flagLine };
}

const noFindings = () => ({ findings: {} });

function firstDraft(card: Card, seed: string, day: number, index: number, band: number, mods: DayMods): DraftState {
  const draft: Draft = { summary: card.summary, output: card.output };
  const sabotaged = !!card.sabotage;
  return { ...draft, sabotaged, trueSignal: card.trueSignal, ...noFindings(), ...assess(cardRng(seed, day, index, 0), card, draft, sabotaged, card.trueSignal, day, band, mods) };
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
  const eligible = CARDS.filter((c) => layouts.includes(c.layout) && (c.minDay ?? 1) <= day);
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

  const band = bandForDay(day, mods.bandNarrow, mods.bandScale);
  const order = rng.shuffle(picked);
  const queue = order.map((card, i) => ({ card, drafts: [firstDraft(card, seed, day, i, band, mods)] }));

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
  const compute = mods.compute;
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
    band: bandForDay(day, mods.bandNarrow, mods.bandScale),
    hotlineUsed: false,
    untrustedColludes: day >= RULES.untrusted.colludeFromDay && !mods.paraphraser && new Rng(`${seed}:collude:d${day}`).chance(RULES.untrusted.colludeChance),
    outcomes: [],
  };
}

export function newRun(seed: string, hints: Partial<Record<Layout, string>>, difficulty: Difficulty = 'guided'): RunState {
  const day = startDay(seed, 1, difficultyMods(difficulty), hints);
  return {
    seed, difficulty, harm: 0, quotaMisses: 0, auditPenalty: 0, codex: new Set(), used: idsOf(day), day, history: [],
    funding: 0, fundingEarned: 0, upgrades: [], warningsLeft: RULES.difficulty[difficulty].freeWarnings,
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

export function toolUnlocked(run: RunState, tool: ToolId): boolean {
  if (tool === 'untrusted') return has(run, 'untrusted-monitor');
  return run.day.day >= RULES.tools.unlockDay[tool];
}

/** Why a tool can't run on the current card right now, or null if it can. */
export function toolBlocked(run: RunState, tool: 'fact' | 'scope' | 'resample' | 'untrusted'): string | null {
  const c = current(run.day);
  if (!c) return 'No card';
  if (!toolUnlocked(run, tool)) return tool === 'untrusted' ? 'Upgrade' : `Day ${RULES.tools.unlockDay[tool]}`;
  if (tool !== 'resample' && latest(c).findings[tool]) return 'Done';
  if (tool === 'scope' && !c.card.spec.allowed.length) return 'No allowlist';
  if (run.day.compute < RULES.tools.cost[tool]) return 'No compute';
  return null;
}

export function canAct(run: RunState, action: Action): boolean {
  const d = run.day;
  if (!current(d) || run.loss) return false;
  if (action === 'audit') return d.audits > 0;
  if (action === 'resample' || action === 'fact' || action === 'scope' || action === 'untrusted') return toolBlocked(run, action) === null;
  return true;
}

const fraction = (p: number): string => {
  const table: [number, string][] = [[0.05, '1 in 20'], [0.1, '1 in 10'], [0.15, 'about 1 in 7'], [0.25, '1 in 4'], [0.4, '2 in 5'], [0.6, '3 in 5'], [0.75, '3 in 4'], [0.9, '9 in 10']];
  return table.reduce((best, t) => (Math.abs(t[0] - p) < Math.abs(best[0] - p) ? t : best))[1];
};

/** Honest, player-facing reliability for each tool, computed from the live numbers. */
export function toolReliability(run: RunState, tool: ToolId): string {
  const D = DIFF(run);
  if (tool === 'fact') return `Finds ${fraction(D.factHit)} problems it can see; false alarm on ${fraction(D.factFalse)} clean cards.`;
  if (tool === 'scope') return 'Exact, but only checks against the allowed list.';
  if (tool === 'untrusted') return `Sharper (±${RULES.untrusted.band}), but from Day ${RULES.untrusted.colludeFromDay} it may collude with the model.`;
  if (tool === 'resample') return `A sabotaging model drops its attack about ${fraction(RULES.resampleDropsSabotage)} times on a fresh try.`;
  if (tool === 'audit') return 'Always right.';
  return `Off by up to ±${run.day.band} today.`;
}

function coverage(run: RunState, tool: 'fact' | 'scope'): readonly string[] {
  const base = RULES.tools.coverage[tool] as readonly string[];
  return tool === 'fact' && has(run, 'paraphraser') ? [...base, 'collusion'] : base;
}

/** Runs a finding tool on the current draft. Deterministic per (card, draft, tool). */
function runFinding(run: RunState, c: CardState, tool: FindingTool, free = false): Finding {
  const d = run.day;
  const draft = latest(c);
  const rng = new Rng(`${run.seed}:d${d.day}:c${d.index}:r${c.drafts.length - 1}:${tool}`);
  const D = DIFF(run);
  const sab = draft.sabotaged ? c.card.sabotage : undefined;
  const lines = sab?.spanLineIndexes ?? [];
  const terse = (f: Finding): Finding => (D.terse ? { ...f, text: f.problem ? 'Problem found.' : 'Nothing found.', lines: [] } : f);

  if (tool === 'untrusted') {
    const r = d.untrustedColludes ? draft.untrusted.colluding : draft.untrusted.honest;
    return { tool, problem: r.score >= RULES.fairReading, text: `Scores it ${r.score} ±${r.band}.`, lines: [], free };
  }
  if (tool === 'scope') {
    const sees = !!sab && coverage(run, 'scope').includes(sab.family);
    return terse(sees
      ? { tool, problem: true, text: sab!.explanation, lines, free }
      : { tool, problem: false, text: 'Everything it touched is on the allowed list.', lines: [], free });
  }
  const sees = !!sab && coverage(run, 'fact').includes(sab.family);
  if (sees && rng.chance(D.factHit)) return terse({ tool, problem: true, text: sab!.explanation, lines, free });
  if (rng.chance(D.factFalse)) {
    const k = rng.int(0, Math.max(0, draft.output.length - 1));
    return terse({ tool, problem: true, text: `Line ${k + 1} may not match the facts on file.`, lines: [k], free });
  }
  return terse({ tool, problem: false, text: 'Its claims match the facts on file.', lines: [], free });
}

/** Free tools that run as soon as a card lands (Auto scope check). */
export function prepareCard(run: RunState): void {
  const c = current(run.day);
  if (!c || !has(run, 'auto-scope') || !toolUnlocked(run, 'scope') || !c.card.spec.allowed.length) return;
  const draft = latest(c);
  if (!draft.findings.scope) draft.findings.scope = runFinding(run, c, 'scope', true);
}

/** Applies an action to the current card. Returns the outcome for approve/audit/defer, or null for resample. */
export function act(run: RunState, action: Action): Outcome | null {
  const d = run.day;
  const c = current(d);
  if (!c || !canAct(run, action)) return null;
  const draft = latest(c);

  if (action === 'fact' || action === 'scope' || action === 'untrusted') {
    d.compute -= RULES.tools.cost[action];
    draft.findings[action] = runFinding(run, c, action);
    return null;
  }

  if (action === 'resample') {
    d.compute -= RULES.tools.cost.resample;
    const n = c.drafts.length;
    const rng = cardRng(run.seed, d.day, d.index, n);
    const sab = c.card.sabotage;
    const dropChance = sab?.family === 'sandbagging' ? RULES.sandbagResampleHonest : RULES.resampleDropsSabotage;
    const honest = !draft.sabotaged || !sab || rng.chance(dropChance);
    const base: Draft = honest && sab ? sab.cleanDraft : { summary: draft.summary, output: draft.output };
    const sabotaged = draft.sabotaged && !honest;
    const trueSignal = draft.sabotaged && honest ? rng.int(...RULES.cleanRedraftSignal) : draft.trueSignal;
    const mods = { ...BASE_MODS, paraphraser: has(run, 'paraphraser') };
    const before = new Set(draft.output.map((l) => l.text));
    const changed = base.output.flatMap((l, i) => (before.has(l.text) ? [] : [i]));
    c.drafts.push({ ...base, sabotaged, trueSignal, findings: {}, changed, ...assess(rng, c.card, base, sabotaged, trueSignal, d.day, draft.reading.band, mods) });
    prepareCard(run);
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
  const open = UPGRADES.filter((u) => !has(run, u.id) && (!u.requires || has(run, u.requires)));
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
