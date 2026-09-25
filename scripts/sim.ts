// Headless balance simulator: plays many seeds through the real engine with simple bot policies.
// Usage: npm run sim -- [--seeds 2000] [--days 2]
import { dayInfo } from '../src/data/days';
import {
  act, advance, canAct, current, dayOver, endDay, latest, newRun, nextDay, quotaFor, startDay,
  type Action, type RunState,
} from '../src/game/state';
import { Rng } from '../src/rng';
import { RULES } from '../src/rules';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const SEEDS = arg('seeds', 2000);
const DAYS = arg('days', RULES.lastPlayableDay);
const hints = (day: number) => dayInfo(day).hints;

/** A policy picks an action for the current card. `mem` is per-card scratch space, reset each card. */
type Policy = (run: RunState, rng: Rng, mem: Record<string, unknown>) => Action;

const auditOrDefer = (run: RunState): Action => (canAct(run, 'audit') ? 'audit' : 'defer');
const score = (run: RunState) => latest(current(run.day)!).reading.score;
const threshold = (t: number): Policy => (run) => (score(run) >= t ? auditOrDefer(run) : 'approve');

const reader = (p: number): Policy => (run, rng, mem) => {
  if (mem.recognized === undefined) mem.recognized = rng.chance(p);
  const c = current(run.day)!;
  if (mem.recognized) return latest(c).sabotaged ? auditOrDefer(run) : 'approve';
  const s = score(run);
  if (!mem.resampled && s >= 40 && s <= 60 && canAct(run, 'resample')) {
    mem.resampled = true;
    return 'resample';
  }
  return s >= 50 ? auditOrDefer(run) : 'approve';
};

const POLICIES: Record<string, Policy> = {
  'approve-all': () => 'approve',
  'defer-all': () => 'defer',
  'audit-then-approve': (run) => (canAct(run, 'audit') ? 'audit' : 'approve'),
  'threshold-40': threshold(40),
  'threshold-50': threshold(50),
  'threshold-60': threshold(60),
  'reader-0.5': reader(0.5),
  'reader-0.7': reader(0.7),
  'reader-0.9': reader(0.9),
  'quota-then-approve': (run, rng, mem) =>
    run.day.usefulness >= quotaFor(run.day.day) ? 'approve' : threshold(50)(run, rng, mem),
};

interface Stats {
  survived: number[]; // runs that finished day d (index d-1) without a loss
  lossHarm: number;
  lossQuota: number;
  genFail: number;
  harmEnd: number;
  quotaMisses: number;
  margin: number[]; // summed usefulness - quota per day
  marginN: number[];
  sab: number;
  caught: number;
  deferredSab: number;
  clean: number;
  falseAlarms: number;
}

function play(name: string, policy: Policy): Stats {
  const st: Stats = {
    survived: Array(DAYS).fill(0), lossHarm: 0, lossQuota: 0, genFail: 0, harmEnd: 0, quotaMisses: 0,
    margin: Array(DAYS).fill(0), marginN: Array(DAYS).fill(0), sab: 0, caught: 0, deferredSab: 0, clean: 0, falseAlarms: 0,
  };
  for (let i = 0; i < SEEDS; i++) {
    const seed = `sim-${i}`;
    const rng = new Rng(`bot:${name}:${seed}`);
    let run: RunState;
    try { run = newRun(seed, hints(1)); } catch { st.genFail++; continue; }
    for (let day = 1; day <= DAYS; day++) {
      while (!dayOver(run.day) && !run.loss) {
        const mem: Record<string, unknown> = {};
        for (;;) {
          let action = policy(run, rng, mem);
          if (!canAct(run, action)) action = action === 'audit' ? 'defer' : 'approve';
          const o = act(run, action);
          if (!o) continue; // resample: decide again on the new draft
          if (o.draft.sabotaged) {
            st.sab++;
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
      const s = endDay(run);
      st.margin[day - 1] += s.usefulness - s.quota;
      st.marginN[day - 1]++;
      if (run.loss) break;
      st.survived[day - 1]++;
      if (day < DAYS) {
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

function report(): void {
  const t0 = Date.now();
  console.log(`\nOversight Shift balance sim · ${SEEDS} seeds · Days 1–${DAYS} · cards ${RULES.cardsPerDay.slice(0, DAYS).join('/')} · quota ${RULES.quotaPerDay.slice(0, DAYS).join('/')} · harm ceiling ${RULES.harmCeiling}\n`);
  const dayCols = Array.from({ length: DAYS }, (_, i) => pad(`D${i + 1}`, 5)).join('');
  const marginCols = Array.from({ length: DAYS }, (_, i) => pad(`m${i + 1}`, 6)).join('');
  console.log(`${'policy'.padEnd(20)}${dayCols}  ${pad('harmL', 6)}${pad('quotaL', 7)}${pad('harm', 6)}${pad('miss', 6)}${marginCols}${pad('catch', 7)}${pad('handled', 8)}${pad('falseA', 7)}${pad('gen!', 5)}`);
  for (const [name, policy] of Object.entries(POLICIES)) {
    const s = play(name, policy);
    const surv = s.survived.map((n) => pad(pct(n, SEEDS), 5)).join('');
    const margins = s.margin.map((m, i) => pad(s.marginN[i] ? (m / s.marginN[i]!).toFixed(1) : '—', 6)).join('');
    console.log(
      `${name.padEnd(20)}${surv}  ${pad(pct(s.lossHarm, SEEDS), 6)}${pad(pct(s.lossQuota, SEEDS), 7)}${pad((s.harmEnd / SEEDS).toFixed(1), 6)}${pad((s.quotaMisses / SEEDS).toFixed(2), 6)}${margins}${pad(pct(s.caught, s.sab), 7)}${pad(pct(s.caught + s.deferredSab, s.sab), 8)}${pad(pct(s.falseAlarms, s.clean), 7)}${pad(s.genFail, 5)}`,
    );
  }
  console.log('\nD# = survived to end of day · harmL/quotaL = run lost to harm / quota · harm = mean harm at end · miss = mean quota misses');
  console.log('m# = mean usefulness minus quota that day (runs that reached day end) · catch = sabotage audited · handled = audited or deferred · falseA = clean work audited or deferred · gen! = day generation failures');

  // Calibration: first-draft readings of every card dealt, independent of policy.
  const buckets = [0, 20, 40, 60, 80, 101];
  const tot = Array(5).fill(0);
  const bad = Array(5).fill(0);
  let calFail = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = `sim-${i}`;
    const used = new Set<string>();
    for (let day = 1; day <= DAYS; day++) {
      try {
        const d = startDay(seed, day, { audits: RULES.auditsPerDay, compute: RULES.computePerDay, bandNarrow: 0 }, {}, used);
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
  console.log('\nMonitor calibration (first-draft readings, all cards dealt)');
  console.log(['0–20', '20–40', '40–60', '60–80', '80–100'].map((l, j) => `${l}: ${pct(bad[j], tot[j])} sabotaged (n=${tot[j]})`).join(' · ') + (calFail ? ` · gen failures ${calFail}` : ''));
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

report();
