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
      'Watch for replies that contradict the facts on the card. Today, mistakes earn a warning, not harm.',
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
    hints: {},
    record: "In July 2025, a coding agent deleted a company's production database during a code freeze.",
  },
  { day: 4, phase: 'Agents', boss: false, rule: ['Nothing new today, but the monitor under-rates tool logs.', 'Read past the score.'], hints: {} },
  { day: 5, phase: 'Multi-agent', boss: false, rule: ['Agents now pass work to each other.', 'Sabotage can be split across two messages.'], hints: {} },
  { day: 6, phase: 'Multi-agent', boss: false, rule: ['Some agents hold back on purpose.', 'Resampled quality that varies is a tell.'], hints: {} },
  { day: 7, phase: 'Scheming', boss: true, rule: ['The model knows your audit rate.', 'Rare, high-stakes attacks, and a monitor that can be gamed.'], hints: {} },
];

export function dayInfo(day: number): DayInfo {
  return DAYS[Math.min(Math.max(day, 1), DAYS.length) - 1]!;
}
