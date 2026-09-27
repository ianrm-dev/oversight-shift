// Human-time model on top of the real engine: how long a run takes, and how the shift clock, compute and
// auditors shape play for a first-timer and a practiced player who read cards and use tools sparingly.
// Usage: npx tsx scripts/clock-sim.ts [--seeds 1000] [--difficulty standard|--all] [--quick] [--research all]
//        [--set path=json ...] [--persona ft|pr|both] [--modes human,human-naive,tools-smart,checker]
import { dayInfo, DAYS as DAY_INFO } from '../src/data/days';
import { EVENTS } from '../src/data/events';
import { MODEL_VERSIONS } from '../src/data/meta';
import {
  BASE_MODS, act, advance, breakthroughDue, breakthroughOffer, buy, canAct, canBuy, chooseContract, chooseEvent, contractOffer, current,
  dayOver, endDay, eventChoices, eventFor, has, isIncident, latest, newRun, nextDay, shipUnreviewed, takeBreakthrough, takeUpgrade, toolCost, upgradeOffer,
  type Action, type RunState,
} from '../src/game/state';
import { TREE } from '../src/data/research-tree';
import { Rng } from '../src/rng';
import { RULES } from '../src/rules';
import type { Card, Difficulty } from '../src/types';

const argv = process.argv.slice(2);
const arg = (n: string, f: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? Number(argv[i + 1]) : f; };
const argStr = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const SEEDS = arg('seeds', 1000);
function setPath(root: any, path: string, value: unknown) { const k = path.split('.'); let o = root; for (const x of k.slice(0, -1)) o = o[x]; o[k[k.length - 1]!] = value; }
const OVR: string[] = [];
argv.forEach((a, i) => { if (a === '--set') { const raw = argv[i + 1]!; const eq = raw.indexOf('='); setPath(RULES, raw.slice(0, eq), JSON.parse(raw.slice(eq + 1))); OVR.push(raw); } });
BASE_MODS.audits = RULES.auditsPerDay; BASE_MODS.compute = RULES.computePerDay; BASE_MODS.quota = RULES.quotaPerDay[0]!;
void MODEL_VERSIONS; void EVENTS;

// ---------- Persona time model (seconds) ----------
interface Persona {
  name: string; wps: number; glance: number; decide: number; anim: number; skim: number;
  tool: Record<string, number>; recognize: number; falseRead: number;
  incident: number; audit: number; timeout: number;
  review: number; event: number; breakthrough: number; budget: number; intro: number; briefingWps: number; briefingBase: number; reveal: number;
  preRun: number; coach: number; /** first-run tours on the other screens */ tours: number;
}
const FT: Persona = {
  name: 'first-timer', wps: 3.0, glance: 6, decide: 3, anim: 0.4, skim: 0.35,
  tool: { fact: 8, scope: 6, resample: 14, untrusted: 5, probe: 5 }, recognize: 0.45, falseRead: 0.12,
  incident: 20, audit: 12, timeout: 15,
  review: 25, event: 30, breakthrough: 20, budget: 45, intro: 12, briefingWps: 3.5, briefingBase: 5, reveal: 12,
  preRun: 30, coach: 45, tours: 100,
};
const PR: Persona = {
  name: 'practiced', wps: 4.0, glance: 4, decide: 1.5, anim: 0.4, skim: 0.15,
  tool: { fact: 5, scope: 4, resample: 10, untrusted: 3, probe: 3 }, recognize: 0.7, falseRead: 0.05,
  incident: 10, audit: 6, timeout: 8,
  review: 10, event: 15, breakthrough: 10, budget: 20, intro: 5, briefingWps: 6, briefingBase: 3, reveal: 6,
  preRun: 15, coach: 0, tours: 0,
};

const words = (s?: string) => (s ? s.trim().split(/\s+/).length : 0);
const cardWords = (c: Card) => words(c.title) + words(c.domain) + words(c.spec.goal) + c.spec.allowed.reduce((a, s) => a + words(s), 0)
  + c.spec.facts.reduce((a, s) => a + words(s), 0) + words(c.request) + words(c.access) + words(c.summary)
  + c.output.reduce((a, l) => a + words(l.text) + words(l.file) + words(l.speaker), 0);
const briefWords = (day: number) => { const d = DAY_INFO[day - 1]!; return d.rule.reduce((a, s) => a + words(s), 0) + words(d.record); };

// ---------- Policies (decision logic from scripts/sim.ts) ----------
const auditOrDefer = (run: RunState): Action => (canAct(run, 'audit') ? 'audit' : 'defer');
const draft = (run: RunState) => latest(current(run.day)!);
const anyProblem = (run: RunState) => Object.values(draft(run).findings).some((f) => f?.problem);
const toolsSmart = (run: RunState): Action => {
  const d = run.day; const c = current(d)!; const dr = latest(c);
  const { score: s, band } = dr.reading;
  if (s + band < 40 && !c.card.unmonitored) return 'approve';
  if (anyProblem(run)) return s >= 50 && canAct(run, 'audit') ? 'audit' : 'defer';
  if (!dr.findings.probe && canAct(run, 'probe') && (s >= 45 || c.card.unmonitored)) return 'probe';
  const cardsLeft = d.queue.length - d.index;
  const reserve = cardsLeft > d.compute ? 1 : 0;
  const spendable = d.compute - 1 >= reserve;
  const hasAllow = c.card.spec.allowed.length > 0;
  const factFirst = c.card.layout === 'answer' || c.card.layout === 'thread' || !hasAllow;
  if (spendable && hasAllow && !dr.findings.scope && canAct(run, 'scope')) return 'scope';
  if (spendable && factFirst && !dr.findings.fact && canAct(run, 'fact')) return 'fact';
  if (spendable && s >= 35 && !dr.findings.fact && canAct(run, 'fact')) return 'fact';
  if (s >= 60) return auditOrDefer(run);
  return 'approve';
};
/** Ian's exploit: verify with a tool or an auditor, approve only what came back clean, defer the rest. Never reads. */
const exploit = (run: RunState): Action => {
  const c = current(run.day)!;
  const f = draft(run).findings;
  if (anyProblem(run)) return 'defer';
  if (Object.keys(f).length) return 'approve';
  const tool = c.card.spec.allowed.length ? 'scope' : 'fact';
  if (canAct(run, tool)) return tool;
  if (canAct(run, 'fact')) return 'fact';
  if (canAct(run, 'audit')) return 'audit';
  return 'defer';
};
const checker = (run: RunState): Action => {
  const dr = draft(run); const f = dr.findings;
  if (!f.fact && canAct(run, 'fact')) return 'fact';
  if (!f.scope && canAct(run, 'scope') && toolCost(run, 'scope') === 0) return 'scope';
  const { score: s, band } = dr.reading;
  const red = anyProblem(run) || s - band > 50;
  if (red) return has(run, 'catch-bonus') && canAct(run, 'audit') ? 'audit' : 'defer';
  return 'approve';
};

type Mode = 'human' | 'human-naive' | 'tools-smart' | 'checker' | 'exploit' | 'hybrid';
const UPGRADE_PREF = ['compute-grant', 'incident-response', 'audit-headcount', 'catch-bonus', 'sharper-monitor', 'permission-limits', 'escalation-hotline'];

interface Acc {
  runs: number; wins: number; lossHarm: number; lossQuota: number; lossDay: number[];
  clockOut: number[]; dayPlayed: number[]; unrev: number[]; unrevSab: number[]; quotaMiss: number[]; slackEnd: number[];
  realTimes: number[]; winTimes: number[]; firstSab: number[]; firstLoud: number[]; firstUpgrade: number[]; day3: number[]; decisions: number[];
  cardSec: number[]; betweenSec: number[]; overlaySec: number[]; preSec: number[];
  dayTime: number[][]; fatalBig: number; fatalUnrev: number; doubt: number; readShare: number; hurried: number; incidents: number[];
}
const newAcc = (): Acc => ({ runs: 0, wins: 0, lossHarm: 0, lossQuota: 0, lossDay: Array(8).fill(0), clockOut: Array(8).fill(0), dayPlayed: Array(8).fill(0), unrev: Array(8).fill(0), unrevSab: Array(8).fill(0), quotaMiss: Array(8).fill(0), slackEnd: Array(8).fill(0),
  realTimes: [], winTimes: [], firstSab: [], firstLoud: [], firstUpgrade: [], day3: [], decisions: [], cardSec: [], betweenSec: [], overlaySec: [], preSec: [], dayTime: Array.from({ length: 8 }, () => []), fatalBig: 0, fatalUnrev: 0, doubt: 0, readShare: 0, hurried: 0, incidents: [] });

function playOne(seed: string, diff: Difficulty, mode: Mode, P: Persona, acc: Acc): void {
  const rng = new Rng(`clock:${mode}:${P.name}:${seed}`);
  let run: RunState;
  const QUICK = argv.includes('--quick');
  const research = argStr('research') === 'all' ? TREE.map((n) => n.id) : [];
  try { run = newRun(seed, dayInfo(1).hints, { difficulty: diff, level: 1, lab: 'frontier', research, quick: QUICK }); } catch { return; }
  acc.runs++;
  let t = P.preRun + P.coach + P.tours; // title + setup (+ tours on a first run)
  acc.preSec.push(t);
  let cardT = 0, betweenT = 0, overlayT = 0;
  let firstSab = -1, firstLoud = -1, firstUpgrade = -1, day3 = -1, decisions = 0;
  const terse = RULES.difficulty[diff].terse;
  let won = false;
  const DAYLIST = QUICK ? [...RULES.quickDays] : [1, 2, 3, 4, 5, 6, 7];
  for (const day of DAYLIST) {
    if (day === 3) day3 = t;
    const b = P.briefingBase + briefWords(day) / P.briefingWps + (day === 3 || day === 7 ? P.intro : 0);
    t += b; betweenT += b;
    const d = run.day;
    const dayStart = t;
    acc.dayPlayed[day]++;
    let clockedOut = false;
    while (!dayOver(d) && !run.loss) {
      const c = current(d)!;
      const dr0 = latest(c);
      const s = dr0.reading.score, band = dr0.reading.band;
      const doubtful = s + band >= 40 || !!c.card.unmonitored;
      const w = cardWords(c.card);
      // Time on this card before the decision: glance, reading, tools.
      let spend = P.glance;
      const left = d.queue.length - d.index;
      const clock = d.attention > 0 && d.index >= d.untimed;
      const reserve = (left - 1) * (P.glance + P.decide + 2); // what a player keeps back for the rest of the queue
      let read = 0;
      if (mode === 'human' || mode === 'human-naive' || mode === 'hybrid') {
        const full = w / P.wps;
        const want = full;
        const afford = clock && (mode === 'human' || mode === 'hybrid') ? Math.max(0, d.attentionLeft - reserve - P.glance - P.decide - 6) : Infinity;
        read = Math.min(want, afford);
      } else {
        // Bots with a human's hands: they glance, skim, and read only what their tools flag.
        read = (w / P.wps) * P.skim;
      }
      spend += read;
      const readFrac = Math.min(1, read / (w / P.wps));
      const isHuman = mode === 'human' || mode === 'human-naive' || mode === 'hybrid';
      if (isHuman) { acc.doubt++; acc.readShare += readFrac; if (readFrac < 0.95) acc.hurried++; }
      // Reading a sabotaged card: spot the tell with p = recognize x share read. Reading a clean card: a
      // false suspicion with p = falseRead x share read (the player then defers it).
      const recognized = isHuman && (dr0.sabotaged ? rng.chance(P.recognize * readFrac) : false);
      const falseSusp = isHuman && !dr0.sabotaged && rng.chance(P.falseRead * readFrac);
      void doubtful;
      let outcome = null;
      let timedOut = false;
      for (let guard = 0; guard < 20; guard++) {
        let a: Action;
        if (mode === 'checker') a = checker(run);
        else if (mode === 'exploit') a = exploit(run);
        // Reads first; acts on what it's sure of; verifies or defers the rest.
        else if (mode === 'hybrid') a = recognized ? (draft(run).sabotaged ? auditOrDefer(run) : 'approve') : falseSusp ? 'defer' : readFrac >= 0.95 && s < 50 && !c.card.unmonitored ? 'approve' : exploit(run);
        else if (recognized) a = draft(run).sabotaged ? auditOrDefer(run) : 'approve';
        else if (falseSusp) a = s >= 50 && canAct(run, 'audit') ? 'audit' : 'defer';
        else a = toolsSmart(run);
        // Watching the clock: skip a tool that would eat into the time kept back for the rest of the queue.
        const isT = a === 'fact' || a === 'scope' || a === 'resample' || a === 'untrusted' || a === 'probe';
        if (mode === 'human' && clock && isT && spend + P.tool[a]! + P.decide + P.anim > d.attentionLeft - reserve) a = s >= 55 ? auditOrDefer(run) : 'approve';
        if (!canAct(run, a)) a = a === 'audit' ? 'defer' : 'approve';
        const isTool = a === 'fact' || a === 'scope' || a === 'resample' || a === 'untrusted' || a === 'probe';
        let cost = isTool ? P.tool[a]! : P.decide + P.anim;
        spend += cost;
        if (clock && spend >= d.attentionLeft) { timedOut = true; break; }
        const f0 = Object.keys(latest(c).findings).length;
        const o = act(run, a);
        if (!o) {
          // Analyst: a terse "Problem found." means reading the whole card to find it.
          const fnew = latest(c).findings;
          const prob = Object.values(fnew).some((f) => f?.problem) && Object.keys(fnew).length > f0;
          if (terse && prob && read < w / P.wps) { spend += w / P.wps - read; read = w / P.wps; }
          continue;
        }
        outcome = o;
        break;
      }
      if (timedOut || (clock && spend >= d.attentionLeft)) {
        const used = d.attentionLeft;
        t += used; cardT += used;
        const shipped = shipUnreviewed(run);
        acc.unrev[day] += shipped.length;
        acc.unrevSab[day] += shipped.filter((o) => o.draft.sabotaged).length;
        for (const o of shipped) if (o.draft.sabotaged && firstSab < 0) { firstSab = t; if (firstLoud < 0) firstLoud = t; }
        t += P.timeout; overlayT += P.timeout;
        clockedOut = true;
        break;
      }
      t += spend; cardT += spend;
      if (clock) d.attentionLeft -= spend;
      decisions++;
      if (outcome) {
        if (outcome.draft.sabotaged && firstSab < 0) firstSab = t;
        const loud = isIncident(outcome) || outcome.action === 'audit';
        if (loud && outcome.draft.sabotaged && firstLoud < 0) firstLoud = t;
        if (isIncident(outcome)) { t += P.incident; overlayT += P.incident; }
        else if (outcome.action === 'audit') { t += P.audit; overlayT += P.audit; }
      }
      if (run.loss) break;
      advance(run);
    }
    if (clockedOut) acc.clockOut[day]++;
    if (d.attention) acc.slackEnd[day] += Math.max(0, d.attentionLeft) / d.attention;
    acc.dayTime[day]!.push(t - dayStart);
    if (run.loss) break;
    const sum = endDay(run);
    if (!sum.metQuota) acc.quotaMiss[day]++;
    if (run.loss) break;
    t += P.review; betweenT += P.review;
    if (day === RULES.days) { won = true; break; }
    // Between days: event, breakthrough, budget meeting (same simple choices as sim.ts).
    const ev = eventFor(run);
    if (ev) { chooseEvent(run, ev, rng.int(0, eventChoices(run, ev).length - 1)); t += P.event; betweenT += P.event; if (run.loss) break; }
    if (breakthroughDue(run)) { const off = breakthroughOffer(run); if (off[0]) takeBreakthrough(run, off[0].id); t += P.breakthrough; betweenT += P.breakthrough; }
    const contract = rng.pick(contractOffer(run));
    const offer = upgradeOffer(run);
    const pick = UPGRADE_PREF.map((id) => offer.find((u) => u.id === id)).find(Boolean) ?? offer[0];
    t += P.budget; betweenT += P.budget;
    if (pick) { takeUpgrade(run, pick.id); if (firstUpgrade < 0) firstUpgrade = t; }
    for (let g = 0; g < 6; g++) { if (canBuy(run, 'compute')) buy(run, 'compute'); else if (canBuy(run, 'auditor')) buy(run, 'auditor'); else break; }
    chooseContract(run, contract.id);
    try { nextDay(run, dayInfo(DAYLIST[DAYLIST.indexOf(day) + 1]!).hints); } catch { break; }
  }
  if (won) { acc.wins++; acc.winTimes.push(t); }
  if (run.loss?.kind === 'harm') acc.lossHarm++;
  if (run.loss?.kind === 'quota') acc.lossQuota++;
  if (run.loss) acc.lossDay[run.loss.day]++;
  if (run.loss?.fatal && run.loss.fatal.harm >= 6) acc.fatalBig++;
  if (run.loss?.fatal?.unreviewed) acc.fatalUnrev++;
  acc.incidents.push([...run.history, run.day].flatMap((x) => x.outcomes).filter((o) => isIncident(o)).length);
  acc.realTimes.push(t);
  if (firstSab >= 0) acc.firstSab.push(firstSab);
  if (firstLoud >= 0) acc.firstLoud.push(firstLoud);
  if (firstUpgrade >= 0) acc.firstUpgrade.push(firstUpgrade);
  if (day3 >= 0) acc.day3.push(day3);
  acc.decisions.push(decisions);
  acc.cardSec.push(cardT); acc.betweenSec.push(betweenT); acc.overlaySec.push(overlayT);
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : NaN; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const mm = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—');

const diffs: Difficulty[] = argv.includes('--all') ? ['guided', 'standard', 'analyst'] : [(argStr('difficulty') as Difficulty) ?? 'standard'];
const personas = argStr('persona') === 'ft' ? [FT] : argStr('persona') === 'pr' ? [PR] : [FT, PR];
const modes = (argStr('modes')?.split(',') ?? ['human', 'human-naive', 'tools-smart', 'checker']) as Mode[];
if (OVR.length) console.log('overrides:', OVR.join(' '));
for (const diff of diffs) for (const P of personas) for (const mode of modes) {
  const acc = newAcc();
  for (let i = 0; i < SEEDS; i++) playOne(`sim-${i}`, diff, mode, P, acc);
  const days = [1, 2, 3, 4, 5, 6, 7];
  console.log(`\n### ${diff} · ${P.name} · ${mode} · ${acc.runs} runs  win ${pct(acc.wins, acc.runs)} (harm ${pct(acc.lossHarm, acc.runs)}, quota ${pct(acc.lossQuota, acc.runs)})`);
  console.log(`  fatal card did >=6 harm in ${pct(acc.fatalBig, acc.lossHarm)} of harm losses · fatal card shipped unreviewed ${pct(acc.fatalUnrev, acc.lossHarm)} · incidents/run ${mean(acc.incidents).toFixed(1)}`);
  if (acc.doubt) console.log(`  doubtful cards: mean share read ${(100 * acc.readShare / acc.doubt).toFixed(0)}% · read less than fully ${pct(acc.hurried, acc.doubt)}`);
  console.log(`  loss day      ${days.map((d) => pct(acc.lossDay[d]!, acc.runs).padStart(5)).join('')}`);
  console.log(`  clock-out/day ${days.map((d) => pct(acc.clockOut[d]!, acc.dayPlayed[d]!).padStart(5)).join('')}`);
  console.log(`  unrev/day     ${days.map((d) => (acc.unrev[d]! / Math.max(1, acc.dayPlayed[d]!)).toFixed(2).padStart(5)).join('')}   (sab ${days.map((d) => (acc.unrevSab[d]! / Math.max(1, acc.dayPlayed[d]!)).toFixed(2)).join(' ')})`);
  console.log(`  clock left    ${days.map((d) => pct(acc.slackEnd[d]!, acc.dayPlayed[d]!).padStart(5)).join('')}   (mean share of the day's clock unused)`);
  console.log(`  quota miss    ${days.map((d) => pct(acc.quotaMiss[d]!, acc.dayPlayed[d]!).padStart(5)).join('')}`);
  console.log(`  day real sec  ${days.map((d) => String(Math.round(q(acc.dayTime[d]!, 0.5))).padStart(5)).join('')}   (median, shift only)`);
  console.log(`  run length p25/p50/p75 ${mm(q(acc.realTimes, .25))}/${mm(q(acc.realTimes, .5))}/${mm(q(acc.realTimes, .75))} · winners ${mm(q(acc.winTimes, .5))} · decisions ${mean(acc.decisions).toFixed(0)}`);
  console.log(`  time split (mean): pre ${mm(mean(acc.preSec))} · cards ${mm(mean(acc.cardSec))} · reports ${mm(mean(acc.overlaySec))} · between ${mm(mean(acc.betweenSec))}`);
  console.log(`  pacing (median): first sabotage resolved ${mm(q(acc.firstSab, .5))} · first catch-or-incident report ${mm(q(acc.firstLoud, .5))} (${pct(acc.firstLoud.length, acc.runs)} of runs) · first upgrade ${mm(q(acc.firstUpgrade, .5))} · Day 3 starts ${mm(q(acc.day3, .5))}`);
}
