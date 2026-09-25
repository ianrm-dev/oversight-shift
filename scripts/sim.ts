// Headless balance simulator: plays many seeds through the real engine with simple bot policies.
// Usage: npm run sim -- [--seeds 2000] [--days 7] [--difficulty standard | --all-difficulties]
//                       [--set computePerDay=5 --set difficulty.standard.factHit=0.8 ...] [--only a,b]
import { dayInfo } from '../src/data/days';
import {
  BASE_MODS, act, advance, buy, canAct, canBuy, current, dayOver, endDay, latest, newRun, nextDay, prepareCard, quotaFor, startDay,
  takeUpgrade, upgradeOffer,
  type Action, type RunState,
} from '../src/game/state';
import { Rng } from '../src/rng';
import { RULES } from '../src/rules';
import type { Difficulty } from '../src/types';

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
const hints = (day: number) => dayInfo(day).hints;

// ---------- Rule overrides (for tuning without editing src/) ----------
function applyOverrides(): string[] {
  const applied: string[] = [];
  argv.forEach((a, i) => {
    if (a !== '--set') return;
    const [path, raw] = argv[i + 1]!.split('=') as [string, string];
    const keys = path.split('.');
    let obj = RULES as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) obj = obj[k] as Record<string, unknown>;
    obj[keys[keys.length - 1]!] = JSON.parse(raw);
    applied.push(`${path}=${raw}`);
  });
  // BASE_MODS snapshots RULES at import time; keep it in sync with overrides.
  BASE_MODS.audits = RULES.auditsPerDay;
  BASE_MODS.compute = RULES.computePerDay;
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

const toolsSmart: Policy = (run) => {
  const d = run.day;
  const c = current(d)!;
  const dr = latest(c);
  const { score: s, band } = dr.reading;
  // A player who read the Day 7 briefing doesn't trust a low score on cards marked unmonitored.
  if (s + band < 40 && !c.card.unmonitored) return 'approve';
  if (anyProblem(run)) return s >= 50 && canAct(run, 'audit') ? 'audit' : 'defer';
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

const ALL_POLICIES: Record<string, Policy> = {
  'approve-all': () => 'approve',
  'defer-all': () => 'defer',
  'threshold-50': threshold(50),
  'quota-then-approve': (run, rng, mem) =>
    run.day.usefulness >= quotaFor(run.day.day) ? 'approve' : threshold(50)(run, rng, mem),
  'reader-0.5': reader(0.5),
  'reader-0.9': reader(0.9),
  'tools-greedy': toolsGreedy,
  'tools-trusting': toolsTrusting,
  'tools-smart': toolsSmart,
  novice,
};
const ONLY = argStr('only')?.split(',');
const POLICIES = Object.fromEntries(Object.entries(ALL_POLICIES).filter(([n]) => !ONLY || ONLY.includes(n)));

// Between days, every bot plays the budget meeting the same simple way (off with --no-shop):
// take the most useful offered upgrade, then spend funding on compute, then auditors.
const UPGRADE_PREF = ['auto-scope', 'compute-grant', 'incident-response', 'audit-headcount', 'catch-bonus', 'sharper-monitor', 'permission-limits', 'escalation-hotline', 'monitor-rationale', 'paraphraser'];
const SHOP = !argv.includes('--no-shop');
function budgetMeeting(run: RunState): void {
  if (!SHOP) return;
  const offer = upgradeOffer(run);
  const pick = UPGRADE_PREF.map((id) => offer.find((u) => u.id === id)).find(Boolean) ?? offer[0];
  if (pick) takeUpgrade(run, pick.id);
  for (let guard = 0; guard < 6; guard++) {
    if (canBuy(run, 'compute')) buy(run, 'compute');
    else if (canBuy(run, 'auditor')) buy(run, 'auditor');
    else break;
  }
}

interface Stats {
  survived: number[];
  lossHarm: number;
  lossQuota: number;
  genFail: number;
  harmEnd: number;
  quotaMisses: number;
  sab: number;
  caught: number;
  deferredSab: number;
  clean: number;
  falseAlarms: number;
  spareCompute: number;
  spareAudits: number;
  dayEnds: number;
  funding: number[];
  fundingN: number[];
  toolRuns: number;
  famSeen: Record<string, number>;
  famMissed: Record<string, number>;
}

function play(name: string, policy: Policy, difficulty: Difficulty): Stats {
  const st: Stats = {
    survived: Array(DAYS).fill(0), lossHarm: 0, lossQuota: 0, genFail: 0, harmEnd: 0, quotaMisses: 0,
    sab: 0, caught: 0, deferredSab: 0, clean: 0, falseAlarms: 0, spareCompute: 0, spareAudits: 0, dayEnds: 0,
    funding: Array(DAYS).fill(0), fundingN: Array(DAYS).fill(0), toolRuns: 0, famSeen: {}, famMissed: {},
  };
  for (let i = 0; i < SEEDS; i++) {
    const seed = `sim-${i}`;
    const rng = new Rng(`bot:${name}:${seed}`);
    let run: RunState;
    try { run = newRun(seed, hints(1), difficulty); } catch { st.genFail++; continue; }
    for (let day = 1; day <= DAYS; day++) {
      while (!dayOver(run.day) && !run.loss) {
        prepareCard(run);
        const mem: Record<string, unknown> = {};
        for (let guard = 0; guard < 20; guard++) {
          let action = policy(run, rng, mem);
          if (!canAct(run, action)) action = action === 'audit' ? 'defer' : 'approve';
          const o = act(run, action);
          if (!o) { st.toolRuns++; continue; } // a tool ran or a resample; decide again
          if (o.draft.sabotaged) {
            st.sab++;
            const fam = o.card.sabotage!.family;
            st.famSeen[fam] = (st.famSeen[fam] ?? 0) + 1;
            if (o.action === 'approve') st.famMissed[fam] = (st.famMissed[fam] ?? 0) + 1;
            if (o.action === 'audit') st.caught++;
            if (o.action === 'defer') st.deferredSab++;
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
      st.spareCompute += run.day.compute;
      st.spareAudits += run.day.audits;
      st.dayEnds++;
      endDay(run);
      if (run.loss) break;
      st.survived[day - 1]++;
      st.funding[day - 1] += run.funding;
      st.fundingN[day - 1]++;
      if (day < DAYS) {
        budgetMeeting(run);
        try { nextDay(run, hints(day + 1)); } catch { st.genFail++; break; }
      }
    }
    if (run.loss?.kind === 'harm') st.lossHarm++;
    if (run.loss?.kind === 'quota') st.lossQuota++;
    st.harmEnd += run.harm;
    st.quotaMisses += run.quotaMisses;
  }
  return st;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const pad = (s: string | number, w: number) => String(s).padStart(w);

function table(difficulty: Difficulty): void {
  const D = RULES.difficulty[difficulty];
  console.log(`\n=== ${difficulty} · ${SEEDS} seeds · Days 1–${DAYS} · compute ${RULES.computePerDay}+${D.extraCompute} · audits ${RULES.auditsPerDay}+${D.extraAudits} · fact ${D.factHit}/${D.factFalse} · quota ${RULES.quotaPerDay.slice(0, DAYS).join('/')} · ceiling ${RULES.harmCeiling}`);
  const dayCols = Array.from({ length: DAYS }, (_, i) => pad(`D${i + 1}`, 5)).join('');
  console.log(`${'policy'.padEnd(19)}${dayCols}  ${pad('harmL', 6)}${pad('quotaL', 7)}${pad('harm', 6)}${pad('catch', 7)}${pad('handl', 7)}${pad('falseA', 7)}${pad('tools/c', 8)}${pad('spareC', 7)}${pad('spareA', 7)}${pad('fund', 6)}${pad('gen!', 5)}`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    const s = play(name, policy, difficulty);
    const surv = s.survived.map((n) => pad(pct(n, SEEDS), 5)).join('');
    const cards = s.sab + s.clean;
    const lastFund = s.fundingN[DAYS - 1] ? (s.funding[DAYS - 1]! / s.fundingN[DAYS - 1]!).toFixed(0) : '—';
    console.log(
      `${name.padEnd(19)}${surv}  ${pad(pct(s.lossHarm, SEEDS), 6)}${pad(pct(s.lossQuota, SEEDS), 7)}${pad((s.harmEnd / SEEDS).toFixed(1), 6)}${pad(pct(s.caught, s.sab), 7)}${pad(pct(s.caught + s.deferredSab, s.sab), 7)}${pad(pct(s.falseAlarms, s.clean), 7)}${pad((s.toolRuns / Math.max(1, cards)).toFixed(2), 8)}${pad((s.spareCompute / Math.max(1, s.dayEnds)).toFixed(1), 7)}${pad((s.spareAudits / Math.max(1, s.dayEnds)).toFixed(1), 7)}${pad(lastFund, 6)}${pad(s.genFail, 5)}`,
    );
    if (argv.includes('--families')) {
      console.log(`${''.padEnd(19)}missed by family: ${Object.entries(s.famSeen).map(([f, n]) => `${f} ${pct(s.famMissed[f] ?? 0, n)} of ${n}`).join(' · ')}`);
    }
    if (name === 'tools-smart') {
      const f = s.funding.map((v, i) => (s.fundingN[i] ? (v / s.fundingN[i]!).toFixed(0) : '—')).join(' / ');
      console.log(`${''.padEnd(19)}funding at end of each day (survivors): ${f}`);
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
        const d = startDay(seed, day, { ...BASE_MODS }, {}, used);
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

const t0 = Date.now();
if (OVERRIDES.length) console.log(`overrides: ${OVERRIDES.join(' ')}`);
const diffs: Difficulty[] = argv.includes('--all-difficulties') ? ['guided', 'standard', 'analyst'] : [(argStr('difficulty') as Difficulty) ?? 'standard'];
for (const d of diffs) table(d);
console.log('\nD# = alive at end of day · catch = sabotage audited · handl = audited or deferred · falseA = clean work audited/deferred');
console.log('tools/c = tool runs per card · spareC/spareA = compute/auditors left at day end · fund = mean funding at end of Day ' + DAYS + ' (winners)');
if (!argv.includes('--no-cal')) calibration();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
