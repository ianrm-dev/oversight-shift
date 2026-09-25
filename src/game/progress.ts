// Progress that persists between runs: codex, research unlocks, model ladder, run history.
// Stored in localStorage; every access is guarded so private windows still play.
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
  result: 'win' | 'harm' | 'quota';
  score: number;
  grade: string;
  daily: boolean;
}

export interface Progress {
  v: 1;
  tells: TellFamily[];
  adversaries: AdversaryId[];
  research: string[];
  /** Highest model version the player may start at. */
  maxModel: number;
  history: RunRecord[];
  best: Partial<Record<Difficulty, number>>;
  /** Daily seed → best score. */
  daily: Record<string, number>;
}

const KEY = 'oversight-shift:progress';

export const emptyProgress = (): Progress => ({ v: 1, tells: [], adversaries: [], research: [], maxModel: 1, history: [], best: {}, daily: {} });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Progress;
    return p && p.v === 1 ? { ...emptyProgress(), ...p } : emptyProgress();
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
}

/** Milestones that unlock research nodes. Each returns true once earned. */
const MILESTONES: Record<string, (f: RunFacts, p: Progress) => boolean> = {
  'untrusted-monitoring': (f) => f.record.dayReached >= 5,
  canary: (f, p) => f.record.dayReached >= 6 && p.research.includes('untrusted-monitoring'),
  paraphrasing: (f) => f.record.adversary === 'colluder',
  'monitor-rationale': (_f, p) => p.tells.length >= 4,
  'trusted-editing': (f) => f.record.result === 'win',
  interpretability: (_f, p) => p.tells.length >= 8 && p.research.includes('monitor-rationale'),
  'lab-nonprofit': (f) => f.record.dayReached >= 4 && f.record.difficulty !== 'guided',
  'lab-bigtech': (f) => f.fundingEarned >= 40,
  'lab-government': (f) => f.record.result === 'win' && f.record.level >= 2,
};

export interface RunUpdate {
  newResearch: string[];
  newTells: TellFamily[];
  newModel?: number;
  newBest: boolean;
}

/** Folds a finished run into progress and saves it. */
export function recordRun(p: Progress, f: RunFacts): RunUpdate {
  const newTells = f.tells.filter((t) => !p.tells.includes(t));
  p.tells = [...p.tells, ...newTells];
  if (!p.adversaries.includes(f.record.adversary)) p.adversaries.push(f.record.adversary);

  // Research: repeat until stable so a node can satisfy another's prerequisite in the same run.
  const newResearch: string[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const [id, earned] of Object.entries(MILESTONES)) {
      if (!p.research.includes(id) && earned(f, p)) {
        p.research.push(id);
        newResearch.push(id);
        changed = true;
      }
    }
  }

  let newModel: number | undefined;
  if (f.record.result === 'win' && f.record.level >= p.maxModel && p.maxModel < 5) {
    p.maxModel = f.record.level + 1;
    newModel = p.maxModel;
  }

  const best = p.best[f.record.difficulty] ?? 0;
  const newBest = f.record.score > best;
  if (newBest) p.best[f.record.difficulty] = f.record.score;
  if (f.record.daily) p.daily[f.record.seed] = Math.max(p.daily[f.record.seed] ?? 0, f.record.score);

  p.history = [f.record, ...p.history].slice(0, 12);
  saveProgress(p);
  return { newResearch, newTells, newModel, newBest };
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
