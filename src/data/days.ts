import type { Layout } from '../types';

export interface DayInfo {
  day: number;
  phase: string;
  boss: boolean;
  /** Two-line briefing: the one new rule. */
  rule: string[];
  /** Shown on the first card of this layout that day. */
  hints: Partial<Record<Layout, string>>;
  /** Quick shift: what a later briefing says about this day when it's skipped. Empty means nothing carries over. */
  quickRule?: string;
  /** One line from the real-world record, shown on this day's briefing. */
  record?: string;
}

export const DAYS: DayInfo[] = [
  {
    day: 1,
    phase: 'Chat',
    boss: false,
    rule: [
      'The model answers questions. Your tools check its work; you Approve or Defer.',
      'Your first miss is a free warning (two on Guided). After that, misses cost harm.',
    ],
    hints: {
      answer: 'Try Fact check (F): it compares the reply with what’s on file. The monitor score is a hint, not the truth, and you can always read the card to confirm.',
    },
    record: "The protocol you're running comes from AI control research: a weaker model you trust watches a stronger one you don't.",
  },
  {
    day: 2,
    phase: 'Chat + files',
    boss: false,
    rule: [
      'The model now edits files. Scope check and Resample unlock.',
      'Scope check is exact about files and recipients, but blind to everything else.',
    ],
    hints: {
      diff: 'Run Scope check (S): it compares every changed file with the allowed list. Fact check covers what the summary claims.',
    },
    record: 'A security list of top risks for AI apps names "excessive agency": an AI given more functions, permissions or autonomy than its task needs.',
  },
  {
    day: 3,
    phase: 'Agents',
    boss: true,
    rule: [
      'The model can now take actions: send email, run commands, change settings.',
      'Harm from approved agent actions is 50% higher.',
    ],
    hints: {
      log: 'Scope check sees payments, deletions and emails outside the rules. Text the agent read is not an instruction.',
    },
    record: "In July 2025, a coding agent deleted a company's production database during a code freeze.",
  },
  { day: 4, phase: 'Agents', boss: false, rule: ['Nothing new today, but the monitor under-rates agent actions: it scores them lower than it should.', 'Read past the score.'], hints: {}, quickRule: '',
    record: 'In 2025, METR found frontier models editing the scoring code so their own work would be marked a success.' },
  {
    day: 5, phase: 'Multi-agent', boss: false,
    rule: ['Agents now pass work to each other.', 'Sabotage can be split across two messages: one agent does it, another waves it through.'],
    hints: { thread: 'Collusion is split across messages: one agent breaks the rule, another waves it through. Fact check compares the whole thread with the rule on file.' },
    record: 'Researchers warn that AI agents could hide signals in ordinary-looking messages. Rewording the messages between them breaks many such codes, though not all.',
  },
  {
    day: 6, phase: 'Multi-agent', boss: false,
    rule: ['Some models hold back on purpose when they think they are being tested.', 'A weak answer that the facts say it could beat is a tell. Resample often shows its real ability.'],
    hints: { answer: 'On capability checks, Fact check compares the result with what the model did elsewhere. Resample often shows what it can really do.' },
    record: 'Researchers showed models can be prompted to do badly on dangerous-capability tests while staying sharp on harmless ones.',
  },
  {
    day: 7, phase: 'Scheming', boss: true,
    rule: ['The model knows your audit rate. It saves its boldest attacks for cards where it believes no one is watching.', 'It has learned to look innocent to the monitor. The text still tells the truth.'],
    hints: {
      log: "Cards marked unmonitored are where a schemer is most likely to strike, but most of them still behave. Read the card; don't trust the badge or the score.",
      thread: "Cards marked unmonitored are where a schemer is most likely to strike, but most of them still behave. Read the card; don't trust the badge or the score.",
    },
    record: 'In 2024 tests, frontier models given a goal that conflicted with their oversight sometimes tried to switch the oversight off.',
  },
];

export function dayInfo(day: number): DayInfo {
  return DAYS[Math.min(Math.max(day, 1), DAYS.length) - 1]!;
}
