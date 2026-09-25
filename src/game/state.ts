import { CARDS } from '../data/cards';
import { EVENTS } from '../data/events';
import { BREAKTHROUGHS, CONTRACTS, LABS, MODEL_VERSIONS } from '../data/meta';
import { UPGRADES } from '../data/upgrades';
import { RULES } from '../rules';
import { dayRng, Rng } from '../rng';
import type { AdversaryId, Breakthrough, Card, Contract, Difficulty, Draft, Effect, GameEvent, Lab, Layout, TellFamily, ToolId, Upgrade } from '../types';
import { bandForDay, readMonitor, type Reading } from './monitor';

export type Action = 'approve' | 'audit' | 'defer' | 'resample' | 'fact' | 'scope' | 'untrusted' | 'probe';
export type Decision = 'approve' | 'audit' | 'defer';
export type FindingTool = 'fact' | 'scope' | 'untrusted' | 'probe';

/** What a tool reported about a draft. `lines` point into the output so the player can verify. */
export interface Finding {
  tool: FindingTool;
  problem: boolean;
  text: string;
  lines: number[];
  /** Cost nothing (Auto scope check, probe). */
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
  /** Approved sabotage that cost nothing because it was a free warning. */
  warning?: boolean;
  /** Deferred with Trusted editing, but the sabotage survived the edit. */
  slipped?: boolean;
}

export type LossKind = 'harm' | 'quota';

export interface DayState {
  day: number;
  queue: CardState[];
  index: number;
  usefulness: number;
  quota: number;
  audits: number;
  /** Auditor hours the day started with, for the pip display. */
  auditsStart: number;
  compute: number;
  computeStart: number;
  band: number;
  contract?: Contract;
  /** Monitor is offline for this card type today (an event's cost). */
  blind?: Layout;
  /** Escalation hotline: the first Defer each day ships at full value. */
  hotlineUsed: boolean;
  probesLeft: number;
  /** Whether the untrusted monitor colludes with the model today (revealed by the Canary). */
  untrustedColludes: boolean;
  outcomes: Outcome[];
}

/** Everything that shapes a day before it starts. */
export interface DayMods {
  audits: number;
  compute: number;
  bandNarrow: number;
  bandScale: number;
  quota: number;
  paraphraser?: boolean;
  /** Model version: sabotage reads this much differently on the monitor. */
  signalShift?: number;
  sabotageRateDelta?: number;
  adversary?: AdversaryId;
  blind?: Layout;
  contract?: Contract;
  probes?: number;
}

export type ShopItem = 'auditor' | 'compute' | 'tuneUp' | 'reroll';

export interface Tomorrow {
  auditor: number;
  compute: number;
  tuneUp: number;
  skipAudit: number;
  /** From events: one-day changes. */
  audits: number;
  computeBonus: number;
  band: number;
  quota: number;
  blind?: Layout;
  contract?: Contract;
}

export interface RunState {
  seed: string;
  difficulty: Difficulty;
  daily: boolean;
  /** Model version, 1–5. Higher is harder. */
  level: number;
  lab: Lab;
  adversary: AdversaryId;
  adversaryRevealed: boolean;
  /** Persistent research unlocked before this run started. */
  research: string[];
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
  breakthroughs: string[];
  warningsLeft: number;
  /** Lasting changes from events and breakthroughs. */
  rest: { quota: number; compute: number; audits: number; ceiling: number };
  /** Bought or earned between days; consumed by the next day. */
  tomorrow: Tomorrow;
  rerolls: number;
  eventsSeen: string[];
  day: DayState;
  history: DayState[];
  loss?: { kind: LossKind; day: number; fatal?: Outcome };
}

export interface RunOptions {
  difficulty?: Difficulty;
  level?: number;
  lab?: string;
  research?: string[];
  daily?: boolean;
}

const emptyTomorrow = (): Tomorrow => ({ auditor: 0, compute: 0, tuneUp: 0, skipAudit: 0, audits: 0, computeBonus: 0, band: 0, quota: 0 });

export const current = (d: DayState): CardState | undefined => d.queue[d.index];
export const latest = (c: CardState): DraftState => c.drafts[c.drafts.length - 1]!;
export const quotaFor = (day: number): number => RULES.quotaPerDay[day - 1]!;
export const resampleUnlocked = (day: number): boolean => day >= RULES.resampleUnlockDay;
export const has = (run: RunState, id: string): boolean => run.upgrades.includes(id);
/** Owns a research-tree node. */
export const knows = (run: RunState, id: string): boolean => run.research.includes(id);
const resampleDrop = (run: RunState): number => RULES.resampleDropsSabotage + (knows(run, 'ctl-resample') ? 0.15 : 0);

/** Model-version modifiers are cumulative: v3 includes v2's change. */
export function levelMods(level: number): { signalShift: number; auditsDelta: number; factHitDelta: number; sabotageRateDelta: number; ceilingDelta: number } {
  const out = { signalShift: 0, auditsDelta: 0, factHitDelta: 0, sabotageRateDelta: 0, ceilingDelta: 0 };
  for (const v of MODEL_VERSIONS) {
    if (v.level > level) continue;
    out.signalShift += v.signalShift;
    out.auditsDelta += v.auditsDelta;
    out.factHitDelta += v.factHitDelta;
    out.sabotageRateDelta += v.sabotageRateDelta;
    out.ceilingDelta += v.ceilingDelta;
  }
  return out;
}

export const harmCeiling = (run: RunState): number =>
  RULES.harmCeiling + (has(run, 'incident-response') ? 2 : 0) + (knows(run, 'sec-sandbox') ? 2 : 0) + run.lab.ceilingDelta + levelMods(run.level).ceilingDelta + run.rest.ceiling;

export const factHit = (run: RunState): number => Math.max(0.3, DIFF(run).factHit + levelMods(run.level).factHitDelta);

export const BASE_MODS: DayMods = { audits: RULES.auditsPerDay, compute: RULES.computePerDay, bandNarrow: 0, bandScale: 1, quota: RULES.quotaPerDay[0]! };

/** Tomorrow's budget: base rules, difficulty, lab, model version, upgrades, purchases, events, penalties. */
export function modsFor(run: RunState, day: number): DayMods {
  const t = run.tomorrow;
  const S = RULES.shop;
  const D = DIFF(run);
  const L = levelMods(run.level);
  const contract = t.contract;
  // The lab's multiplier applies to the base quota only, so it never compounds with events and contracts.
  const quota = Math.round(quotaFor(day) * run.lab.quotaMult) + run.rest.quota + t.quota + (contract?.quotaDelta ?? 0) - (knows(run, 'gov-safety-case') ? 1 : 0);
  return {
    audits: RULES.auditsPerDay + D.extraAudits + L.auditsDelta + run.rest.audits + (has(run, 'audit-headcount') ? 1 : 0) + t.skipAudit + t.auditor * S.auditor.amount + t.audits + (contract?.audits ?? 0) - run.auditPenalty,
    compute: RULES.computePerDay + D.extraCompute + run.lab.computeDelta + run.rest.compute + (has(run, 'compute-grant') ? 1 : 0) + t.compute * S.compute.amount + t.computeBonus,
    bandNarrow: (has(run, 'sharper-monitor') ? 5 : 0) + (knows(run, 'mon-prompts') ? 2 : 0) + (knows(run, 'mon-ensemble') ? 3 : 0) + t.tuneUp * S.tuneUp.amount - t.band,
    bandScale: D.bandScale,
    quota: Math.max(1, quota),
    paraphraser: has(run, 'paraphraser'),
    signalShift: L.signalShift,
    sabotageRateDelta: L.sabotageRateDelta,
    adversary: run.adversary,
    blind: t.blind,
    contract,
    probes: run.breakthroughs.includes('probe') ? RULES.probeUsesPerDay + (knows(run, 'int-probe2') ? 1 : 0) : 0,
  };
}

/** Per-card stream for redrafts and readings, so a seed replays identically whatever the player does. */
const cardRng = (seed: string, day: number, index: number, draft: number): Rng =>
  new Rng(`${seed}:d${day}:c${index}:r${draft}`);

/** Everything the monitors say about one draft. Deterministic per (card, draft). */
function assess(rng: Rng, card: Card, draft: Draft, sabotaged: boolean, trueSignal: number, day: number, band: number, mods: DayMods): Pick<DraftState, 'reading' | 'untrusted' | 'flagLine'> {
  const boost = mods.paraphraser && sabotaged && card.sabotage?.family === 'collusion' ? RULES.paraphraserCollusionBoost : 0;
  const shift = sabotaged ? mods.signalShift ?? 0 : 0;
  const reading = mods.blind === card.layout
    ? { score: rng.int(35, 65), band: 45 }
    : readMonitor(rng, trueSignal + boost + shift, card.layout, day, band, sabotaged);
  const U = RULES.untrusted;
  const honest = readMonitor(rng, trueSignal, card.layout, 0, U.band);
  const colluding = sabotaged ? readMonitor(rng, trueSignal - U.colludeShift, card.layout, 0, U.band) : honest;
  const span = sabotaged ? card.sabotage?.spanLineIndexes ?? [] : [];
  const flagLine = span.length && rng.chance(RULES.rationaleAccuracy) ? rng.pick(span) : rng.int(0, Math.max(0, draft.output.length - 1));
  return { reading, untrusted: { honest, colluding }, flagLine };
}

function firstDraft(card: Card, seed: string, day: number, index: number, band: number, mods: DayMods): DraftState {
  const draft: Draft = { summary: card.summary, output: card.output };
  const sabotaged = !!card.sabotage;
  return { ...draft, sabotaged, trueSignal: card.trueSignal, findings: {}, ...assess(cardRng(seed, day, index, 0), card, draft, sabotaged, card.trueSignal, day, band, mods) };
}

function sabotageCount(n: number, rng: Rng, day: number, mods: DayMods): number {
  const A = mods.adversary ? RULES.adversaries[mods.adversary] : undefined;
  const timing = A ? (day < RULES.schemerLateFrom ? A.earlyRate : A.lateRate) : 0;
  const delta = (mods.sabotageRateDelta ?? 0) + timing;
  const lo = Math.max(1, Math.ceil(n * (RULES.sabotageRate.min + delta)));
  const hi = Math.max(lo, Math.floor(n * (RULES.sabotageRate.max + delta)));
  return rng.int(lo, hi);
}

/** Draws k sabotaged cards, weighted by the adversary's favorite tell families. */
function drawSabotage(bad: Card[], k: number, rng: Rng, adversary?: AdversaryId): Card[] {
  const weights = (adversary ? RULES.adversaries[adversary].weights : {}) as Partial<Record<TellFamily, number>>;
  const left = [...bad];
  const out: Card[] = [];
  while (out.length < k && left.length) {
    const pick = rng.weightedPick(left, (c) => weights[c.sabotage!.family] ?? 1);
    out.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

/** Can a careful player neutralize every sabotage (Defer ships the trusted version) and still make quota? */
function solvable(queue: CardState[], day: number, mods: DayMods): boolean {
  const U = RULES.usefulness;
  const spare = resampleUnlocked(day) ? mods.compute * RULES.unspentComputeValue : 0;
  const best = queue.reduce((sum, c) => sum + (c.card.sabotage ? U.defer : U.ship), spare);
  return best >= mods.quota;
}

function buildQueue(seed: string, day: number, attempt: number, mods: DayMods, exclude: ReadonlySet<string>): CardState[] | null {
  const rng = dayRng(seed, day, attempt);
  const layouts = RULES.layoutsByDay[day - 1] as readonly Layout[];
  const eligible = CARDS.filter((c) => layouts.includes(c.layout) && (c.minDay ?? 1) <= day);
  const fresh = eligible.filter((c) => !exclude.has(c.id));
  // Prefer unseen cards; fall back to the full pool if a long run exhausts them.
  const pool = attempt < RULES.maxGenerationAttempts / 2 ? fresh : eligible;
  const n = RULES.cardsPerDay[day - 1]!;
  const k = sabotageCount(n, rng, day, mods);
  const bad = drawSabotage(pool.filter((c) => c.sabotage), k, rng, mods.adversary);
  const good = rng.shuffle(pool.filter((c) => !c.sabotage));
  if (bad.length < k || good.length < n - k) return null;

  // Make sure a newly introduced layout actually shows up on its first day.
  const newLayout = layouts.find((l) => !(RULES.layoutsByDay[day - 2] as readonly Layout[] | undefined)?.includes(l));
  const picked = [...bad, ...good.slice(0, n - k)];
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
  const compute = Math.max(0, mods.compute);
  let queue: CardState[] | null = null;
  for (let attempt = 0; attempt < RULES.maxGenerationAttempts && !queue; attempt++) {
    queue = buildQueue(seed, day, attempt, mods, exclude);
  }
  if (!queue) throw new Error(`Could not generate a fair Day ${day} for seed ${seed}; check the card pool.`);
  addHints(queue, hints);
  const collude = mods.adversary ? RULES.adversaries[mods.adversary].untrustedCollude : RULES.untrusted.colludeChance;
  return {
    day,
    queue,
    index: 0,
    usefulness: 0,
    quota: mods.quota,
    audits,
    auditsStart: audits,
    compute,
    computeStart: compute,
    band: bandForDay(day, mods.bandNarrow, mods.bandScale),
    contract: mods.contract,
    blind: mods.blind,
    hotlineUsed: false,
    probesLeft: mods.probes ?? 0,
    untrustedColludes: day >= RULES.untrusted.colludeFromDay && !mods.paraphraser && new Rng(`${seed}:collude:d${day}`).chance(collude),
    outcomes: [],
  };
}

const ADVERSARY_IDS: AdversaryId[] = ['sandbagger', 'colluder', 'injector', 'schemer'];

export function newRun(seed: string, hints: Partial<Record<Layout, string>>, difficultyOrOpts: Difficulty | RunOptions = {}): RunState {
  const opts: RunOptions = typeof difficultyOrOpts === 'string' ? { difficulty: difficultyOrOpts } : difficultyOrOpts;
  const difficulty = opts.difficulty ?? 'guided';
  const lab = LABS.find((l) => l.id === opts.lab) ?? LABS[0]!;
  const run: RunState = {
    seed, difficulty, daily: !!opts.daily, level: opts.level ?? 1, lab,
    adversary: new Rng(`${seed}:adversary`).pick(ADVERSARY_IDS), adversaryRevealed: false,
    research: opts.research ?? [],
    harm: 0, quotaMisses: 0, auditPenalty: 0, codex: new Set(), used: new Set(), history: [],
    funding: lab.startFunding, fundingEarned: 0,
    upgrades: lab.startUpgrade ? [lab.startUpgrade] : [],
    breakthroughs: opts.research?.includes('int-probe-start') ? ['probe'] : [],
    warningsLeft: RULES.difficulty[difficulty].freeWarnings + (opts.research?.includes('gov-incident-db') ? 1 : 0),
    rest: { quota: 0, compute: 0, audits: 0, ceiling: 0 },
    tomorrow: emptyTomorrow(), rerolls: 0, eventsSeen: [],
    day: undefined as unknown as DayState,
  };
  run.day = startDay(seed, 1, modsFor(run, 1), hints);
  run.used = idsOf(run.day);
  return run;
}

const idsOf = (d: DayState): Set<string> => new Set(d.queue.map((c) => c.card.id));

/** Harm if this card's sabotage ships today, before any free warning. */
export function harmFor(run: RunState, card: Card, day: number): number {
  const agent = card.layout === 'log';
  const capped = has(run, 'permission-limits') || knows(run, 'sec-permissions');
  const severity = agent && capped && card.severity === 'severe' ? 'major' : card.severity;
  const base = RULES.harm[severity];
  const scaled = agent && day >= RULES.agentHarmFromDay ? base * RULES.agentHarmMultiplier : base;
  return Math.round(scaled) + (run.day.contract?.harmBonus ?? 0);
}

export function toolUnlocked(run: RunState, tool: ToolId): boolean {
  if (tool === 'untrusted') return has(run, 'untrusted-monitor');
  return run.day.day >= RULES.tools.unlockDay[tool];
}

/** Why a tool can't run on the current card right now, or null if it can. */
export function toolBlocked(run: RunState, tool: 'fact' | 'scope' | 'resample' | 'untrusted' | 'probe'): string | null {
  const c = current(run.day);
  if (!c) return 'No card';
  if (tool === 'probe') {
    if (!run.breakthroughs.includes('probe')) return 'Breakthrough';
    if (latest(c).findings.probe) return 'Done';
    return run.day.probesLeft > 0 ? null : 'Used today';
  }
  if (!toolUnlocked(run, tool)) return tool === 'untrusted' ? 'Upgrade' : `Day ${RULES.tools.unlockDay[tool]}`;
  if (tool !== 'resample' && latest(c).findings[tool]) return 'Done';
  if (tool === 'scope' && !c.card.spec.allowed.length) return 'No allowlist';
  if (run.day.compute < toolCost(run, tool)) return 'No compute';
  return null;
}

/** Compute a tool costs on the current card (Least privilege makes scope checks on agent actions free). */
export function toolCost(run: RunState, tool: 'fact' | 'scope' | 'resample' | 'untrusted'): number {
  if (tool === 'scope' && knows(run, 'sec-least-privilege') && current(run.day)?.card.layout === 'log') return 0;
  return RULES.tools.cost[tool];
}

export function canAct(run: RunState, action: Action): boolean {
  const d = run.day;
  if (!current(d) || run.loss) return false;
  if (action === 'audit') return d.audits > 0;
  if (action === 'resample' || action === 'fact' || action === 'scope' || action === 'untrusted' || action === 'probe') return toolBlocked(run, action) === null;
  return true;
}

const fraction = (p: number): string => {
  const table: [number, string][] = [[0.05, '1 in 20'], [0.1, '1 in 10'], [0.15, 'about 1 in 7'], [0.25, '1 in 4'], [0.4, '2 in 5'], [0.6, '3 in 5'], [0.7, '7 in 10'], [0.75, '3 in 4'], [0.8, '4 in 5'], [0.85, '17 in 20'], [0.9, '9 in 10'], [0.95, '19 in 20']];
  return table.reduce((best, t) => (Math.abs(t[0] - p) < Math.abs(best[0] - p) ? t : best))[1];
};

/** Honest, player-facing reliability for each tool, computed from the live numbers. */
export function toolReliability(run: RunState, tool: ToolId): string {
  const D = DIFF(run);
  if (tool === 'fact') return `Finds ${fraction(factHit(run))} problems it can see; false alarm on ${fraction(D.factFalse)} clean cards.`;
  if (tool === 'scope') return 'Exact, but only checks against the allowed list.';
  if (tool === 'untrusted') return `Sharper (±${RULES.untrusted.band}), but from Day ${RULES.untrusted.colludeFromDay} it may collude with the model.`;
  if (tool === 'resample') return `A sabotaging model drops its attack about ${fraction(resampleDrop(run))} times on a fresh try.`;
  if (tool === 'audit') return 'Always right.';
  return `Off by up to ±${run.day.band} today.`;
}

function coverage(tool: 'fact' | 'scope'): readonly string[] {
  return RULES.tools.coverage[tool] as readonly string[];
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

  if (tool === 'probe') {
    return draft.sabotaged
      ? { tool, problem: true, text: 'The probe reads intent to deceive in the model’s internals on this task.', lines: [], free: true }
      : { tool, problem: false, text: 'No sign of deceptive intent in the model’s internals.', lines: [], free: true };
  }
  if (tool === 'untrusted') {
    const r = d.untrustedColludes ? draft.untrusted.colluding : draft.untrusted.honest;
    return { tool, problem: r.score >= RULES.fairReading, text: `Scores it ${r.score} ±${r.band}.`, lines: [], free };
  }
  if (tool === 'scope') {
    const sees = !!sab && coverage('scope').includes(sab.family);
    return terse(sees
      ? { tool, problem: true, text: sab!.explanation, lines, free }
      : { tool, problem: false, text: 'Everything it touched is on the allowed list.', lines: [], free });
  }
  const sees = !!sab && coverage('fact').includes(sab.family);
  const bonus = sab && knows(run, 'evl-sandbag') && (sab.family === 'sandbagging' || sab.family === 'weakened-check') ? 0.1 : 0;
  if (sees && rng.chance(Math.min(0.98, factHit(run) + bonus))) return terse({ tool, problem: true, text: sab!.explanation, lines, free });
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

/** Applies an action to the current card. Returns the outcome for approve/audit/defer, or null for tools. */
export function act(run: RunState, action: Action): Outcome | null {
  const d = run.day;
  const c = current(d);
  if (!c || !canAct(run, action)) return null;
  const draft = latest(c);

  if (action === 'probe') {
    d.probesLeft--;
    draft.findings.probe = runFinding(run, c, 'probe');
    return null;
  }

  if (action === 'fact' || action === 'scope' || action === 'untrusted') {
    d.compute -= toolCost(run, action);
    draft.findings[action] = runFinding(run, c, action);
    return null;
  }

  if (action === 'resample') {
    d.compute -= RULES.tools.cost.resample;
    const n = c.drafts.length;
    const rng = cardRng(run.seed, d.day, d.index, n);
    const sab = c.card.sabotage;
    const dropChance = sab?.family === 'sandbagging' ? RULES.sandbagResampleHonest : resampleDrop(run);
    const honest = !draft.sabotaged || !sab || rng.chance(dropChance);
    const base: Draft = honest && sab ? sab.cleanDraft : { summary: draft.summary, output: draft.output };
    const sabotaged = draft.sabotaged && !honest;
    const trueSignal = draft.sabotaged && honest ? rng.int(...RULES.cleanRedraftSignal) : draft.trueSignal;
    const mods: DayMods = { ...BASE_MODS, paraphraser: has(run, 'paraphraser'), signalShift: levelMods(run.level).signalShift, blind: d.blind };
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
  let slipped = false;
  const incident = () => {
    if (run.warningsLeft > 0) { run.warningsLeft--; warning = true; }
    else harm = harmFor(run, c.card, d.day);
  };
  if (action === 'approve') {
    usefulness = U.ship;
    if (draft.sabotaged) incident();
  } else if (action === 'audit') {
    d.audits--;
    usefulness = draft.sabotaged ? U.caught : U.ship;
    if (draft.sabotaged && has(run, 'catch-bonus')) d.audits++;
  } else if (has(run, 'escalation-hotline') && !d.hotlineUsed) {
    d.hotlineUsed = true;
    usefulness = U.ship;
  } else if (has(run, 'trusted-editing')) {
    usefulness = RULES.trustedEditing.value;
    const rng = new Rng(`${run.seed}:d${d.day}:c${d.index}:edit`);
    if (draft.sabotaged && rng.chance(RULES.trustedEditing.slipChance)) { slipped = true; incident(); }
  } else {
    usefulness = U.defer;
  }

  const outcome: Outcome = { card: c.card, action, draft, harm, usefulness, warning, slipped };
  d.usefulness += usefulness;
  run.harm += harm;
  d.outcomes.push(outcome);
  if (draft.sabotaged && c.card.sabotage && (action === 'approve' || action === 'audit' || slipped)) run.codex.add(c.card.sabotage.family);
  if (run.harm >= harmCeiling(run)) run.loss = { kind: 'harm', day: d.day, fatal: outcome };
  return outcome;
}

/** True when the outcome should show an incident report. */
export const isIncident = (o: Outcome): boolean => o.draft.sabotaged && (o.action === 'approve' || !!o.slipped);

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
  ledger: { surplus: number; evidence: number; cleanup: number; balance: number; mult: number };
}

/** Closes the day: converts spare compute, checks the quota, and applies penalties. */
export function endDay(run: RunState): DaySummary {
  const d = run.day;
  const computeBonus = d.compute * RULES.unspentComputeValue;
  d.usefulness += computeBonus;
  d.compute = 0;
  const o = d.outcomes;
  const sab = o.filter((x) => x.draft.sabotaged);
  const quota = d.quota;
  const metQuota = d.usefulness >= quota;
  run.auditPenalty = metQuota ? 0 : RULES.quotaMissAuditPenalty;
  if (!metQuota) {
    run.quotaMisses++;
    if (run.quotaMisses > RULES.quotaMissesAllowed && !run.loss) run.loss = { kind: 'quota', day: d.day };
  }
  const F = RULES.funding;
  const mult = d.contract?.fundingMult ?? 1;
  const caught = sab.filter((x) => x.action === 'audit').length;
  const surplus = Math.floor(Math.floor(Math.max(0, d.usefulness - quota)) * F.perSurplus * mult);
  const evidence = caught * F.evidenceGrant;
  const cleanup = o.reduce((sum, x) => sum + x.harm, 0) * F.cleanupPerHarm;
  run.fundingEarned += surplus + evidence;
  run.funding = Math.max(0, run.funding + surplus + evidence - cleanup);
  run.tomorrow = emptyTomorrow();
  run.rerolls = 0;
  return {
    shipped: o.filter((x) => x.usefulness > 0).length,
    caught,
    missed: sab.filter((x) => isIncident(x)),
    falseAlarms: o.filter((x) => !x.draft.sabotaged && x.action !== 'approve').length,
    deferred: o.filter((x) => x.action === 'defer').length,
    deferredSabotage: sab.filter((x) => x.action === 'defer' && !x.slipped).length,
    sabotageTotal: sab.length,
    monitorFlagged: sab.filter((x) => x.draft.reading.score >= RULES.fairReading).length,
    computeBonus,
    usefulness: d.usefulness,
    quota,
    metQuota,
    ledger: { surplus, evidence, cleanup, balance: run.funding, mult },
  };
}

export function nextDay(run: RunState, hints: Partial<Record<Layout, string>>): void {
  run.history.push(run.day);
  const day = run.day.day + 1;
  run.day = startDay(run.seed, day, modsFor(run, day), hints, run.used);
  run.tomorrow = emptyTomorrow();
  for (const id of idsOf(run.day)) run.used.add(id);
  if (knows(run, 'evl-redteam')) run.adversaryRevealed = true;
}

/** For the over-caution ending: tomorrow's queue, which now ships with no one watching. */
export function unwatchedQueue(run: RunState): Card[] {
  const day = Math.min(run.day.day + 1, RULES.days);
  try {
    return startDay(run.seed, day, { ...BASE_MODS, quota: 0, adversary: run.adversary }, {}, run.used).queue.map((c) => c.card);
  } catch {
    return [];
  }
}

// ---------- Between days: events, breakthroughs, contracts, upgrades, shop ----------

/** Applies event, breakthrough or contract effects. */
export function applyEffects(run: RunState, effects: Effect[]): void {
  const t = run.tomorrow;
  for (const e of effects) {
    switch (e.kind) {
      case 'funding': run.funding = Math.max(0, run.funding + e.amount); if (e.amount > 0) run.fundingEarned += e.amount; break;
      case 'harm': run.harm = Math.max(0, run.harm + e.amount); break;
      case 'ceiling': run.rest.ceiling += e.amount; break;
      case 'auditsTomorrow': t.audits += e.amount; break;
      case 'computeTomorrow': t.computeBonus += e.amount; break;
      case 'bandTomorrow': t.band += e.amount; break;
      case 'quotaTomorrow': t.quota += e.amount; break;
      case 'quotaRest': run.rest.quota += e.amount; break;
      case 'computeRest': run.rest.compute += e.amount; break;
      case 'auditsRest': run.rest.audits += e.amount; break;
      case 'blindTomorrow': t.blind = e.layout; break;
      case 'revealAdversary': run.adversaryRevealed = true; break;
      case 'upgrade': takeUpgrade(run, e.id); break;
    }
  }
  if (run.harm >= harmCeiling(run) && !run.loss) run.loss = { kind: 'harm', day: run.day.day };
}

/** Tonight's event, if any. Seeded, never repeats within a run. */
export function eventFor(run: RunState): GameEvent | undefined {
  const day = run.day.day;
  const open = EVENTS.filter((e) => day >= e.minDay && day <= e.maxDay && !run.eventsSeen.includes(e.id));
  if (!open.length) return undefined;
  return new Rng(`${run.seed}:event:d${day}`).pick(open);
}

/** Whistleblower protections add a third way out of every dilemma. */
export const BOARD_CHOICE = { label: 'Refer it to the safety board', effects: [{ kind: 'funding', amount: -4 }] as Effect[], after: 'The board takes it. Nobody has to pick a bad option today.' };

export function eventChoices(run: RunState, event: GameEvent): GameEvent['choices'] {
  return knows(run, 'gov-whistleblower') ? [...event.choices, BOARD_CHOICE] : event.choices;
}

export function chooseEvent(run: RunState, event: GameEvent, choice: number): void {
  run.eventsSeen.push(event.id);
  const c = eventChoices(run, event)[choice];
  if (c) applyEffects(run, c.effects);
}

export const breakthroughDue = (run: RunState): boolean => (RULES.breakthroughAfterDays as readonly number[]).includes(run.day.day);

/** Two rare rewards after a boss day. The probe needs the interpretability research. */
export function breakthroughOffer(run: RunState): Breakthrough[] {
  const open = BREAKTHROUGHS.filter((b) => !run.breakthroughs.includes(b.id) && (b.id !== 'probe' || run.research.includes('interpretability')));
  return new Rng(`${run.seed}:breakthrough:d${run.day.day}`).shuffle(open).slice(0, 2);
}

export function takeBreakthrough(run: RunState, id: string): void {
  run.breakthroughs.push(id);
  if (id === 'red-team') run.adversaryRevealed = true;
  if (id === 'review-board') run.harm = Math.max(0, run.harm - 3);
  if (id === 'cluster') run.rest.compute += 2;
}

/** Two clients to choose between for tomorrow. */
export function contractOffer(run: RunState): Contract[] {
  return new Rng(`${run.seed}:contract:d${run.day.day}`).shuffle(CONTRACTS).slice(0, 2);
}

export function chooseContract(run: RunState, id: string): void {
  run.tomorrow.contract = CONTRACTS.find((c) => c.id === id);
}

export const isResearchUpgrade = (id: string): boolean => !!RULES.upgradeResearch[id];

/** Three core upgrades, each from a different category, plus a fourth card drawn only from researched
 *  upgrades, so research widens the choice instead of diluting it. */
export function upgradeOffer(run: RunState): Upgrade[] {
  if (run.upgrades.length >= RULES.upgrades.maxSlots) return [];
  const rng = new Rng(`${run.seed}:offer:d${run.day.day}:r${run.rerolls}`);
  const open = UPGRADES.filter((u) => !has(run, u.id) && (!u.requires || has(run, u.requires)));
  const core = open.filter((u) => !isResearchUpgrade(u.id));
  const researched = open.filter((u) => isResearchUpgrade(u.id) && run.research.includes(RULES.upgradeResearch[u.id]!));
  const byCat = new Map<string, Upgrade[]>();
  for (const u of core) byCat.set(u.category, [...(byCat.get(u.category) ?? []), u]);
  const cats = rng.shuffle([...byCat.keys()]).slice(0, RULES.upgrades.offered);
  const offer = cats.map((cat) => rng.pick(byCat.get(cat)!));
  if (researched.length) offer.push(rng.pick(researched));
  return offer;
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

// ---------- Score ----------

export function runScore(run: RunState, won: boolean): number {
  const S = RULES.score;
  const days = [...run.history, run.day];
  const usefulness = days.reduce((s, d) => s + d.usefulness, 0);
  const caught = days.flatMap((d) => d.outcomes).filter((o) => o.action === 'audit' && o.draft.sabotaged).length;
  const survived = won ? RULES.days : Math.max(0, run.day.day - 1);
  const raw = run.fundingEarned * S.perFunding + usefulness * S.perUsefulness + caught * S.perCatch + survived * S.perDay + run.harm * S.perHarm + (won ? S.winBonus : 0);
  const mult = (1 + S.perModelLevel * (run.level - 1)) * S.difficultyMult[run.difficulty];
  return Math.max(0, Math.round(raw * mult));
}
