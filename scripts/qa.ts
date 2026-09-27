// Engine QA fuzzer: plays the real engine across the full matrix of difficulty × model level × lab ×
// adversary × research × daily, with a randomized player that exercises every action/choice and an
// oracle player that knows the truth. Asserts invariants and prints a violations table with repros.
// Usage: npm run qa -- [--quick] [--limit N]
import { dayInfo } from '../src/data/days';
import { BREAKTHROUGHS, CONTRACTS, LABS } from '../src/data/meta';
import { FAMILY_BRANCH, TREE, type Branch } from '../src/data/research-tree';
import { UPGRADES } from '../src/data/upgrades';
import { EVENTS } from '../src/data/events';
import { emptyProgress, gradeFor, recordRun } from '../src/game/progress';
import {
  act, advance, applyEffects, breakthroughDue, breakthroughOffer, buy, canAct, canBuy, chooseContract, chooseEvent, contractOffer, current,
  dayOver, endDay, eventChoices, eventFor, factHit, harmCeiling, harmFor, isIncident, latest, modsFor, newRun, nextDay, perfectUsefulness,
  runScore, scenarioOf, skipUpgrade, startDay, takeBreakthrough, takeUpgrade, toolBlocked, toolCost, upgradeOffer,
  type Action, type DayState, type Outcome, type RunState, type ShopItem,
} from '../src/game/state';
import { Rng } from '../src/rng';
import { RULES } from '../src/rules';
import type { AdversaryId, Difficulty, Effect } from '../src/types';

const argv = process.argv.slice(2);
const QUICK = argv.includes('--quick');
const LIMIT = (() => { const i = argv.indexOf('--limit'); return i >= 0 ? Number(argv[i + 1]) : QUICK ? 3000 : 50000; })();
const hints = (day: number) => dayInfo(day).hints;
const t0 = Date.now();

// ---------- Violation bookkeeping ----------
interface Violation { count: number; repro: string }
const V = new Map<string, Violation>();
function fail(key: string, repro: string): void {
  const v = V.get(key);
  if (v) v.count++;
  else V.set(key, { count: 1, repro });
}
const stats = {
  runs: 0, days: 0, relaxedDays: 0, crossDayRepeats: 0, relaxedCapped: 0, repeatsCapped: 0, cappedDays: 0, relaxedFirst: 0, relaxedFair: 0, repeatDays: 0, capTriggers: 0, maxAsked: 0, maxAskedOver: 0,
  minSlack: Infinity, oracleRuns: 0, oracleWins: 0, oracleSlipHarm: 0, actions: new Map<string, number>(),
  eventChoices: new Map<string, number>(), breakthroughs: new Map<string, number>(), contracts: new Map<string, number>(),
  upgrades: new Map<string, number>(), shop: new Map<string, number>(), exceptions: 0,
};
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

// ---------- Matrix ----------
const DIFFS: Difficulty[] = ['guided', 'standard', 'analyst'];
const LEVELS = [1, 2, 3, 4, 5];
const ADVS: AdversaryId[] = ['sandbagger', 'colluder', 'injector', 'schemer'];
const ALL_RESEARCH = TREE.map((n) => n.id);

// Seeds that produce each adversary (newRun picks the adversary from the seed).
const SEEDS_BY_ADV = new Map<AdversaryId, string[]>(ADVS.map((a) => [a, []]));
for (let i = 0; [...SEEDS_BY_ADV.values()].some((l) => l.length < 60); i++) {
  const seed = `QA-${i}`;
  const a = new Rng(`${seed}:adversary`).pick(ADVS);
  const list = SEEDS_BY_ADV.get(a)!;
  if (list.length < 60) list.push(seed);
}

const researchSets: { name: string; ids: string[] }[] = [{ name: 'none', ids: [] }, { name: 'all', ids: ALL_RESEARCH }];
{
  const r = new Rng('qa:research');
  for (let i = 0; i < 20; i++) researchSets.push({ name: `rand${i}`, ids: ALL_RESEARCH.filter(() => r.chance(0.5)) });
}

interface Combo { difficulty: Difficulty; level: number; lab: string; adversary: AdversaryId; research: { name: string; ids: string[] }; daily: boolean; quick: boolean; seed: string }
const combos: Combo[] = [];
{
  let k = 0;
  for (const difficulty of DIFFS) for (const level of LEVELS) for (const lab of LABS) for (const adversary of ADVS)
    for (const research of researchSets) for (const [daily, quick] of [[false, false], [true, false], [false, true]]) {
      const seeds = SEEDS_BY_ADV.get(adversary)!;
      combos.push({ difficulty, level, lab: lab.id, adversary, research, daily: daily!, quick: quick!, seed: seeds[k++ % seeds.length]! });
    }
}
const describe = (c: Combo, player: string) =>
  `seed=${c.seed} difficulty=${c.difficulty} level=${c.level} lab=${c.lab} adversary=${c.adversary} research=${c.research.name}${c.research.name.startsWith('rand') ? `[${c.research.ids.join(',')}]` : ''} daily=${c.daily} quick=${c.quick} player=${player}`;

// ---------- Helpers ----------
const TOOL_ACTIONS: ('fact' | 'scope' | 'resample' | 'untrusted' | 'probe')[] = ['fact', 'scope', 'resample', 'untrusted', 'probe'];
const ALL_ACTIONS: Action[] = ['approve', 'defer', 'audit', 'resample', 'fact', 'scope', 'untrusted', 'probe'];
const SHOP: ShopItem[] = ['auditor', 'compute', 'tuneUp', 'reroll'];

function checkResources(run: RunState, where: string, repro: () => string): void {
  const d = run.day;
  if (d.audits < 0) fail('resource: audits < 0', `${repro()} at ${where}`);
  if (d.compute < 0) fail('resource: compute < 0', `${repro()} at ${where}`);
  if (d.probesLeft < 0) fail('resource: probesLeft < 0', `${repro()} at ${where}`);
  if (run.funding < 0) fail('resource: funding < 0', `${repro()} at ${where}`);
  if (run.harm < 0) fail('harm < 0', `${repro()} at ${where}`);
  const c = current(d);
  if (!c || run.loss) return;
  for (const t of TOOL_ACTIONS) {
    const blocked = toolBlocked(run, t) === null;
    if (blocked !== canAct(run, t)) fail(`toolBlocked/canAct mismatch (${t})`, `${repro()} at ${where}`);
  }
}

/** Day generation used the relaxed fallback if a strict rule is violated in the final queue. */
function relaxed(d: DayState): boolean {
  const sab = d.queue.filter((c) => c.card.sabotage);
  if (d.queue[0]?.card.sabotage) return true;
  if (d.day < RULES.days && sab.length && !sab.some((c) => latest(c).reading.score > RULES.fairReading)) return true;
  return false;
}

function checkDayStart(run: RunState, seen: Set<string>, repro: () => string, isOracle: boolean): void {
  const d = run.day;
  stats.days++;
  const capped = d.quotaAsked > d.quota;
  if (capped) stats.cappedDays++;
  if (relaxed(d)) { stats.relaxedDays++; if (capped) stats.relaxedCapped++; }
  if (d.queue[0]?.card.sabotage) stats.relaxedFirst++;
  if (d.day < RULES.days && d.queue.some((c) => c.card.sabotage) && !d.queue.some((c) => c.card.sabotage && latest(c).reading.score > RULES.fairReading)) stats.relaxedFair++;
  const keys = d.queue.map((c) => scenarioOf(c.card));
  if (new Set(keys).size !== keys.length) fail('scenario repeats within a day', `${repro()} day ${d.day}: ${keys.join(',')}`);
  const reps = keys.filter((k) => seen.has(k)).length;
  if (reps) { stats.repeatDays++; if (capped) stats.repeatsCapped++; }
  stats.crossDayRepeats += reps;
  for (const k of keys) seen.add(k);
  const perfect = perfectUsefulness(d.queue);
  const slack = perfect - d.quota;
  stats.minSlack = Math.min(stats.minSlack, slack);
  // Perfect play always makes quota, with the difficulty's minimum room (one mistake on Guided and Standard).
  const minRoom = RULES.quotaFromQueue ? RULES.quotaMinRoom[run.difficulty] : RULES.quotaMargin;
  if (slack < minRoom - 1e-9) fail('quota exceeds perfect − margin', `${repro()} day ${d.day}: quota ${d.quota}, perfect ${perfect}`);
  if (d.quotaAsked > d.quota) stats.capTriggers++;
  stats.maxAsked = Math.max(stats.maxAsked, d.quotaAsked);
  stats.maxAskedOver = Math.max(stats.maxAskedOver, d.quotaAsked - d.quota);
  if (isOracle && d.quota <= 0) fail('non-positive quota', `${repro()} day ${d.day}`);
}

/** Returns the harm-log decrease total since index `from`. */
const logDelta = (run: RunState, from: number) => run.harmLog.slice(from).reduce((s, h) => s + h.amount, 0);

// ---------- One run ----------
interface PlayResult { run: RunState; log: string[]; won: boolean }

function play(combo: Combo, player: 'random' | 'oracle', forceUpgrade: string | null, rngSeed: string, replayLog?: string[]): PlayResult {
  const rng = new Rng(rngSeed);
  const log: string[] = [];
  let li = 0;
  // Choices are recorded so a replay can reproduce them exactly (determinism check).
  const choose = <T>(label: string, options: T[], pick: () => number): T => {
    const i = replayLog ? Number(replayLog[li++]!.split(':')[1]) : pick();
    log.push(`${label}:${i}`);
    return options[i]!;
  };
  const repro = () => `${describe(combo, player)} force=${forceUpgrade ?? '-'} rng=${rngSeed}`;
  const run = newRun(combo.seed, hints(1), { difficulty: combo.difficulty, level: combo.level, lab: combo.lab, research: combo.research.ids, daily: combo.daily, quick: combo.quick });
  if (forceUpgrade) { takeUpgrade(run, forceUpgrade); bump(stats.upgrades, forceUpgrade); }
  const seen = new Set<string>();
  const isOracle = player === 'oracle';
  checkDayStart(run, seen, repro, isOracle);
  let won = false;

  for (;;) {
    const d = run.day;
    const harmAtDayStart = run.harm;
    let incidentHarm = 0;
    // ----- the shift -----
    while (!dayOver(d) && !run.loss) {
      checkResources(run, `day ${d.day} card ${d.index}`, repro);
      const c = current(d)!;
      let outcome: Outcome | null = null;
      if (isOracle) {
        // Spend every bit of compute on tools, use probes, then decide knowing the truth.
        for (let guard = 0; guard < 20; guard++) {
          const avail = TOOL_ACTIONS.filter((t) => canAct(run, t));
          if (!avail.length) break;
          const t = choose('tool', avail, () => rng.int(0, avail.length - 1));
          bump(stats.actions, t);
          act(run, t);
        }
        const sab = latest(c).sabotaged;
        let decision: Action = 'approve';
        if (sab) decision = run.day.audits > 0 && choose('auditOrDefer', [0, 1], () => rng.int(0, 1)) === 0 ? 'audit' : 'defer';
        bump(stats.actions, decision);
        const hb = run.harm;
        outcome = act(run, decision);
        if (run.harm > hb) {
          if (outcome?.slipped) stats.oracleSlipHarm++;
          else fail('oracle took harm from a card', `${repro()} day ${d.day} card ${c.card.id} action ${decision}`);
        }
      } else {
        for (let guard = 0; guard < 12 && !outcome; guard++) {
          const avail = ALL_ACTIONS.filter((a) => canAct(run, a));
          const a = choose('act', avail, () => rng.int(0, avail.length - 1));
          const cost = a === 'fact' || a === 'scope' || a === 'resample' || a === 'untrusted' ? toolCost(run, a) : 0;
          const computeBefore = run.day.compute;
          const hb = run.harm;
          bump(stats.actions, a);
          outcome = act(run, a);
          if (a === 'fact' || a === 'scope' || a === 'untrusted' || a === 'resample') {
            if (computeBefore - run.day.compute !== cost) fail(`tool cost mismatch (${a})`, `${repro()} day ${d.day}: spent ${computeBefore - run.day.compute}, toolCost ${cost}`);
          }
          if (run.harm < hb) fail('harm decreased during a shift', `${repro()} day ${d.day}`);
          if (run.harm > hb && !(outcome && isIncident(outcome))) fail('harm rose without an incident', `${repro()} day ${d.day} action ${a}`);
          if (run.harm > hb) incidentHarm += run.harm - hb;
          checkResources(run, `after ${a}`, repro);
        }
        if (!outcome) { const o = act(run, 'defer'); outcome = o; }
      }
      if (run.loss) break;
      advance(run);
    }
    if (run.harm - harmAtDayStart < 0) fail('harm decreased across a shift', repro());
    if (run.loss) break;

    const harmBeforeEnd = run.harm;
    const summary = endDay(run);
    if (run.harm !== harmBeforeEnd) fail('endDay changed harm', repro());
    if (isOracle && !summary.metQuota) fail('ORACLE MISSED QUOTA', `${repro()} day ${d.day}: shipped ${summary.usefulness}, quota ${summary.quota} (asked ${d.quotaAsked}), perfect ${perfectUsefulness(d.queue)}, contract ${d.contract?.id ?? '-'}`);
    if (run.loss) break;
    if (d.day >= RULES.days) { won = true; break; }

    // ----- between days -----
    const harmBetween = run.harm;
    const logFrom = run.harmLog.length;
    const ev = eventFor(run);
    if (ev) {
      const choices = eventChoices(run, ev);
      const i = choose('event', choices.map((_, j) => j), () => rng.int(0, choices.length - 1));
      bump(stats.eventChoices, `${ev.id}#${i}`);
      chooseEvent(run, ev, i);
    }
    if (breakthroughDue(run)) {
      const offer = breakthroughOffer(run);
      if (offer.length) {
        const b = choose('breakthrough', offer, () => rng.int(0, offer.length - 1));
        bump(stats.breakthroughs, b.id);
        takeBreakthrough(run, b.id);
      }
    }
    const harmDrop = run.harm - harmBetween;
    if (harmDrop !== logDelta(run, logFrom)) fail('harm change between days not matched by harmLog', `${repro()} after day ${d.day}: delta ${harmDrop}, logged ${logDelta(run, logFrom)}`);
    if (run.loss) break;
    const offer = upgradeOffer(run);
    if (offer.length) {
      const pick = choose('upgrade', [...offer.map((u) => u.id), 'skip'], () => rng.int(0, offer.length));
      bump(stats.upgrades, pick);
      if (pick === 'skip') skipUpgrade(run);
      else if (!(isOracle && pick === 'trusted-editing')) takeUpgrade(run, pick);
    }
    for (let s = 0; s < 3; s++) {
      const item = choose('shop', SHOP, () => rng.int(0, SHOP.length - 1));
      if (canBuy(run, item)) { buy(run, item); bump(stats.shop, item); }
    }
    const contracts = contractOffer(run);
    const ct = choose('contract', contracts, () => rng.int(0, contracts.length - 1));
    bump(stats.contracts, ct.id);
    chooseContract(run, ct.id);
    const harmBeforeNext = run.harm;
    nextDay(run, hints(d.day + 1));
    if (run.harm !== harmBeforeNext) fail('nextDay changed harm', repro());
    if (run.quick && !RULES.quickDays.includes(run.day.day)) fail('quick shift played a skipped day', `${repro()} day=${run.day.day}`);
    if (run.quick && run.day.covers.at(-1) !== run.day.day) fail('covered days end on the wrong day', `${repro()} covers=${run.day.covers}`);
    checkDayStart(run, seen, repro, isOracle);
  }
  return { run, log, won };
}

// ---------- Run-end checks (score, progress bookkeeping) ----------
function checkRunEnd(r: PlayResult, combo: Combo, player: string): void {
  const { run, won } = r;
  const repro = () => describe(combo, player);
  const score = runScore(run, won);
  if (!Number.isFinite(score) || score < 0) fail('score not finite or negative', `${repro()} score=${score}`);
  const grade = gradeFor(score);
  if (!['S', 'A', 'B', 'C', 'D'].includes(grade)) fail('invalid grade', `${repro()} grade=${grade}`);
  const days = [...run.history, run.day];
  const outcomes = days.flatMap((d) => d.outcomes);
  const incidents = outcomes.filter(isIncident).map((o) => o.card.sabotage!.family);
  const catches = outcomes.filter((o) => o.action === 'audit' && o.draft.sabotaged).length;
  const p = emptyProgress();
  const update = recordRun(p, {
    record: {
      seed: run.seed, date: '2026-09-25', difficulty: run.difficulty, level: run.level, lab: run.lab.id, adversary: run.adversary,
      dayReached: run.day.day, result: won ? 'win' : run.loss?.kind ?? 'harm', score, grade, daily: run.daily, quick: run.quick,
    },
    tells: [...run.codex], fundingEarned: run.fundingEarned, incidents, catches,
  });
  const sum = update.insight.reduce((s, l) => s + l.amount, 0);
  if (sum !== update.insightTotal) fail('insight lines ≠ insightTotal', `${repro()} lines=${sum} total=${update.insightTotal}`);
  if (run.quick) { if (update.insightTotal !== 0) fail('quick shift earned Insight', repro()); return; }
  const expected = new Set<Branch>(incidents.map((f) => FAMILY_BRANCH[f]));
  if (!won && run.loss?.kind === 'quota') expected.add('governance');
  if (!won && run.adversary === 'schemer') expected.add('interp');
  const got = new Set(update.urgent);
  if (expected.size !== got.size || [...expected].some((b) => !got.has(b))) fail('urgent branches ≠ incidents', `${repro()} expected ${[...expected]} got ${[...got]}`);
  if (update.insightTotal < 0) fail('negative insight', repro());
  if (won && run.quick && run.history.map((d) => d.day).concat(run.day.day).join() !== RULES.quickDays.join()) fail('quick win skipped a quick day', repro());
}

// ---------- Targeted effect checks (invariant 5) ----------
const effectRows: { id: string; observed: boolean; note: string }[] = [];
function effect(id: string, observed: boolean, note: string): void { effectRows.push({ id, observed, note }); }

/** Standard, v1, frontier lab but WITHOUT the lab's starting upgrade, so upgrade tests start clean. */
function baseRun(research: string[] = [], seed = SEEDS_BY_ADV.get('injector')![0]!): RunState {
  const r = newRun(seed, hints(1), { difficulty: 'standard', level: 1, lab: 'frontier', research });
  r.upgrades = [];
  return r;
}
/** Puts the run on `day` so tools/cards for that day are available. */
function jump(run: RunState, day: number): void { run.day = startDay(run.seed, day, modsFor(run, day), hints(day), run.used); }

function targetedChecks(): void {
  // Upgrades
  for (const u of UPGRADES) {
    const a = baseRun(), b = baseRun();
    takeUpgrade(b, u.id);
    const ma = modsFor(a, 2), mb = modsFor(b, 2);
    switch (u.id) {
      case 'audit-headcount': effect(u.id, mb.audits === ma.audits + 1, `audits ${ma.audits}→${mb.audits}`); break;
      case 'sharper-monitor': effect(u.id, mb.bandNarrow === ma.bandNarrow + 5, `bandNarrow ${ma.bandNarrow}→${mb.bandNarrow}`); break;
      case 'compute-grant': effect(u.id, mb.compute === ma.compute + 1, `compute ${ma.compute}→${mb.compute}`); break;
      case 'incident-response': effect(u.id, harmCeiling(b) === harmCeiling(a) + 2, `ceiling ${harmCeiling(a)}→${harmCeiling(b)}`); break;
      case 'paraphraser': {
        jump(a, 5); jump(b, 5);
        let aColl = 0, bColl = 0;
        for (const s of SEEDS_BY_ADV.get('colluder')!.slice(0, 40)) {
          const x = newRun(s, hints(1), { difficulty: 'standard' }); jump(x, 5); if (x.day.untrustedColludes) aColl++;
          const y = newRun(s, hints(1), { difficulty: 'standard' }); takeUpgrade(y, 'paraphraser'); jump(y, 5); if (y.day.untrustedColludes) bColl++;
        }
        effect(u.id, bColl < aColl, `untrusted colludes on Day 5: ${aColl}/40 without, ${bColl}/40 with`);
        break;
      }
      case 'untrusted-monitor': effect(u.id, !canAct(a, 'untrusted') && canAct(b, 'untrusted'), `untrusted tool usable: ${canAct(a, 'untrusted')}→${canAct(b, 'untrusted')}`); break;
      case 'catch-bonus': {
        let refunded = false;
        for (const s of SEEDS_BY_ADV.get('injector')!.slice(0, 20)) {
          const r = baseRun([], s); takeUpgrade(r, 'catch-bonus');
          const i = r.day.queue.findIndex((c) => c.card.sabotage);
          if (i < 0) continue;
          r.day.index = i; const before = r.day.audits; act(r, 'audit');
          refunded = r.day.audits === before; break;
        }
        effect(u.id, refunded, 'audit refunded on catch');
        break;
      }
      case 'escalation-hotline': {
        const r = baseRun(); takeUpgrade(r, 'escalation-hotline');
        const o1 = act(r, 'defer'); advance(r); const o2 = act(r, 'defer');
        effect(u.id, o1?.usefulness === RULES.usefulness.ship && o2?.usefulness === RULES.usefulness.defer, `defer values ${o1?.usefulness}, ${o2?.usefulness}`);
        break;
      }
      case 'trusted-editing': {
        let slips = 0, n = 0, value = 0;
        for (const s of [...SEEDS_BY_ADV.values()].flat().slice(0, 200)) {
          const r = baseRun([], s); takeUpgrade(r, 'trusted-editing');
          for (let i = 0; i < r.day.queue.length; i++) {
            r.day.index = i;
            if (!r.day.queue[i]!.card.sabotage) continue;
            const o = act(r, 'defer'); n++; value = Math.max(value, o?.usefulness ?? 0); if (o?.slipped) slips++;
          }
        }
        effect(u.id, value === RULES.trustedEditing.value && slips > 0, `defer value ${value}; slipped ${slips}/${n} sabotaged defers`);
        break;
      }
      case 'permission-limits': {
        const r = baseRun(); jump(r, 3);
        const severe = r.day.queue.map((c) => c.card).find((c) => c.layout === 'log' && c.severity === 'severe')
          ?? (() => { const all = r.day.queue.map((c) => c.card); return all.find((c) => c.layout === 'log'); })();
        if (!severe) { effect(u.id, false, 'no log card found to test'); break; }
        const card = { ...severe, severity: 'severe' as const };
        const h0 = harmFor(r, card, 3); takeUpgrade(r, 'permission-limits'); const h1 = harmFor(r, card, 3);
        effect(u.id, h1 < h0, `severe agent harm ${h0}→${h1}`);
        break;
      }
      case 'monitor-rationale': effect(u.id, false, 'UI-only (flagLine is always computed; shown only in the UI when owned)'); break;
      case 'canary': effect(u.id, false, 'UI-only (shows day.untrustedColludes in the UI); no engine effect'); break;
      default: effect(u.id, false, 'no targeted check written');
    }
  }

  // Research nodes
  const withNode = (id: string) => baseRun([id]);
  const a = baseRun();
  const mA = modsFor(a, 2);
  for (const n of TREE) {
    const b = withNode(n.id);
    const mB = modsFor(b, 2);
    switch (n.id) {
      case 'mon-prompts': effect(`node:${n.id}`, mB.bandNarrow === mA.bandNarrow + 2, `bandNarrow ${mA.bandNarrow}→${mB.bandNarrow}`); break;
      case 'mon-ensemble': effect(`node:${n.id}`, mB.bandNarrow === mA.bandNarrow + 3, `bandNarrow ${mA.bandNarrow}→${mB.bandNarrow}`); break;
      case 'gov-safety-case': effect(`node:${n.id}`, mB.quota === mA.quota - 1, `quota ${mA.quota}→${mB.quota}`); break;
      case 'gov-incident-db': case 'sec-sandbox': effect(`node:${n.id}`, harmCeiling(b) === harmCeiling(a) + 1, `ceiling ${harmCeiling(a)}→${harmCeiling(b)}`); break;
      case 'int-probe-start': effect(`node:${n.id}`, b.breakthroughs.includes('probe') && b.day.probesLeft > 0, `probe on Day 1: ${b.breakthroughs.includes('probe')}, probesLeft ${b.day.probesLeft}`); break;
      case 'int-probe2': { const r = baseRun(['int-probe2']); r.breakthroughs.push('probe'); const m = modsFor(r, 2); effect(`node:${n.id}`, m.probes === 2, `probes/day ${m.probes}`); break; }
      case 'evl-redteam': { endDay(b); nextDay(b, hints(2)); endDay(a); nextDay(a, hints(2)); effect(`node:${n.id}`, b.adversaryRevealed && !a.adversaryRevealed, `revealed on Day 2: ${b.adversaryRevealed}`); break; }
      case 'sec-least-privilege': {
        jump(a, 3); jump(b, 3);
        effect(`node:${n.id}`, b.day.computeStart === a.day.computeStart + 1, `compute ${a.day.computeStart}→${b.day.computeStart}`);
        break;
      }
      case 'sec-permissions': {
        const r0 = baseRun(); jump(r0, 3); const r1 = baseRun(['sec-permissions']); jump(r1, 3);
        const card = r0.day.queue.map((c) => c.card).find((c) => c.layout === 'log');
        if (!card) { effect(`node:${n.id}`, false, 'no log card'); break; }
        effect(`node:${n.id}`, harmFor(r1, card, 3) < harmFor(r0, card, 3), `agent harm ${harmFor(r0, card, 3)}→${harmFor(r1, card, 3)}`);
        break;
      }
      case 'ctl-resample': {
        let dropA = 0, dropB = 0, tries = 0;
        for (const s of [...SEEDS_BY_ADV.values()].flat().slice(0, 150)) {
          for (const [research, inc] of [[[], (x: number) => { dropA += x; }], [['ctl-resample'], (x: number) => { dropB += x; }]] as [string[], (x: number) => void][]) {
            const r = baseRun(research, s); jump(r, 2);
            const i = r.day.queue.findIndex((c) => c.card.sabotage && c.card.sabotage.family !== 'sandbagging');
            if (i < 0) continue;
            r.day.index = i; act(r, 'resample');
            inc(latest(r.day.queue[i]!).sabotaged ? 0 : 1);
            if (research.length) tries++;
          }
        }
        effect(`node:${n.id}`, dropB > dropA, `honest redraws ${dropA}/${tries} → ${dropB}/${tries}`);
        break;
      }
      case 'evl-sandbag': {
        let hitA = 0, hitB = 0, tries = 0;
        for (const s of [...SEEDS_BY_ADV.values()].flat().slice(0, 240)) {
          for (const research of [[], ['evl-sandbag']]) {
            const r = baseRun(research, s); jump(r, 6);
            const i = r.day.queue.findIndex((c) => c.card.sabotage && (c.card.sabotage.family === 'sandbagging' || c.card.sabotage.family === 'weakened-check'));
            if (i < 0) continue;
            r.day.index = i; act(r, 'fact');
            const hit = latest(r.day.queue[i]!).findings.fact?.problem ? 1 : 0;
            if (research.length) { hitB += hit; tries++; } else hitA += hit;
          }
        }
        effect(`node:${n.id}`, hitB > hitA, `fact hits ${hitA}/${tries} → ${hitB}/${tries} (base factHit ${factHit(baseRun())})`);
        break;
      }
      case 'gov-whistleblower': {
        const ev = EVENTS[0]!;
        effect(`node:${n.id}`, eventChoices(b, ev).length === ev.choices.length + 1, `choices ${ev.choices.length}→${eventChoices(b, ev).length}`);
        break;
      }
      case 'interpretability': {
        let offered = false, offeredWithout = false;
        for (const s of [...SEEDS_BY_ADV.values()].flat().slice(0, 60)) {
          const r = baseRun(['interpretability'], s); jump(r, 3); if (breakthroughOffer(r).some((x) => x.id === 'probe')) offered = true;
          const q = baseRun([], s); jump(q, 3); if (breakthroughOffer(q).some((x) => x.id === 'probe')) offeredWithout = true;
        }
        effect(`node:${n.id}`, offered && !offeredWithout, `probe offered with ${offered}, without ${offeredWithout}`);
        break;
      }
      case 'untrusted-monitoring': case 'paraphrasing': case 'canary': case 'monitor-rationale': case 'trusted-editing': {
        const upgradeId = Object.entries(RULES.upgradeResearch).find(([, node]) => node === n.id)?.[0];
        let seenWith = false, seenWithout = false;
        for (let i = 0; i < 300 && !(seenWith && seenWithout); i++) {
          const s = `QA-offer-${i}`;
          const r = baseRun([n.id], s); if (upgradeId === 'canary') takeUpgrade(r, 'untrusted-monitor');
          if (upgradeOffer(r).some((u) => u.id === upgradeId)) seenWith = true;
          const q = baseRun([], s); if (upgradeId === 'canary') takeUpgrade(q, 'untrusted-monitor');
          if (upgradeOffer(q).some((u) => u.id === upgradeId)) seenWithout = true;
        }
        effect(`node:${n.id}`, seenWith && !seenWithout, `${upgradeId} offered with ${seenWith}, without ${seenWithout}`);
        break;
      }
      case 'lab-government': case 'lab-nonprofit': case 'lab-bigtech':
        effect(`node:${n.id}`, false, 'gating is UI-only (setup screen); newRun accepts any lab regardless of research');
        break;
      case 'evl-forecast': effect(`node:${n.id}`, false, 'UI-only (briefing tag in main.ts); no engine effect'); break;
      default: effect(`node:${n.id}`, false, 'no targeted check written');
    }
  }

  // Breakthroughs
  for (const bt of BREAKTHROUGHS) {
    const r = baseRun();
    r.harm = 5;
    const before = { harm: r.harm, rest: r.rest.compute, rev: r.adversaryRevealed, logs: r.harmLog.length };
    takeBreakthrough(r, bt.id);
    const ok = bt.id === 'red-team' ? r.adversaryRevealed && !before.rev
      : bt.id === 'review-board' ? r.harm === 2 && r.harmLog.length === before.logs + 1
      : bt.id === 'cluster' ? r.rest.compute === before.rest + 2 && modsFor(r, 2).compute === modsFor(baseRun(), 2).compute + 2
      : bt.id === 'probe' ? r.breakthroughs.includes('probe') && modsFor(r, 2).probes === 1
      : false;
    effect(`breakthrough:${bt.id}`, ok, `harm ${before.harm}→${r.harm}, rest.compute ${before.rest}→${r.rest.compute}, revealed ${r.adversaryRevealed}`);
  }

  // Contracts
  for (const ct of CONTRACTS) {
    const r = baseRun(); const m0 = modsFor(r, 2);
    chooseContract(r, ct.id); const m1 = modsFor(r, 2);
    const quotaOk = m1.quota - m0.quota === ct.quotaDelta;
    const auditsOk = m1.audits - m0.audits === ct.audits;
    nextDay(r, hints(2));
    const log = r.day.queue.map((c) => c.card).find((c) => c.sabotage) ?? r.day.queue[0]!.card;
    const harmOk = ct.harmBonus === 0 || harmFor(r, log, 2) === harmFor({ ...r, day: { ...r.day, contract: undefined } }, log, 2) + ct.harmBonus;
    // fundingMult: ship everything, compare surplus to a run without the contract.
    effect(`contract:${ct.id}`, quotaOk && auditsOk && harmOk && r.day.contract?.id === ct.id, `quota Δ${m1.quota - m0.quota} (want ${ct.quotaDelta}), audits Δ${m1.audits - m0.audits} (want ${ct.audits}), harmBonus ok ${harmOk}`);
  }
  {
    // Funding multiplier check: identical day, contract with fundingMult 0 vs 2-ish.
    const hi = CONTRACTS.reduce((x, y) => (y.fundingMult > x.fundingMult ? y : x));
    const r0 = baseRun(); endDay(r0); nextDay(r0, hints(2));
    const r1 = baseRun(); endDay(r1); chooseContract(r1, hi.id); nextDay(r1, hints(2));
    for (const r of [r0, r1]) { for (let i = 0; i < r.day.queue.length; i++) { r.day.index = i; act(r, 'approve'); } r.day.index = r.day.queue.length; }
    const f0 = r0.funding, f1 = r1.funding; const s0 = endDay(r0), s1 = endDay(r1);
    effect(`contract:fundingMult(${hi.id})`, s1.ledger.mult === hi.fundingMult, `ledger mult ${s1.ledger.mult} (surplus ${s0.ledger.surplus} vs ${s1.ledger.surplus}; funding ${f0}/${f1})`);
  }

  // Event effect kinds
  const kinds: Effect[] = [
    { kind: 'funding', amount: 3 }, { kind: 'harm', amount: -2 }, { kind: 'ceiling', amount: 1 }, { kind: 'auditsTomorrow', amount: 1 },
    { kind: 'computeTomorrow', amount: 2 }, { kind: 'bandTomorrow', amount: -4 }, { kind: 'quotaTomorrow', amount: 2 }, { kind: 'quotaRest', amount: 1 },
    { kind: 'computeRest', amount: 1 }, { kind: 'auditsRest', amount: 1 }, { kind: 'blindTomorrow', layout: 'log' }, { kind: 'revealAdversary' },
    { kind: 'upgrade', id: 'audit-headcount' },
  ];
  for (const e of kinds) {
    const r = baseRun(); r.harm = 4; r.funding = 5;
    const m0 = modsFor(r, 2); const c0 = harmCeiling(r);
    applyEffects(r, [e], 'qa');
    const m1 = modsFor(r, 2);
    let ok = false;
    switch (e.kind) {
      case 'funding': ok = r.funding === 8; break;
      case 'harm': ok = r.harm === 2 && r.harmLog.length === 1; break;
      case 'ceiling': ok = harmCeiling(r) === c0 + 1; break;
      case 'auditsTomorrow': case 'auditsRest': ok = m1.audits === m0.audits + 1; break;
      case 'computeTomorrow': ok = m1.compute === m0.compute + 2; break;
      case 'computeRest': ok = m1.compute === m0.compute + 1; break;
      case 'bandTomorrow': ok = m1.bandNarrow === m0.bandNarrow + 4; break;
      case 'quotaTomorrow': ok = m1.quota === m0.quota + 2; break;
      case 'quotaRest': ok = m1.quota === m0.quota + 1; break;
      case 'blindTomorrow': ok = m1.blind === 'log'; break;
      case 'revealAdversary': ok = r.adversaryRevealed; break;
      case 'upgrade': ok = r.upgrades.includes('audit-headcount'); break;
    }
    effect(`effect:${e.kind}`, ok, JSON.stringify(e));
  }

  // Shop items
  for (const item of ['auditor', 'compute', 'tuneUp', 'reroll'] as ShopItem[]) {
    const r = baseRun(); r.funding = 50;
    const m0 = modsFor(r, 2); const offer0 = upgradeOffer(r).map((u) => u.id).join(',');
    buy(r, item);
    const m1 = modsFor(r, 2); const offer1 = upgradeOffer(r).map((u) => u.id).join(',');
    const ok = item === 'auditor' ? m1.audits === m0.audits + RULES.shop.auditor.amount
      : item === 'compute' ? m1.compute === m0.compute + RULES.shop.compute.amount
      : item === 'tuneUp' ? m1.bandNarrow === m0.bandNarrow + RULES.shop.tuneUp.amount
      : r.rerolls === 1;
    effect(`shop:${item}`, ok, item === 'reroll' ? `offer ${offer0} → ${offer1}${offer0 === offer1 ? ' (unchanged!)' : ''}` : `funding ${50}→${r.funding}`);
  }
}

// ---------- Determinism ----------
function determinismCheck(): void {
  for (let i = 0; i < 40; i++) {
    const combo = combos[(i * 997) % combos.length]!;
    const first = play(combo, 'random', null, `det-${i}`);
    const again = play(combo, 'random', null, `det-${i}`, first.log);
    const sig = (r: RunState) => JSON.stringify({
      harm: r.harm, funding: r.funding, earned: r.fundingEarned, day: r.day.day, loss: r.loss?.kind,
      days: [...r.history, r.day].map((d) => [d.usefulness, d.quota, d.queue.map((c) => c.card.id).join('|'), d.outcomes.map((o) => o.action).join('')]),
    });
    if (sig(first.run) !== sig(again.run)) fail('non-deterministic replay', `${describe(combo, 'random')} rng=det-${i}`);
  }
}

// ---------- Main ----------
function main(): void {
  console.log(`QA fuzzer · ${combos.length} matrix combos · cap ${LIMIT} runs${QUICK ? ' (quick)' : ''}`);
  const allUpgrades = UPGRADES.map((u) => u.id);
  const order = new Rng('qa:order').shuffle(combos.map((_, i) => i));
  let runs = 0;
  for (const idx of order) {
    if (runs >= LIMIT) break;
    const combo = combos[idx]!;
    for (const player of ['random', 'oracle'] as const) {
      const force = player === 'random' ? allUpgrades[runs % allUpgrades.length]! : null;
      const rngSeed = `qa-${idx}-${player}`;
      try {
        const r = play(combo, player, force === 'trusted-editing' && player === 'oracle' ? null : force, rngSeed);
        checkRunEnd(r, combo, player);
        if (player === 'oracle') { stats.oracleRuns++; if (r.won) stats.oracleWins++; if (r.run.loss) fail(`ORACLE LOST (${r.run.loss.kind})`, `${describe(combo, player)} rng=${rngSeed} day ${r.run.day.day} harm ${r.run.harm}/${harmCeiling(r.run)}`); }
      } catch (e) {
        stats.exceptions++;
        fail(`exception: ${(e as Error).message.slice(0, 80)}`, `${describe(combo, player)} force=${force} rng=${rngSeed}\n      ${(e as Error).stack?.split('\n').slice(1, 4).join('\n      ')}`);
      }
      runs++;
    }
    stats.runs = runs;
    if (runs % 5000 === 0) console.log(`  … ${runs} runs, ${V.size} violation kinds, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`  played ${runs} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  determinismCheck();
  targetedChecks();

  // ---------- Report ----------
  console.log('\n=== Violations ===');
  if (!V.size) console.log('  none');
  for (const [k, v] of [...V.entries()].sort((x, y) => y[1].count - x[1].count)) console.log(`  ${String(v.count).padStart(6)}  ${k}\n          repro: ${v.repro}`);

  console.log('\n=== Coverage & stats ===');
  console.log(`  runs ${stats.runs} · days ${stats.days} · exceptions ${stats.exceptions}`);
  console.log(`  oracle: ${stats.oracleWins}/${stats.oracleRuns} won · trusted-editing slip harm events ${stats.oracleSlipHarm}`);
  console.log(`  relaxed generation fallback: ${stats.relaxedDays}/${stats.days} days (${(100 * stats.relaxedDays / Math.max(1, stats.days)).toFixed(2)}%)`);
  console.log(`    of which on quota-capped days: ${stats.relaxedCapped} · first card sabotaged: ${stats.relaxedFirst} · no sabotage reads >50 (days 1–6): ${stats.relaxedFair}`);
  console.log(`  cross-day scenario repeats (pool fallback): ${stats.crossDayRepeats} cards on ${stats.repeatDays} days (${stats.repeatsCapped} of those days quota-capped)`);
  console.log(`  quota-capped days: ${stats.cappedDays}`);
  console.log(`  quota cap triggered ${stats.capTriggers}/${stats.days} days (${(100 * stats.capTriggers / Math.max(1, stats.days)).toFixed(1)}%) · max asked ${stats.maxAsked} · max cut ${stats.maxAskedOver} · min slack (perfect − quota) ${stats.minSlack}`);
  const cov = (name: string, m: Map<string, number>, universe?: string[]) => {
    const missing = universe ? universe.filter((u) => !m.has(u)) : [];
    console.log(`  ${name}: ${m.size} distinct${missing.length ? ` · NEVER EXERCISED: ${missing.join(', ')}` : ''}`);
  };
  cov('actions', stats.actions, ALL_ACTIONS);
  const allEventChoices = EVENTS.flatMap((e) => [...e.choices.map((_, i) => `${e.id}#${i}`), `${e.id}#${e.choices.length}`]);
  cov('event choices (incl. whistleblower)', stats.eventChoices, allEventChoices);
  cov('breakthroughs', stats.breakthroughs, BREAKTHROUGHS.map((b) => b.id));
  cov('contracts', stats.contracts, CONTRACTS.map((c) => c.id));
  cov('upgrades (incl. skip)', stats.upgrades, [...UPGRADES.map((u) => u.id), 'skip']);
  cov('shop items', stats.shop, SHOP);

  console.log('\n=== Effects: does each upgrade / node / breakthrough / contract / effect / shop item do something? ===');
  for (const r of effectRows) console.log(`  ${r.observed ? 'ok  ' : 'NONE'}  ${r.id.padEnd(34)} ${r.note}`);
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
