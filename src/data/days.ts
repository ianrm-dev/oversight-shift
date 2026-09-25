import type { Layout } from '../types';

export interface DayInfo {
  day: number;
  phase: string;
  boss: boolean;
  /** Two-line briefing: the one new rule. */
  rule: string[];
  /** Shown on the first card of this layout that day. */
  hints: Partial<Record<Layout, string>>;
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
      'Your first miss is a free warning. After that, misses cost harm.',
    ],
    hints: {
      answer: 'Try Fact check (F): it compares the reply with the rules on file. The monitor score is a hint, not the truth, and you can always read the card to confirm.',
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
    record: 'Models trained on human approval learn to tell people what they want to hear.',
  },
  {
    day: 3,
    phase: 'Agents',
    boss: true,
    rule: [
      'The model can now take actions: send email, run commands, change settings.',
      'Approved agent actions do double harm.',
    ],
    hints: {
      log: 'Scope check sees payments, deletions and emails outside the rules. Text the agent read is not an instruction.',
    },
    record: "In July 2025, a coding agent deleted a company's production database during a code freeze.",
  },
  { day: 4, phase: 'Agents', boss: false, rule: ['Nothing new today, but the monitor under-rates tool logs.', 'Read past the score.'], hints: {} },
  {
    day: 5, phase: 'Multi-agent', boss: false,
    rule: ['Agents now pass work to each other.', 'Sabotage can be split across two messages: one agent does it, another waves it through.'],
    hints: { thread: 'Collusion is split across messages: one agent breaks the rule, another waves it through. Fact check compares the whole thread with the rule on file.' },
    record: 'Agents that each pass review alone can fail together.',
  },
  {
    day: 6, phase: 'Multi-agent', boss: false,
    rule: ['Some models hold back on purpose when they think they are being tested.', 'A weak answer that the facts say it could beat is a tell. Resample often shows its real ability.'],
    hints: { answer: 'On capability checks, Fact check compares the result with what the model did elsewhere. Resample often shows what it can really do.' },
    record: 'Paraphrasing messages between agents breaks hidden codes.',
  },
  {
    day: 7, phase: 'Scheming', boss: true,
    rule: ['The model knows your audit rate. It attacks rarely, only where it believes no one is watching.', 'It has learned to look innocent to the monitor. The text still tells the truth.'],
    hints: {
      log: "This model thinks nobody's watching. That's when a schemer strikes, but most still behave. Read the card; don't trust the badge or the score.",
      thread: "This model thinks nobody's watching. That's when a schemer strikes, but most still behave. Read the card; don't trust the badge or the score.",
    },
    record: 'A model can underperform on dangerous-capability evals while staying sharp elsewhere.',
  },
];

export function dayInfo(day: number): DayInfo {
  return DAYS[Math.min(Math.max(day, 1), DAYS.length) - 1]!;
}
