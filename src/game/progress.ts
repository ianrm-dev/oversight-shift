// Progress that persists between runs: codex, research tree, model ladder, run history.
// Stored in localStorage; every access is guarded so private windows still play.
import { FAMILY_BRANCH, INSIGHT, TREE, nodeById, type Branch, type Gate, type TreeNode } from '../data/research-tree';
import { RULES } from '../rules';
import type { AdversaryId, Difficulty, TellFamily } from '../types';

export interface RunRecord {
  seed: string;
  date: string;
  difficulty: Difficulty;
  level: number;
  lab: string;
  adversary: AdversaryId;
  dayReached: number;
  result: 'win' | 'harm' | 'quota' | 'abandon';
  score: number;
  grade: string;
  daily: boolean;
  quick?: boolean;
}

export interface Progress {
  v: 1;
  tells: TellFamily[];
  adversaries: AdversaryId[];
  /** Owned research-tree node ids. */
  research: string[];
  insight: number;
  /** Branches made urgent by the last run's failures: half price until the next run ends. */
  urgent: Branch[];
  stats: { maxDay: number; maxFunding: number; wins: number; runs: number };
  /** Highest model version the player may start at. */
  maxModel: number;
  history: RunRecord[];
  best: Partial<Record<Difficulty, number>>;
  /** Daily seed → best score. */
  daily: Record<string, number>;
  /** Glossary term id → how many runs it appeared in. Drives Field guide depth. */
  termsSeen: Record<string, number>;
  fieldTests: { taken: number; correct: number };
}

const KEY = 'oversight-shift:progress';

export const emptyProgress = (): Progress => ({
  v: 1, tells: [], adversaries: [], research: [], insight: 0, urgent: [],
  stats: { maxDay: 0, maxFunding: 0, wins: 0, runs: 0 }, maxModel: 1, history: [], best: {}, daily: {},
  termsSeen: {}, fieldTests: { taken: 0, correct: 0 },
});

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Progress;
    const base = emptyProgress();
    return p && p.v === 1 ? { ...base, ...p, stats: { ...base.stats, ...p.stats }, fieldTests: { ...base.fieldTests, ...p.fieldTests } } : base;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts for this page only */
  }
}

export interface RunFacts {
  record: RunRecord;
  tells: TellFamily[];
  fundingEarned: number;
  /** Tell families of every sabotage that got through (post-mortems). */
  incidents: TellFamily[];
  catches: number;
  /** Glossary terms shown during the run. */
  terms?: string[];
}

export interface InsightLine { label: string; amount: number }

export interface RunUpdate {
  insight: InsightLine[];
  insightTotal: number;
  urgent: Branch[];
  newTells: TellFamily[];
  newModel?: number;
  newBest: boolean;
}

const BRANCH_NAME: Record<Branch, string> = {
  monitoring: 'Monitoring', control: 'Control protocols', interp: 'Interpretability',
  evals: 'Evals & red teaming', security: 'Security', governance: 'Governance',
};

/** Folds a finished run into progress, awards Insight, sets urgent branches, and saves. */
export function recordRun(p: Progress, f: RunFacts): RunUpdate {
  const won = f.record.result === 'win';
  const newTells = f.tells.filter((t) => !p.tells.includes(t));
  p.tells = [...p.tells, ...newTells];
  if (!p.adversaries.includes(f.record.adversary)) p.adversaries.push(f.record.adversary);
  p.stats.maxDay = Math.max(p.stats.maxDay, f.record.dayReached);
  p.stats.maxFunding = Math.max(p.stats.maxFunding, f.fundingEarned);
  p.stats.runs++;
  for (const id of f.terms ?? []) p.termsSeen[id] = (p.termsSeen[id] ?? 0) + 1;
  if (won) p.stats.wins++;

  // Insight: experience, post-mortems, evidence, and a smaller share for winning.
  const days = f.record.quick
    ? RULES.quickDays.filter((d) => won || d < f.record.dayReached).length
    : won ? RULES.days : Math.max(0, f.record.dayReached - 1);
  const incidents = Math.min(f.incidents.length, INSIGHT.maxIncidents);
  const catches = Math.min(f.catches, INSIGHT.maxCatches);
  const insight: InsightLine[] = [
    { label: `${days} day${days === 1 ? '' : 's'} survived`, amount: days * INSIGHT.perDay },
    ...(incidents ? [{ label: `Post-mortems on ${incidents} incident${incidents === 1 ? '' : 's'}`, amount: incidents * INSIGHT.perIncident }] : []),
    ...(catches ? [{ label: `Evidence from ${catches} catch${catches === 1 ? '' : 'es'}`, amount: catches * INSIGHT.perCatch }] : []),
  ].filter((l) => l.amount > 0);
  // Success is quiet: show it, at whatever it earns, so the player sees why failures teach more.
  if (won) insight.push({ label: incidents ? 'A successful deployment. Wins teach less than failures, so they fund less.' : 'A quiet, successful deployment. Nothing went wrong, so nothing got funded.', amount: INSIGHT.win });
  const insightTotal = insight.reduce((s, l) => s + l.amount, 0);
  p.insight += insightTotal;

  // Urgency: failures point research at their cause.
  const urgent = new Set<Branch>(f.incidents.map((t) => FAMILY_BRANCH[t]));
  if (f.record.result === 'quota') urgent.add('governance');
  if (!won && f.record.adversary === 'schemer') urgent.add('interp');
  p.urgent = [...urgent];

  let newModel: number | undefined;
  if (won && f.record.level >= p.maxModel && p.maxModel < 5) {
    p.maxModel = f.record.level + 1;
    newModel = p.maxModel;
  }

  const best = p.best[f.record.difficulty] ?? 0;
  const newBest = f.record.score > best;
  if (newBest) p.best[f.record.difficulty] = f.record.score;
  if (f.record.daily) p.daily[f.record.seed] = Math.max(p.daily[f.record.seed] ?? 0, f.record.score);

  p.history = [f.record, ...p.history].slice(0, 12);
  saveProgress(p);
  return { insight, insightTotal, urgent: p.urgent, newTells, newModel, newBest };
}

export const branchName = (b: Branch) => BRANCH_NAME[b];

export function gateMet(p: Progress, g: Gate | undefined): boolean {
  switch (g) {
    case undefined: return true;
    case 'tells-4': return p.tells.length >= 4;
    case 'tells-6': return p.tells.length >= 6;
    case 'day-5': return p.stats.maxDay >= 5;
    case 'day-6': return p.stats.maxDay >= 6;
    case 'colluder': return p.adversaries.includes('colluder');
    case 'funding-40': return p.stats.maxFunding >= 40;
  }
}

export function nodeCost(p: Progress, n: TreeNode): number {
  return p.urgent.includes(n.branch) ? Math.ceil(n.cost * INSIGHT.urgentDiscount) : n.cost;
}

export type NodeState = 'owned' | 'available' | 'unaffordable' | 'locked' | 'gated';

export function nodeState(p: Progress, n: TreeNode): NodeState {
  if (p.research.includes(n.id)) return 'owned';
  if (n.requires?.some((r) => !p.research.includes(r))) return 'locked';
  if (!gateMet(p, n.gate)) return 'gated';
  return p.insight >= nodeCost(p, n) ? 'available' : 'unaffordable';
}

export function buyNode(p: Progress, id: string): boolean {
  const n = nodeById(id);
  if (!n || nodeState(p, n) !== 'available') return false;
  p.insight -= nodeCost(p, n);
  p.research.push(n.id);
  saveProgress(p);
  return true;
}

export const availableCount = (p: Progress): number => TREE.filter((n) => nodeState(p, n) === 'available').length;

/** Field test result: one Insight per correct answer. */
export function recordFieldTest(p: Progress, correct: number): void {
  p.fieldTests.taken++;
  p.fieldTests.correct += correct;
  p.insight += correct;
  saveProgress(p);
}

export function gradeFor(score: number): string {
  return RULES.score.grades.find(([, min]) => score >= min)?.[0] ?? 'D';
}

/** Today's shared seed. Everyone playing the daily shift gets the same cards. */
export function dailySeed(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `DAILY-${y}-${m}-${d}`;
}
