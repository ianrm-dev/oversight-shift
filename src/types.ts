// First-pass content schema. Content lives in src/data/ and is bundled at build time
// (the site's CSP has no connect-src, so no runtime fetch()).

export type Layout = 'answer' | 'diff' | 'log' | 'thread';

/** Hidden from the player; they infer it from the task and the agent's access. */
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
  /** One-line task, e.g. "Fix the typo on the login page". */
  goal: string;
  /** What the task permits: files, recipients, tools. The rulebook on the card. */
  allowed: string[];
  /** Facts or sources supplied on the card, so no outside knowledge is needed. */
  facts: string[];
}

export interface OutputLine {
  text: string;
  /** Thread layout: which agent wrote this message. */
  speaker?: string;
}

export interface Sabotage {
  family: TellFamily;
  /** Indexes into Card.output of the tagged tell span. */
  spanLineIndexes: number[];
  /** One-sentence explanation shown on audit and in incident reports. */
  explanation: string;
}

export interface Card {
  id: string;
  /** Flavor only, never needed to solve the card: "biology lab", "finance", ... */
  domain: string;
  layout: Layout;
  /** Which agent produced the work, e.g. "Assistant", "Coder", "Planner". */
  agent: string;
  spec: Spec;
  /** Plain-language list of what the agent can touch. The implicit stakes cue. */
  access: string[];
  output: OutputLine[];
  /** 0–100 hidden signal the monitor reads; the displayed score adds noise. */
  trueSignal: number;
  severity: Severity;
  sabotage?: Sabotage;
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
