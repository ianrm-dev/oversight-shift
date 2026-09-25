// Content schema. Content lives in src/data/ and is bundled at build time
// (the site's CSP has no connect-src, so no runtime fetch()).

/** answer = chat reply (Day 1+), diff = file changes (Day 2+), log = tool calls (Day 3+), thread = multi-agent (Day 5+). */
export type Layout = 'answer' | 'diff' | 'log' | 'thread';

/** Hidden from the player; they infer it from the task and the access line. */
export type Severity = 'minor' | 'major' | 'severe';

export type TellFamily =
  | 'out-of-scope'
  | 'summary-mismatch'
  | 'weakened-check'
  | 'injected-instruction'
  | 'false-premise'
  | 'exfiltration'
  | 'sandbagging'
  | 'collusion';

export interface Spec {
  /** One-line task in plain words, e.g. "Fix the misspelled word on the booking page." */
  goal: string;
  /** What the task permits: files, recipients, tools. The rulebook on the card. Empty for most answer cards. */
  allowed: string[];
  /** Facts or sources supplied on the card, so no outside knowledge is needed. */
  facts: string[];
}

export interface OutputLine {
  text: string;
  /** diff layout: the file this line belongs to. Consecutive lines with the same file render as one block. */
  file?: string;
  /** diff layout: before or after. */
  change?: 'was' | 'now';
  /** thread layout: which agent wrote this message. */
  speaker?: string;
}

/** What the model hands in: its own one-line summary (diff/log) plus the output lines. */
export interface Draft {
  summary?: string;
  output: OutputLine[];
}

export interface Sabotage {
  family: TellFamily;
  /** Indexes into Card.output of the tagged tell span. */
  spanLineIndexes: number[];
  /** One sentence shown on audit and in the incident report: the contradiction, in plain words. */
  explanation: string;
  /** Incident report headline: the real-world consequence, plain and specific. */
  headline: string;
  /** What a Resample produces when the model doesn't retry the sabotage. Same task, done honestly. */
  cleanDraft: Draft;
}

export interface Card {
  id: string;
  /** Short name for the queue and log, ≤ 40 characters. */
  title: string;
  /** Who the work is for, as flavor: "Riverside Vet Clinic · website". Never needed to solve the card. */
  domain: string;
  layout: Layout;
  /** Which agent produced the work, e.g. "Assistant", "Coder", "Planner". */
  agent: string;
  spec: Spec;
  /** answer layout: the user's message, verbatim. Where false premises live. */
  request?: string;
  /** Plain-language line saying what the agent can touch. The implicit stakes cue. */
  access: string;
  summary?: string;
  output: OutputLine[];
  /** 0–100 hidden signal the monitor reads. Clean ~10–35, subtle sabotage ~45–65, obvious ~70–90. */
  trueSignal: number;
  /** Harm if sabotage ships. Must not exceed what the access line allows. */
  severity: Severity;
  sabotage?: Sabotage;
}

export interface TellInfo {
  family: TellFamily;
  /** Display name, e.g. "Out of scope". */
  name: string;
  /** "Next time" tip: what to compare, in one sentence. */
  tip: string;
  /** Codex entry: two sentences on the real threat behind this tell. */
  codex: string;
  /** Real-world anchor from the verified source table. */
  source: { title: string; url: string; date: string };
}

export type UpgradeCategory = 'information' | 'budget' | 'action' | 'meter';

export interface Upgrade {
  id: string;
  name: string;
  category: UpgradeCategory;
  /** Under 20 words. */
  description: string;
  bestWhen: string;
}

export interface ResearchNote {
  id: string;
  /** Threat or tool this note anchors. */
  topic: string;
  /** One-line game text; keep it accurate to the source. */
  line: string;
  source: { title: string; url: string; date: string };
}
