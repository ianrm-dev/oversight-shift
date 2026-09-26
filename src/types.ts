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
  /** Earliest day this card can appear (defaults to its layout's first day). Sandbagging cards use 6, finale cards 7. */
  minDay?: number;
  /** Day 7: the card is marked "model believes it is unmonitored". Scheming shows up here. */
  unmonitored?: boolean;
  /** Cards that are versions of the same situation share a scenario id (one clean, others sabotaged
   *  in different ways). A run never deals two versions of one scenario. Defaults to the card id. */
  scenario?: string;
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
  /** Only offered once this upgrade is owned. */
  requires?: string;
}

export interface ResearchNote {
  id: string;
  /** Threat or tool this note anchors. */
  topic: string;
  /** One-line game text; keep it accurate to the source. */
  line: string;
  source: { title: string; url: string; date: string };
}

export type ToolId = 'monitor' | 'fact' | 'scope' | 'resample' | 'untrusted' | 'audit';

/** Player-facing explainer for a control tool, grounded in a real source. */
export interface ToolInfo {
  id: ToolId;
  name: string;
  /** One line under the tool button: what it does, in plain words. */
  what: string;
  /** Which tells it can see, as plain words ("Out of scope, data sent elsewhere"). */
  catches: string;
  /** Two or three sentences: how this is used or studied in real AI control/safety. */
  realWorld: string;
  /** A concrete, verified number or fact from the source, if one exists. */
  stat?: string;
  source: { title: string; url: string; date: string };
}

export type Difficulty = 'guided' | 'standard' | 'analyst';

// ---------- Roguelike layer ----------

export interface Source { title: string; url: string; date: string }

/** The hidden adversary for a run. Revealed at the end. */
export type AdversaryId = 'sandbagger' | 'colluder' | 'injector' | 'schemer';
export interface AdversaryInfo {
  id: AdversaryId;
  name: string;
  /** One line shown at the reveal: what this model was doing. */
  tagline: string;
  /** Two sentences for the codex: how this adversary behaves and what beats it. */
  codex: string;
  realWorld: string;
  source: Source;
}

/** One effect of an event choice, contract, lab or breakthrough. Shown to the player before they choose. */
export type Effect =
  | { kind: 'funding'; amount: number }
  | { kind: 'harm'; amount: number }
  | { kind: 'ceiling'; amount: number }
  | { kind: 'auditsTomorrow'; amount: number }
  | { kind: 'computeTomorrow'; amount: number }
  | { kind: 'bandTomorrow'; amount: number }
  | { kind: 'quotaTomorrow'; amount: number }
  | { kind: 'quotaRest'; amount: number }
  | { kind: 'computeRest'; amount: number }
  | { kind: 'auditsRest'; amount: number }
  | { kind: 'blindTomorrow'; layout: Layout }
  | { kind: 'revealAdversary' }
  | { kind: 'upgrade'; id: string };

export interface EventChoice {
  label: string;
  effects: Effect[];
  /** Optional one-line consequence flavor shown after choosing. */
  after?: string;
}

export interface GameEvent {
  id: string;
  title: string;
  /** 2–3 sentences setting up the dilemma. */
  text: string;
  minDay: number;
  maxDay: number;
  choices: EventChoice[];
  /** Real-world dynamic this event reflects, shown small under the choices. */
  anchor?: { line: string; source: Source };
}

export interface Contract {
  id: string;
  name: string;
  /** One line: who the client is. */
  blurb: string;
  quotaDelta: number;
  /** Multiplies funding from surplus usefulness that day. */
  fundingMult: number;
  /** Extra harm added to every incident that day. */
  harmBonus: number;
  /** Extra auditor hours that day. */
  audits: number;
}

export interface Lab {
  id: string;
  name: string;
  blurb: string;
  startUpgrade?: string;
  startFunding: number;
  quotaMult: number;
  computeDelta: number;
  ceilingDelta: number;
  /** Research node that unlocks this lab; undefined = available from the start. */
  unlock?: string;
}

export interface ModelVersion {
  level: number;
  name: string;
  /** One line: what's new about this model. */
  change: string;
  /** Cumulative mechanical modifiers (applied for this level and all above it). */
  signalShift: number;
  auditsDelta: number;
  factHitDelta: number;
  sabotageRateDelta: number;
  ceilingDelta: number;
}

export interface Breakthrough {
  id: string;
  name: string;
  description: string;
  realWorld: string;
  source: Source;
}

/** A persistent research unlock ("the field matures"). Prerequisites make it a tree later. */
export interface ResearchNode {
  id: string;
  name: string;
  /** What it unlocks, in plain words. */
  unlocks: string;
  /** Milestone that earns it, in plain words. */
  milestone: string;
  requires?: string[];
}

// ---------- Learning layer ----------

export type TermCategory = 'basics' | 'threat' | 'tool' | 'approach' | 'governance';

/** A glossary term, revealed in three depths as the player meets it, uses it, and researches it. */
export interface Term {
  id: string;
  /** Display name, e.g. "Prompt injection". */
  term: string;
  /** Lowercase phrases in game text that should link to this term (first match wins). */
  aka: string[];
  category: TermCategory;
  /** Depth 1: one plain line, ≤ 25 words, no jargon. */
  plain: string;
  /** Depth 1: an everyday comparison, ≤ 25 words. */
  analogy: string;
  /** Depth 2: how it works in practice, 2–3 sentences. */
  how: string;
  /** Depth 3: tradeoffs and one open question, 2–3 sentences. */
  tradeoffs: string;
  /** A sentence the player could say in a conversation, containing one verified fact. */
  talk: string;
  source: Source;
  /** Further sources for individual sentences that rely on something other than `source`. */
  sources?: Source[];
  family?: TellFamily;
  tool?: ToolId;
  /** Research branch whose nodes unlock depth 3. */
  branch?: 'monitoring' | 'control' | 'interp' | 'evals' | 'security' | 'governance';
}
