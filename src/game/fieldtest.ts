// The optional Field test after a run: three quick recall questions about what the player just saw.
// Retrieval practice: answering from memory makes a term stick far better than rereading it.
import { TERMS } from '../data/glossary';
import { Rng } from '../rng';
import type { Term } from '../types';
import { isIncident, type RunState } from './state';

export interface Question {
  /** Shown above the options. */
  prompt: string;
  /** Optional situation from the run the question refers to. */
  context?: string;
  options: string[];
  answer: string;
}

function distractors(rng: Rng, answer: Term, n: number): Term[] {
  const same = TERMS.filter((t) => t.id !== answer.id && t.category === answer.category);
  const other = TERMS.filter((t) => t.id !== answer.id && t.category !== answer.category);
  return [...rng.shuffle(same), ...rng.shuffle(other)].slice(0, n);
}

/** Up to three questions: failures and catches from this run first, then terms met this run. */
export function buildFieldTest(run: RunState, termsMet: string[]): Question[] {
  const rng = new Rng(`${run.seed}:fieldtest`);
  const outcomes = [...run.history, run.day].flatMap((d) => d.outcomes.map((o) => ({ o, day: d.day })));
  const questions: Question[] = [];
  const used = new Set<string>();

  // 1. Situations from the run: "what's this called?"
  const notable = outcomes.filter(({ o }) => o.draft.sabotaged && (isIncident(o) || o.action === 'audit'));
  for (const { o, day } of rng.shuffle(notable)) {
    if (questions.length >= 2) break;
    const t = TERMS.find((x) => x.family === o.card.sabotage!.family);
    if (!t || used.has(t.id)) continue;
    used.add(t.id);
    questions.push({
      prompt: 'What is this kind of failure called?',
      context: `Day ${day}, “${o.card.title}”: ${o.card.sabotage!.explanation}`,
      options: rng.shuffle([t, ...distractors(rng, t, 3)]).map((x) => x.id),
      answer: t.id,
    });
  }

  // 2. Definitions of terms met this run.
  const pool = rng.shuffle(TERMS.filter((t) => termsMet.includes(t.id) && !used.has(t.id)));
  const fallback = rng.shuffle(TERMS.filter((t) => !used.has(t.id) && t.category === 'basics'));
  for (const t of [...pool, ...fallback]) {
    if (questions.length >= 3) break;
    if (used.has(t.id)) continue;
    used.add(t.id);
    questions.push({
      prompt: 'Which term means this?',
      context: t.plain,
      options: rng.shuffle([t, ...distractors(rng, t, 3)]).map((x) => x.id),
      answer: t.id,
    });
  }
  return questions;
}

/** Three things the player can now bring up in conversation, picked from this run. */
export function talkingPoints(run: RunState, termsMet: string[]): Term[] {
  const outcomes = [...run.history, run.day].flatMap((d) => d.outcomes);
  const fromRun = outcomes.filter((o) => o.draft.sabotaged).map((o) => TERMS.find((t) => t.family === o.card.sabotage!.family)).filter((t): t is Term => !!t);
  const picks: Term[] = [];
  for (const t of [...fromRun, ...TERMS.filter((x) => termsMet.includes(x.id) && x.category !== 'basics'), ...TERMS.filter((x) => termsMet.includes(x.id))]) {
    if (picks.length >= 3) break;
    if (!picks.includes(t)) picks.push(t);
  }
  return picks;
}
