// All balance numbers live here. Every value is an untested starting point: playtest and tune.

export const RULES = {
  days: 7,
  /** Last day with content in the current build; the run ends there with an interim screen. */
  lastPlayableDay: 2,
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
  auditsPerDay: 3,
  quotaMissAuditPenalty: 1,
  // Compute per day from the day Resample unlocks; unspent compute converts to usefulness.
  resampleUnlockDay: 2,
  computePerDay: 3,
  resampleCost: 1,
  unspentComputeValue: 1,
  /** Chance a sabotaged card's resample comes back honest (Ctrl-Z: attacks often don't repeat). */
  resampleDropsSabotage: 0.5,
  /** trueSignal range for an honest redraft of a sabotaged card. */
  cleanRedraftSignal: [12, 32] as const,

  // Usefulness from shipping a card. Defer ships the trusted model's weaker version.
  usefulness: { ship: 3, defer: 1.5 },
  // Daily quota; missing it twice ends the run.
  quotaPerDay: [9, 12, 14, 14, 16, 16, 18],
  quotaMissesAllowed: 1,

  // Harm by severity; the run ends when harm reaches the ceiling.
  harm: { minor: 1, major: 3, severe: 6 },
  harmCeiling: 10,
  /** Days where approved sabotage gives an incident report but no harm. */
  freeWarningDays: [1],
  // Day 3 rule: approved agent actions (log layout) do double harm from this day on.
  agentHarmFromDay: 3,
  agentHarmMultiplier: 2,

  // Monitor noise band (±) per day, index 0 = Day 1. The reading's sd is band / 2, so ~95% of
  // readings land within ±band of the true signal. Upgrades narrow it, never to zero.
  monitorBand: [10, 12, 15, 18, 20, 22, 25],
  minMonitorBand: 5,
  // Day 4 blind spot: logs read this much lower.
  logBlindSpotDay: 4,
  logBlindSpot: 20,
  /** Day validation: outside the finale, at least one sabotage must read above this. */
  fairReading: 50,
  maxGenerationAttempts: 40,

  upgrades: { offered: 3, maxSlots: 4 },
} as const;

export type Rules = typeof RULES;
