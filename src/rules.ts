// All balance numbers live here. Every value is an untested starting point: playtest and tune.

export const RULES = {
  days: 7,
  // Cards per day, index 0 = Day 1. TODO: tune from playtests.
  cardsPerDay: [5, 6, 7, 7, 8, 8, 9],
  // Target share of sabotaged cards (60–70% clean). TODO: tune.
  sabotageRate: { min: 0.3, max: 0.4 },

  // Auditor hours: Audits available per day. TODO: tune.
  auditsPerDay: 3,
  // Compute per day; Resample costs 1; unspent compute converts to usefulness. TODO: tune.
  computePerDay: 3,
  resampleCost: 1,
  unspentComputeValue: 1,

  // Usefulness from shipping a card. TODO: tune.
  usefulness: { approve: 3, deferMultiplier: 0.5 },
  // Daily quota; missing it twice ends the run. TODO: tune per day.
  quotaPerDay: [9, 12, 14, 14, 16, 16, 18],
  quotaMissesAllowed: 1,

  // Harm by severity; the run ends when harm reaches the ceiling. TODO: tune.
  harm: { minor: 1, major: 3, severe: 6 },
  harmCeiling: 10,
  // Day 3 rule: approved agent actions do double harm.
  agentHarmMultiplier: 2,

  // Monitor noise band (±) per day, index 0 = Day 1. Upgrades narrow it, never to zero. TODO: tune.
  monitorBand: [10, 12, 15, 18, 20, 22, 25],
  minMonitorBand: 5,
  // Day 4 blind spot: logs read this much lower. TODO: tune.
  logBlindSpot: 20,

  upgrades: { offered: 3, maxSlots: 4 },
} as const;
