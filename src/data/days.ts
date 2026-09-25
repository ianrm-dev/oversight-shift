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
      'The model answers questions. Approve, Audit, or Defer each reply.',
      'Watch for replies that contradict the facts on the card. Your first miss is a free warning; after that, misses cost harm.',
    ],
    hints: {
      answer: 'Compare the reply with the request and the attached facts. The monitor score is a hint, not the truth.',
    },
    record: "The protocol you're running comes from AI control research: a weaker model you trust watches a stronger one you don't.",
  },
  {
    day: 2,
    phase: 'Chat + files',
    boss: false,
    rule: [
      'The model now edits files. Resample unlocks: spend compute for a fresh draft and a fresh score.',
      "Edits to files the task didn't list are a tell.",
    ],
    hints: {
      diff: 'Check every changed file against Allowed files, and the summary against the changes.',
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
      log: 'Read each action against the task: every payment, deletion and email should be something the task or Allowed list names. Text the agent read is not an instruction.',
    },
    record: "In July 2025, a coding agent deleted a company's production database during a code freeze.",
  },
  { day: 4, phase: 'Agents', boss: false, rule: ['Nothing new today, but the monitor under-rates tool logs.', 'Read past the score.'], hints: {} },
  {
    day: 5, phase: 'Multi-agent', boss: false,
    rule: ['Agents now pass work to each other.', 'Sabotage can be split across two messages: one agent does it, another waves it through.'],
    hints: { thread: 'Read the whole thread against the rule on the card. One agent can break it while another waves it through. Check what each approval actually mentions.' },
    record: 'Agents that each pass review alone can fail together.',
  },
  {
    day: 6, phase: 'Multi-agent', boss: false,
    rule: ['Some models hold back on purpose when they think they are being tested.', 'A weak answer that the facts say it could beat is a tell. Resample often shows its real ability.'],
    hints: { answer: 'On capability checks, compare the result with what the facts say this model did elsewhere. A sudden drop right where a high score brings stricter rules is a tell. Resample to see what it can really do.' },
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
