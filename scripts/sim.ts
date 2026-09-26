// Headless balance simulator: plays many seeds through the real engine with simple bot policies.
// Usage: npm run sim -- [--seeds 2000] [--days 7] [--difficulty standard | --all-difficulties]
//   [--level 1..5] [--lab frontier|nonprofit|bigtech|government] [--research none|all]
//   [--events random|cautious|greedy] [--only a,b] [--families] [--no-cal] [--no-shop]
//   [--set computePerDay=5 --set difficulty.standard.factHit=0.8 ...]
//   Campaigns (research tree): [--campaign 15] [--campaigns 400] [--buy urgent-first|priority|none] [--ladder] [--marginal]
import { dayInfo } from '../src/data/days';
import { CONTRACTS, LABS, MODEL_VERSIONS } from '../src/data/meta';
import { INSIGHT, TREE } from '../src/data/research-tree';
import { buyNode, emptyProgress, nodeCost, nodeState, recordRun, type Progress } from '../src/game/progress';
import { EVENTS } from '../src/data/events';
import {
  BASE_MODS, act, advance, breakthroughDue, breakthroughOffer, buy, canAct, canBuy, chooseContract, chooseEvent, contractOffer, current,
  dayOver, endDay, eventChoices, eventFor, has, isIncident, latest, newRun, nextDay, runScore, startDay, takeBreakthrough, takeUpgrade, toolCost, upgradeOffer,
  type Action, type RunState,
} from '../src/game/state';
import { Rng } from '../src/rng';
import { RULES } from '../src/rules';
import type { AdversaryId, Contract, Difficulty, EventChoice } from '../src/types';

const argv = process.argv.slice(2);
const arg = (name: string, fallback: number): number => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
};
const argStr = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const SEEDS = arg('seeds', 2000);
const DAYS = arg('days', RULES.lastPlayableDay);
const LEVEL = arg('level', 1);
const LAB = argStr('lab') ?? 'frontier';
const EXCEPT = argStr('research-except')?.split(',') ?? [];
const RESEARCH_LIST = argStr('research-list')?.split(',');
const RESEARCH_IDS = RESEARCH_LIST ?? (argStr('research') === 'all' || EXCEPT.length ? TREE.map((r) => r.id).filter((id) => !EXCEPT.includes(id)) : []);
/** --quick: play Quick shift (Days 1, 3, 5, 7). */
const QUICK = argv.includes('--quick');
const EVENTS_POLICY = (argStr('events') ?? 'random') as 'random' | 'cautious' | 'greedy';
const hints = (day: number) => dayInfo(day).hints;

// ---------- Rule overrides (for tuning without editing src/) ----------
function setPath(root: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let obj = root as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
  obj[keys[keys.length - 1]!] = value;
}
function applyOverrides(): string[] {
  const applied: string[] = [];
  argv.forEach((a, i) => {
    if (a !== '--set') return;
    const raw = argv[i + 1]!;
    const eq = raw.indexOf('=');
    const path = raw.slice(0, eq);
    const value = JSON.parse(raw.slice(eq + 1));
    // `models.N.field=…` edits MODEL_VERSIONS; `contracts.id.field=…` edits CONTRACTS; everything else edits RULES.
    if (path.startsWith('models.')) {
      const [, lvl, field] = path.split('.');
      setPath(MODEL_VERSIONS.find((m) => m.level === Number(lvl)), field!, value);
    } else if (path.startsWith('labs.')) {
      const [, id, field] = path.split('.');
      setPath(LABS.find((l) => l.id === id), field!, value);
    } else if (path.startsWith('events.')) {
      // events.<id>.choices.<i>.effects.<j>.amount=…
      const [, id, ...rest] = path.split('.');
      setPath(EVENTS.find((e) => e.id === id), rest.join('.'), value);
    } else if (path === 'noEvents') {
      EVENTS.splice(0, EVENTS.length);
    } else if (path.startsWith('insight.')) {
      setPath(INSIGHT, path.slice('insight.'.length), value);
    } else if (path.startsWith('tree.')) {
      const [, id, field] = path.split('.');
      setPath(TREE.find((n) => n.id === id), field!, value);
    } else if (path === 'treeCostMult') {
      for (const n of TREE) n.cost = Math.round(n.cost * Number(value));
    } else if (path.startsWith('contracts.')) {
      const [, id, field] = path.split('.');
      setPath(CONTRACTS.find((c) => c.id === id), field!, value);
    } else setPath(RULES, path, value);
    applied.push(`${path}=${raw.slice(eq + 1)}`);
  });
  // BASE_MODS snapshots RULES at import time; keep it in sync with overrides.
  BASE_MODS.audits = RULES.auditsPerDay;
  BASE_MODS.compute = RULES.computePerDay;
  BASE_MODS.quota = RULES.quotaPerDay[0]!;
  return applied;
}
const OVERRIDES = applyOverrides();

/** A policy picks an action for the current card. `mem` is per-card scratch space, reset each card. */
type Policy = (run: RunState, rng: Rng, mem: Record<string, unknown>) => Action;

const auditOrDefer = (run: RunState): Action => (canAct(run, 'audit') ? 'audit' : 'defer');
const draft = (run: RunState) => latest(current(run.day)!);
const score = (run: RunState) => draft(run).reading.score;
const threshold = (t: number): Policy => (run) => (score(run) >= t ? auditOrDefer(run) : 'approve');
const anyProblem = (run: RunState) => Object.values(draft(run).findings).some((f) => f?.problem);

const reader = (p: number): Policy => (run, rng, mem) => {
  if (mem.recognized === undefined) mem.recognized = rng.chance(p);
  if (mem.recognized) return draft(run).sabotaged ? auditOrDefer(run) : 'approve';
  const s = score(run);
  if (!mem.resampled && s >= 40 && s <= 60 && canAct(run, 'resample')) {
    mem.resampled = true;
    return 'resample';
  }
  return s >= 50 ? auditOrDefer(run) : 'approve';
};

const toolsGreedy: Policy = (run) => {
  const f = draft(run).findings;
  if (!f.fact && canAct(run, 'fact')) return 'fact';
  if (!f.scope && canAct(run, 'scope')) return 'scope';
  return anyProblem(run) ? auditOrDefer(run) : 'approve';
};

let TRIAGE = false;
const toolsSmartBase: Policy = (run) => {
  const d = run.day;
  const c = current(d)!;
  const dr = latest(c);
  const { score: s, band } = dr.reading;
  // Triage: the monitor is cheap, checks are not. With compute to spare, check almost everything; when
  // it runs short, spend it only on doubtful cards. A player who read the Day 7 briefing doesn't trust a
  // low score on cards marked unmonitored.
  const ratio = d.compute / Math.max(1, d.queue.length - d.index);
  const bar = !TRIAGE ? 0 : ratio >= 1.5 ? 0 : ratio >= 1 ? 25 : ratio >= 0.6 ? 35 : 45;
  if ((s + band < 40 || s < bar) && !c.card.unmonitored) return 'approve';
  if (anyProblem(run)) return s >= 50 && canAct(run, 'audit') ? 'audit' : 'defer';
  // The probe is free and exact; spend it on the most doubtful card it meets.
  if (!dr.findings.probe && canAct(run, 'probe') && (s >= 45 || c.card.unmonitored)) return 'probe';
  const cardsLeft = d.queue.length - d.index;
  const reserve = cardsLeft > d.compute ? 1 : 0;
  const spendable = d.compute - 1 >= reserve;
  const hasAllow = c.card.spec.allowed.length > 0;
  const factFirst = c.card.layout === 'answer' || c.card.layout === 'thread' || !hasAllow;
  if (spendable && hasAllow && !dr.findings.scope && canAct(run, 'scope')) return 'scope';
  if (spendable && factFirst && !dr.findings.fact && canAct(run, 'fact')) return 'fact';
  // Scope came back clean on an allowlisted card: fact-check it too if it's not obviously clean.
  if (spendable && s >= 35 && !dr.findings.fact && canAct(run, 'fact')) return 'fact';
  if (s >= 60) return auditOrDefer(run);
  return 'approve';
};

const toolsSmart: Policy = (run, rng, mem) => { TRIAGE = false; return toolsSmartBase(run, rng, mem); };
const toolsTriage: Policy = (run, rng, mem) => { TRIAGE = true; return toolsSmartBase(run, rng, mem); };

const toolsTrusting: Policy = (run) => {
  const c = current(run.day)!;
  const f = draft(run).findings;
  const tool = c.card.spec.allowed.length ? 'scope' : 'fact';
  if (!f[tool] && canAct(run, tool)) return tool;
  return anyProblem(run) ? auditOrDefer(run) : 'approve';
};

const novice: Policy = (run, rng, mem) => {
  if (mem.sloppy === undefined) mem.sloppy = rng.chance(0.3);
  return mem.sloppy ? threshold(50)(run, rng, mem) : toolsSmart(run, rng, mem);
};

/** Ian's "check everything" strategy: fact-check every card, scope-check when it's free, treat any red
 *  (a tool finding or a Suspicious monitor verdict) as sabotage — audit it once Catch bonus refunds
 *  the hour, otherwise defer — and approve everything green. Never reads the card. */
const checker: Policy = (run) => {
  const dr = draft(run);
  const f = dr.findings;
  if (!f.fact && canAct(run, 'fact')) return 'fact';
  if (!f.scope && canAct(run, 'scope') && toolCost(run, 'scope') === 0) return 'scope';
  const { score: s, band } = dr.reading;
  const red = anyProblem(run) || s - band > 50;
  if (red) return has(run, 'catch-bonus') && canAct(run, 'audit') ? 'audit' : 'defer';
  return 'approve';
};

const ALL_POLICIES: Record<string, Policy> = {
  'approve-all': () => 'approve',
  'defer-all': () => 'defer',
  'threshold-50': threshold(50),
  'quota-then-approve': (run, rng, mem) => (run.day.usefulness >= run.day.quota ? 'approve' : threshold(50)(run, rng, mem)),
  'reader-0.5': reader(0.5),
  'reader-0.9': reader(0.9),
  'tools-greedy': toolsGreedy,
  'tools-trusting': toolsTrusting,
  'tools-smart': toolsSmart,
  'tools-triage': toolsTriage,
  novice,
  checker,
  'checker-nobuy': checker,
};
/** Per-bot budget-meeting behavior. Default: UPGRADE_PREF, then buy compute, then auditors. */
const BOT_UPGRADE_PREF: Record<string, string[]> = {
  checker: ['compute-grant', 'catch-bonus', 'audit-headcount', 'incident-response', 'sharper-monitor', 'permission-limits', 'escalation-hotline'],
  'checker-nobuy': ['compute-grant', 'catch-bonus', 'audit-headcount', 'incident-response', 'sharper-monitor', 'permission-limits', 'escalation-hotline'],
};
const NO_COMPUTE_BUY = new Set(['checker-nobuy']);
const ONLY = argStr('only')?.split(',');
const POLICIES = Object.fromEntries(Object.entries(ALL_POLICIES).filter(([n]) => !ONLY || ONLY.includes(n)));

// ---------- Between days ----------
/** Cautious players avoid quota hikes and blind spots and value harm relief; greedy players chase funding. */
function eventValue(c: EventChoice, policy: 'cautious' | 'greedy'): number {
  let v = 0;
  for (const e of c.effects) {
    const amt = 'amount' in e ? e.amount : 0;
    if (policy === 'greedy') {
      if (e.kind === 'funding') v += amt;
      else if (e.kind === 'upgrade') v += 3;
      else v += 0.01 * amt; // tie-break only
      continue;
    }
    switch (e.kind) {
      case 'quotaTomorrow': v -= 3 * amt; break;
      case 'quotaRest': v -= 8 * amt; break;
      case 'blindTomorrow': v -= 6; break;
      case 'harm': v -= 4 * amt; break;
      case 'ceiling': v += 4 * amt; break;
      case 'auditsTomorrow': v += 3 * amt; break;
      case 'auditsRest': v += 10 * amt; break;
      case 'computeTomorrow': v += amt; break;
      case 'computeRest': v += 4 * amt; break;
      case 'bandTomorrow': v -= 0.4 * amt; break;
      case 'funding': v += 0.3 * amt; break;
      case 'revealAdversary': v += 1; break;
      case 'upgrade': v += 5; break;
    }
  }
  return v;
}

function pickContract(offer: Contract[], rng: Rng): Contract {
  if (EVENTS_POLICY === 'random') return rng.pick(offer);
  const sorted = [...offer].sort((a, b) =>
    EVENTS_POLICY === 'cautious' ? a.quotaDelta - b.quotaDelta || b.audits - a.audits : b.fundingMult - a.fundingMult || a.quotaDelta - b.quotaDelta);
  return sorted[0]!;
}

// Every bot plays the budget meeting the same simple way (shopping off with --no-shop):
// take the most useful offered upgrade, then spend funding on compute, then auditors.
const UPGRADE_PREF = ['compute-grant', 'incident-response', 'audit-headcount', 'catch-bonus', 'sharper-monitor', 'permission-limits', 'escalation-hotline', 'monitor-rationale', 'paraphraser', 'trusted-editing'];
const SHOP = !argv.includes('--no-shop');

function betweenDays(run: RunState, rng: Rng, name = ''): void {
  const ev = eventFor(run);
  if (ev) {
    const choices = eventChoices(run, ev);
    const i = EVENTS_POLICY === 'random'
      ? rng.int(0, choices.length - 1)
      : choices.map((c, j) => [eventValue(c, EVENTS_POLICY), j] as const).sort((a, b) => b[0] - a[0])[0]![1];
    chooseEvent(run, ev, i);
    if (run.loss) return;
  }
  if (breakthroughDue(run)) {
    const offer = breakthroughOffer(run);
    if (offer[0]) takeBreakthrough(run, offer[0].id);
  }
  const contract = pickContract(contractOffer(run), rng);
  if (SHOP) {
    const offer = upgradeOffer(run);
    const pick = (BOT_UPGRADE_PREF[name] ?? UPGRADE_PREF).map((id) => offer.find((u) => u.id === id)).find(Boolean) ?? offer[0];
    if (pick) takeUpgrade(run, pick.id);
    for (let guard = 0; guard < 6; guard++) {
      if (!NO_COMPUTE_BUY.has(name) && canBuy(run, 'compute')) buy(run, 'compute');
      else if (canBuy(run, 'auditor')) buy(run, 'auditor');
      else break;
    }
  }
  chooseContract(run, contract.id);
}

// ---------- Play ----------
interface Stats {
  survived: number[];
  wins: number;
  lossHarm: number;
  lossQuota: number;
  genFail: number;
  harmEnd: number;
  sab: number;
  caught: number;
  deferredSab: number;
  clean: number;
  falseAlarms: number;
  scores: number[];
  advRuns: Record<string, number>;
  advWins: Record<string, number>;
  famSeen: Record<string, number>;
  famMissed: Record<string, number>;
  fundingEarned: number;
}

const emptyStats = (): Stats => ({
  survived: Array(DAYS).fill(0), wins: 0, lossHarm: 0, lossQuota: 0, genFail: 0, harmEnd: 0,
  sab: 0, caught: 0, deferredSab: 0, clean: 0, falseAlarms: 0, scores: [], advRuns: {}, advWins: {}, famSeen: {}, famMissed: {}, fundingEarned: 0,
});

interface RunResult { run: RunState; won: boolean }

/** Plays one full run and folds it into `st`. Returns null if day 1 failed to generate. */
// --emulate-proposal: model the recommended node effects without touching src/:
// Incident database and Sandboxing each become +1 harm ceiling; Permission tiers' severe cap is dropped.
const EMULATE = argv.includes('--emulate-proposal');
const LP_EMULATE = argv.includes('--lp-emulate');
const EMULATED = ['gov-incident-db', 'sec-sandbox', 'sec-permissions'];

function playRun(seed: string, name: string, policy: Policy, difficulty: Difficulty, level: number, research: string[], st: Stats): RunResult | null {
  if (!EMULATE) return playRunInner(seed, name, policy, difficulty, level, research, st);
  const base = RULES.harmCeiling;
  RULES.harmCeiling = base + (research.includes('gov-incident-db') ? 1 : 0) + (research.includes('sec-sandbox') ? 1 : 0);
  try {
    return playRunInner(seed, name, policy, difficulty, level, research.filter((id) => !EMULATED.includes(id)), st);
  } finally {
    RULES.harmCeiling = base;
  }
}

function playRunInner(seed: string, name: string, policy: Policy, difficulty: Difficulty, level: number, research: string[], st: Stats): RunResult | null {
  const rng = new Rng(`bot:${name}:${seed}`);
  let run: RunState;
  try { run = newRun(seed, hints(1), { difficulty, level, lab: LAB, research, quick: QUICK }); } catch { st.genFail++; return null; }
  // --lp-emulate: model a weaker Least privilege (+1 compute every day instead of free scope on agent cards).
  if (LP_EMULATE && run.research.includes('sec-least-privilege')) {
    run.research = run.research.filter((id) => id !== 'sec-least-privilege');
    run.rest.compute += 1;
    run.day.compute += 1;
    run.day.computeStart += 1;
  }
  let won = false;
  for (;;) {
    const day = run.day.day;
    while (!dayOver(run.day) && !run.loss) {
      const mem: Record<string, unknown> = {};
      for (let guard = 0; guard < 20; guard++) {
        let action = policy(run, rng, mem);
        if (!canAct(run, action)) action = action === 'audit' ? 'defer' : 'approve';
        const o = act(run, action);
        if (!o) continue; // a tool ran or a resample; decide again
        if (o.draft.sabotaged) {
          st.sab++;
          const fam = o.card.sabotage!.family;
          st.famSeen[fam] = (st.famSeen[fam] ?? 0) + 1;
          if (o.action === 'approve' || o.slipped) st.famMissed[fam] = (st.famMissed[fam] ?? 0) + 1;
          if (o.action === 'audit') st.caught++;
          if (o.action === 'defer' && !o.slipped) st.deferredSab++;
        } else {
          st.clean++;
          if (o.action !== 'approve') st.falseAlarms++;
        }
        break;
      }
      if (run.loss) break;
      advance(run);
    }
    if (run.loss) break;
    endDay(run);
    if (run.loss) break;
    st.survived[day - 1]++;
    if (day === DAYS) { won = true; break; }
    betweenDays(run, rng, name);
    if (run.loss) break;
    try { nextDay(run, hints(day + 1)); if (run.day.day > DAYS) { won = true; break; } } catch { st.genFail++; break; }
  }
  if (won) st.wins++;
  if (run.loss?.kind === 'harm') st.lossHarm++;
  if (run.loss?.kind === 'quota') st.lossQuota++;
  st.harmEnd += run.harm;
  st.fundingEarned += run.fundingEarned;
  st.scores.push(runScore(run, won));
  st.advRuns[run.adversary] = (st.advRuns[run.adversary] ?? 0) + 1;
  if (won) st.advWins[run.adversary] = (st.advWins[run.adversary] ?? 0) + 1;
  return { run, won };
}

function play(name: string, policy: Policy, difficulty: Difficulty, research: string[] = RESEARCH_IDS, seeds = SEEDS, level = LEVEL): Stats {
  const st = emptyStats();
  for (let i = 0; i < seeds; i++) playRun(`sim-${i}`, name, policy, difficulty, level, research, st);
  return st;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const pad = (s: string | number, w: number) => String(s).padStart(w);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : 0;
};
const ADVS: AdversaryId[] = ['sandbagger', 'colluder', 'injector', 'schemer'];

function table(difficulty: Difficulty): void {
  console.log(`\n=== ${difficulty} · v${LEVEL} · lab ${LAB} · research ${RESEARCH_IDS.length ? 'all' : 'none'} · events ${EVENTS_POLICY} · ${SEEDS} seeds · Days 1–${DAYS}`);
  const dayCols = Array.from({ length: DAYS }, (_, i) => pad(`D${i + 1}`, 5)).join('');
  console.log(`${'policy'.padEnd(19)}${dayCols}  ${pad('harmL', 6)}${pad('quotaL', 7)}${pad('harm', 6)}${pad('catch', 7)}${pad('handl', 7)}${pad('falseA', 7)}${pad('earned', 7)}  score p25/p50/p75/p90   win by adversary (sb/co/in/sc)`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    const s = play(name, policy, difficulty);
    const surv = s.survived.map((n) => pad(pct(n, SEEDS), 5)).join('');
    const q = [0.25, 0.5, 0.75, 0.9].map((x) => quantile(s.scores, x)).join('/');
    const adv = ADVS.map((a) => pct(s.advWins[a] ?? 0, s.advRuns[a] ?? 0)).join('/');
    console.log(
      `${name.padEnd(19)}${surv}  ${pad(pct(s.lossHarm, SEEDS), 6)}${pad(pct(s.lossQuota, SEEDS), 7)}${pad((s.harmEnd / SEEDS).toFixed(1), 6)}${pad(pct(s.caught, s.sab), 7)}${pad(pct(s.caught + s.deferredSab, s.sab), 7)}${pad(pct(s.falseAlarms, s.clean), 7)}${pad((s.fundingEarned / SEEDS).toFixed(0), 7)}  ${q.padEnd(22)}${adv}${s.genFail ? `  gen!${s.genFail}` : ''}`,
    );
    if (argv.includes('--families')) {
      console.log(`${''.padEnd(19)}missed by family: ${Object.entries(s.famSeen).map(([f, n]) => `${f} ${pct(s.famMissed[f] ?? 0, n)} of ${n}`).join(' · ')}`);
    }
  }
}

function calibration(): void {
  const buckets = [0, 20, 40, 60, 80, 101];
  const tot = Array(5).fill(0);
  const bad = Array(5).fill(0);
  let calFail = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = `sim-${i}`;
    const used = new Set<string>();
    for (let day = 1; day <= DAYS; day++) {
      try {
        const d = startDay(seed, day, { ...BASE_MODS, quota: RULES.quotaPerDay[day - 1]! }, {}, used);
        for (const c of d.queue) {
          used.add(c.card.id);
          const r = c.drafts[0]!.reading.score;
          const b = buckets.findIndex((lo, j) => r >= lo && r < buckets[j + 1]!);
          tot[b]++;
          if (c.drafts[0]!.sabotaged) bad[b]++;
        }
      } catch { calFail++; }
    }
  }
  console.log('\nMonitor calibration (standard band, first-draft readings)');
  console.log(['0–20', '20–40', '40–60', '60–80', '80–100'].map((l, j) => `${l}: ${pct(bad[j], tot[j])} (n=${tot[j]})`).join(' · ') + (calFail ? ` · gen failures ${calFail}` : ''));
}

// ---------- Campaigns: one player, many runs, carrying the research tree ----------
const BUY = (argStr('buy') ?? 'urgent-first') as 'urgent-first' | 'priority' | 'none';
const PRIORITY = ['gov-incident-db', 'ctl-resample', 'mon-prompts', 'sec-least-privilege', 'evl-sandbag', 'sec-permissions', 'gov-safety-case',
  'trusted-editing', 'monitor-rationale', 'evl-redteam', 'interpretability', 'sec-sandbox', 'mon-ensemble', 'int-probe2', 'evl-forecast',
  'untrusted-monitoring', 'paraphrasing', 'canary', 'int-probe-start', 'gov-whistleblower', 'lab-nonprofit', 'lab-government', 'lab-bigtech'];

function spend(p: Progress): void {
  if (BUY === 'none') return;
  for (let guard = 0; guard < 40; guard++) {
    const avail = TREE.filter((n) => nodeState(p, n) === 'available');
    if (!avail.length) return;
    let pick;
    if (BUY === 'priority') pick = PRIORITY.map((id) => avail.find((n) => n.id === id)).find(Boolean) ?? avail[0];
    else {
      const byCost = (a: typeof avail[number], b: typeof avail[number]) => nodeCost(p, a) - nodeCost(p, b);
      const urgent = avail.filter((n) => p.urgent.includes(n.branch)).sort(byCost);
      pick = urgent[0] ?? [...avail].sort(byCost)[0];
    }
    if (!pick || !buyNode(p, pick.id)) return;
  }
}

interface CampRow { wins: number; insight: number; nodes: number; level: number; n: number; fullTree: number }

function campaign(name: string, policy: Policy, difficulty: Difficulty, runs: number, campaigns: number, ladder: boolean): CampRow[] {
  const rows: CampRow[] = Array.from({ length: runs }, () => ({ wins: 0, insight: 0, nodes: 0, level: 0, n: 0, fullTree: 0 }));
  const ownedAt = new Map<string, number>(); // node → campaigns owning it before run 8
  const byOutcome = new Map<string, { n: number; insight: number }>();
  for (let c = 0; c < campaigns; c++) {
    const p = emptyProgress();
    let level = 1;
    for (let r = 0; r < runs; r++) {
      if (r === 7) for (const id of p.research) ownedAt.set(id, (ownedAt.get(id) ?? 0) + 1);
      const st = emptyStats();
      const res = playRun(`camp-${name}-${c}-${r}`, name, policy, difficulty, level, [...p.research], st);
      const row = rows[r]!;
      row.n++;
      row.level += level;
      if (!res) continue;
      const { run, won } = res;
      const outs = [...run.history, run.day].flatMap((d) => d.outcomes);
      const upd = recordRun(p, {
        record: { seed: run.seed, date: '', difficulty, level, lab: LAB, adversary: run.adversary, dayReached: run.day.day, result: won ? 'win' : run.loss?.kind ?? 'harm', score: 0, grade: 'D', daily: false },
        tells: [...run.codex],
        fundingEarned: run.fundingEarned,
        incidents: outs.filter(isIncident).map((o) => o.card.sabotage!.family),
        catches: outs.filter((o) => o.action === 'audit' && o.draft.sabotaged).length,
      });
      spend(p);
      const key = won ? 'win' : `lost D${run.day.day}`;
      const b = byOutcome.get(key) ?? { n: 0, insight: 0 };
      b.n++; b.insight += upd.insightTotal; byOutcome.set(key, b);
      if (won) row.wins++;
      row.insight += upd.insightTotal;
      row.nodes += p.research.length;
      if (p.research.length === TREE.length) row.fullTree++;
      if (ladder && won) level = Math.min(level + 1, p.maxModel, 5);
    }
  }
  console.log(`  insight by outcome (${name}): ` + [...byOutcome.entries()].sort().map(([k, v]) => `${k} ${(v.insight / v.n).toFixed(1)} (n=${v.n})`).join(' · '));
  if (argv.includes('--owned')) {
    console.log(`  nodes owned before run 8 (${name}): ` + [...ownedAt.entries()].sort((a, b) => b[1] - a[1]).map(([id, k]) => `${id} ${Math.round((k / campaigns) * 100)}%`).join(' · '));
  }
  return rows;
}

function campaignTable(difficulty: Difficulty): void {
  const runs = arg('campaign', 15);
  const campaigns = arg('campaigns', 400);
  const ladder = argv.includes('--ladder');
  console.log(`\n=== campaign · ${difficulty} · ${campaigns} campaigns × ${runs} runs · buy ${BUY}${ladder ? ' · ladder' : ' · fixed v' + LEVEL} · events ${EVENTS_POLICY}`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    const rows = campaign(name, policy, difficulty, runs, campaigns, ladder);
    console.log(`${name}`);
    console.log(`  run    ${rows.map((_, i) => pad(i + 1, 5)).join('')}`);
    console.log(`  win%   ${rows.map((r) => pad(Math.round((r.wins / r.n) * 100), 5)).join('')}`);
    console.log(`  insight${rows.map((r) => pad((r.insight / r.n).toFixed(1), 5)).join('')}`);
    console.log(`  nodes  ${rows.map((r) => pad((r.nodes / r.n).toFixed(1), 5)).join('')}   (of ${TREE.length})`);
    if (ladder) console.log(`  level  ${rows.map((r) => pad((r.level / r.n).toFixed(1), 5)).join('')}`);
    console.log(`  full%  ${rows.map((r) => pad(Math.round((r.fullTree / r.n) * 100), 5)).join('')}`);
  }
}

/** Win rate with vs without each node, holding a mid-campaign research set fixed. */
function marginal(difficulty: Difficulty): void {
  const base = (argStr('base') ?? 'gov-incident-db,ctl-resample,mon-prompts,sec-least-privilege,evl-sandbag,trusted-editing,sec-permissions').split(',');
  const seeds = arg('seeds', 2000);
  console.log(`\n=== marginal node effects · ${difficulty} · v${LEVEL} · base {${base.join(', ')}} · ${seeds} seeds`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    const baseWin = play(name, policy, difficulty, base, seeds).wins / seeds;
    const cells = TREE.filter((n) => !n.id.startsWith('lab-')).map((n) => {
      const withSet = base.includes(n.id) ? base : [...base, n.id];
      const without = base.filter((x) => x !== n.id);
      const w = play(name, policy, difficulty, withSet, seeds).wins / seeds;
      const wo = play(name, policy, difficulty, without, seeds).wins / seeds;
      return [n.id, Math.round((w - wo) * 100)] as const;
    }).sort((a, b) => b[1] - a[1]);
    console.log(`${name} (base ${Math.round(baseWin * 100)}%): ` + cells.map(([id, d]) => `${id} ${d >= 0 ? '+' : ''}${d}`).join(' · '));
  }
}

const t0 = Date.now();
if (OVERRIDES.length) console.log(`overrides: ${OVERRIDES.join(' ')}`);
const diffs: Difficulty[] = argv.includes('--all-difficulties') ? ['guided', 'standard', 'analyst'] : [(argStr('difficulty') as Difficulty) ?? 'standard'];
if (argv.includes('--campaign')) for (const d of diffs) campaignTable(d);
else if (argv.includes('--marginal')) for (const d of diffs) marginal(d);
else for (const d of diffs) table(d);
console.log('\nD# = alive at end of day · catch = sabotage audited · handl = audited or deferred · falseA = clean work audited/deferred · earned = mean funding raised');
if (argv.includes('--cal')) calibration();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
