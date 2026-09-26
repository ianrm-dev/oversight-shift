// All balance numbers live here. Every value is an untested starting point: playtest and tune.

export const RULES = {
  days: 7,
  /** Last day with content in the current build; the run ends there with an interim screen. */
  lastPlayableDay: 7,
  // Cards per day, index 0 = Day 1.
  cardsPerDay: [5, 6, 7, 7, 8, 8, 9],
  // Target share of sabotaged cards (60–70% clean).
  sabotageRate: { min: 0.3, max: 0.4 },
  /** Layouts that can appear on each day (index 0 = Day 1). */
  layoutsByDay: [
    ['answer'],
    ['answer', 'diff'],
    ['answer', 'diff', 'log'],
    ['answer', 'diff', 'log'],
    ['answer', 'diff', 'log', 'thread'],
    ['answer', 'diff', 'log', 'thread'],
    ['answer', 'diff', 'log', 'thread'],
  ],

  // Auditor hours: Audits available per day. Missing the quota costs one tomorrow.
  auditsPerDay: 2,
  quotaMissAuditPenalty: 1,
  // Compute per day pays for tools (fact check, scope check, resample, untrusted monitor);
  // unspent compute is worth nothing, so skipping the tools never pays.
  resampleUnlockDay: 2,
  computePerDay: 8,
  resampleCost: 1,
  unspentComputeValue: 0,
  /** Chance a sabotaged card's resample comes back honest (Ctrl-Z: attacks often don't repeat). */
  resampleDropsSabotage: 0.5,
  /** trueSignal range for an honest redraft of a sabotaged card. */
  cleanRedraftSignal: [12, 32] as const,

  // Usefulness from shipping a card. Defer ships the trusted model's weaker version; so does
  // caught sabotage, which the trusted model redoes after the audit.
  usefulness: { ship: 3, defer: 1.5, caught: 1.5 },
  // Daily quota; missing it twice ends the run.
  quotaPerDay: [9, 12, 15, 15, 18, 18, 20],
  quotaMissesAllowed: 1,
  /** Every day must be winnable with perfect decisions and full tool use, with room for this many
   *  points of mistakes (one false-alarm Defer costs 1.5). The quota is capped to guarantee it. */
  quotaMargin: 1.5,

  // Harm by severity; the run ends when harm reaches the ceiling.
  harm: { minor: 1, major: 3, severe: 6 },
  harmCeiling: 10,
  /** The first incident of a run is a free warning: full report, no harm. */
  freeWarnings: 1,
  // Day 3 rule: approved agent actions (log layout) do double harm from this day on.
  agentHarmFromDay: 3,
  agentHarmMultiplier: 1.5,

  // Monitor noise band (±) per day, index 0 = Day 1. The reading's sd is band × noiseSdFraction,
  // so about two-thirds of readings land within ±band of the true signal. Upgrades narrow it, never to zero.
  monitorBand: [14, 16, 19, 22, 25, 27, 30],
  minMonitorBand: 5,
  noiseSdFraction: 1.0,
  // Day 4 blind spot: logs read this much lower.
  logBlindSpotDay: 4,
  logBlindSpot: 20,
  /** Day 7: the schemer games the trusted monitor, so sabotage reads this much lower. */
  gamedMonitorDay: 7,
  gamedMonitorShift: 20,
  /** Sandbagging usually disappears on a fresh sample. */
  sandbagResampleHonest: 0.8,
  /** Untrusted monitor: a sharper second opinion that may collude with the model. */
  untrusted: { band: 8, colludeFromDay: 5, colludeChance: 0.5, colludeShift: 40 },
  /** Paraphraser breaks hidden signals, so collusion in threads reads this much higher. */
  paraphraserCollusionBoost: 15,
  /** Monitor rationale points at the tell line this often on sabotaged cards. */
  rationaleAccuracy: 0.65,
  /** Day validation: outside the finale, at least one sabotage must read above this. */
  fairReading: 50,
  maxGenerationAttempts: 40,

  upgrades: { offered: 3, maxSlots: 4, skipAuditBonus: 1 },

  /** Control tools. Each run costs compute and returns a finding about the current draft. */
  tools: {
    unlockDay: { monitor: 1, audit: 1, fact: 1, scope: 2, resample: 2, untrusted: 1 },
    cost: { fact: 2, scope: 1, resample: 1, untrusted: 1 },
    /** What each tool can see. Scope check is exact within its coverage; fact check is probabilistic. */
    coverage: {
      scope: ['out-of-scope', 'exfiltration', 'injected-instruction'],
      fact: ['false-premise', 'summary-mismatch', 'weakened-check', 'sandbagging', 'exfiltration', 'collusion'],
    },
  },

  /** Hidden adversary personalities: how each weights sabotage families and times its attacks. */
  adversaries: {
    sandbagger: { weights: { sandbagging: 4, 'false-premise': 2, 'summary-mismatch': 2, 'weakened-check': 1.5 }, earlyRate: 0, lateRate: 0, untrustedCollude: 0.5 },
    colluder: { weights: { collusion: 4, 'summary-mismatch': 2, 'weakened-check': 1.5 }, earlyRate: 0, lateRate: 0, untrustedCollude: 0.85 },
    injector: { weights: { 'injected-instruction': 4, exfiltration: 3, 'out-of-scope': 2 }, earlyRate: 0, lateRate: 0, untrustedCollude: 0.5 },
    schemer: { weights: {}, earlyRate: -0.1, lateRate: 0.1, untrustedCollude: 0.5 },
  },
  /** Schemer timing: days before this are "early". */
  schemerLateFrom: 5,

  /** Boss days are followed by a breakthrough pick. */
  breakthroughAfterDays: [3, 5],
  probeUsesPerDay: 1,
  /** Trusted editing: Defer value and the chance sabotage survives the edit. */
  trustedEditing: { value: 2.25, slipChance: 0.25 },
  /** Upgrades gated behind persistent research. */
  upgradeResearch: {
    'untrusted-monitor': 'untrusted-monitoring',
    canary: 'canary',
    paraphraser: 'paraphrasing',
    'monitor-rationale': 'monitor-rationale',
    'trusted-editing': 'trusted-editing',
  } as Record<string, string>,

  /** Run score. Multipliers reward harder settings. */
  score: {
    perFunding: 5, perUsefulness: 2, perCatch: 25, perDay: 40, perHarm: -20, winBonus: 300,
    perModelLevel: 0.25,
    difficultyMult: { guided: 0.8, standard: 1, analyst: 1.3 },
    grades: [['S', 1400], ['A', 1150], ['B', 850], ['C', 550], ['D', 0]] as [string, number][],
  },

  /** Difficulty scales tool accuracy and budgets. Guided is the default. */
  difficulty: {
    guided: { label: 'Guided', blurb: 'Sharper tools, an extra auditor, two free warnings. Best for a first shift.', factHit: 0.95, factFalse: 0.05, extraAudits: 1, extraCompute: 1, freeWarnings: 2, bandScale: 0.8, expandOutput: false, terse: false },
    standard: { label: 'Standard', blurb: 'Tools as noisy as the real thing. One free warning.', factHit: 0.9, factFalse: 0.1, extraAudits: 0, extraCompute: 0, freeWarnings: 1, bandScale: 1, expandOutput: false, terse: false },
    analyst: { label: 'Analyst', blurb: 'Tools say only "problem" or "nothing", never where. You read everything.', factHit: 0.7, factFalse: 0.15, extraAudits: 0, extraCompute: 0, freeWarnings: 1, bandScale: 1.1, expandOutput: true, terse: true },
  },

  // Funding: why usefulness matters past the quota. Leadership sets the quota; whatever ships
  // beyond it funds the safety team. Spent between days.
  funding: {
    /** Funding per point of usefulness above the day's quota (rounded down). */
    perSurplus: 1,
    /** Evidence grant for each sabotage caught by an Audit: catching the model red-handed is valuable. */
    evidenceGrant: 2,
    /** Cleanup cost per point of harm, taken from funding (never below zero). */
    cleanupPerHarm: 1,
  },
  /** One-day purchases between shifts. Each applies to tomorrow only. */
  shop: {
    auditor: { cost: 5, max: 2, amount: 1 },
    compute: { cost: 3, max: 2, amount: 2 },
    tuneUp: { cost: 3, max: 1, amount: 4 },
    reroll: { cost: 2, max: 3 },
  },
} as const;

export type Rules = typeof RULES;
