import type { TellFamily } from '../types';

// The persistent research tree. Insight earned from runs (mostly from failures) buys nodes.
// Mechanics live here; real-world anchors live in research-anchors.ts.

export type Branch = 'monitoring' | 'control' | 'interp' | 'evals' | 'security' | 'governance';

/** Something the player must have encountered before a node can be researched. */
export type Gate = 'tells-4' | 'tells-6' | 'day-5' | 'day-6' | 'colluder' | 'funding-40';

export interface TreeNode {
  id: string;
  branch: Branch;
  tier: 1 | 2 | 3;
  name: string;
  /** What it does, in plain words, under 16 words. */
  effect: string;
  cost: number;
  requires?: string[];
  gate?: Gate;
}

export const BRANCHES: { id: Branch; name: string; blurb: string }[] = [
  { id: 'monitoring', name: 'Monitoring', blurb: 'Make the always-on monitor sharper.' },
  { id: 'control', name: 'Control protocols', blurb: 'Better ways to use models you can’t trust.' },
  { id: 'interp', name: 'Interpretability', blurb: 'Read the model’s internals, not just its output.' },
  { id: 'evals', name: 'Evals & red teaming', blurb: 'Find out what the model can do, and what it’s doing.' },
  { id: 'security', name: 'Security', blurb: 'Limit what an agent can touch.' },
  { id: 'governance', name: 'Governance', blurb: 'Change the pressure you work under.' },
];

export const GATE_TEXT: Record<Gate, string> = {
  'tells-4': 'Discover 4 tell families first',
  'tells-6': 'Discover 6 tell families first',
  'day-5': 'Reach Day 5 first',
  'day-6': 'Reach Day 6 first',
  colluder: 'Face the colluder first',
  'funding-40': 'Raise 40 funding in one run first',
};

// Node ids that existed as milestone unlocks keep their ids, so saved progress carries over.
export const TREE: TreeNode[] = [
  // Monitoring
  { id: 'mon-prompts', branch: 'monitoring', tier: 1, name: 'Better monitor prompts', effect: 'The monitor’s error band is 2 narrower, every day.', cost: 2 },
  { id: 'monitor-rationale', branch: 'monitoring', tier: 2, name: 'Monitor explanations', effect: 'Monitor rationale can appear as your research upgrade.', cost: 4, requires: ['mon-prompts'], gate: 'tells-4' },
  { id: 'mon-ensemble', branch: 'monitoring', tier: 3, name: 'Monitor ensembles', effect: 'Several monitors vote: the band is 3 narrower again.', cost: 8, requires: ['monitor-rationale'] },

  // Control protocols
  { id: 'ctl-resample', branch: 'control', tier: 1, name: 'Resampling protocols', effect: 'Resample drops an attack more often (about 1 in 2 instead of 2 in 5).', cost: 2 },
  { id: 'trusted-editing', branch: 'control', tier: 2, name: 'Trusted editing', effect: 'Trusted editing can appear as your research upgrade.', cost: 4, requires: ['ctl-resample'] },
  { id: 'untrusted-monitoring', branch: 'control', tier: 2, name: 'Untrusted monitoring', effect: 'The Untrusted monitor can appear as your research upgrade.', cost: 4, requires: ['ctl-resample'], gate: 'day-5' },
  { id: 'paraphrasing', branch: 'control', tier: 3, name: 'Paraphrasing', effect: 'The Paraphraser can appear as your research upgrade.', cost: 5, requires: ['untrusted-monitoring'], gate: 'colluder' },
  { id: 'canary', branch: 'control', tier: 3, name: 'Canaries', effect: 'The Canary can appear as your research upgrade.', cost: 5, requires: ['untrusted-monitoring'], gate: 'day-6' },

  // Interpretability
  { id: 'interpretability', branch: 'interp', tier: 1, name: 'Linear probes', effect: 'The interpretability probe joins boss-day breakthroughs.', cost: 4, gate: 'tells-6' },
  { id: 'int-probe2', branch: 'interp', tier: 2, name: 'Cheaper probes', effect: 'The probe works twice a day.', cost: 5, requires: ['interpretability'] },
  { id: 'int-probe-start', branch: 'interp', tier: 3, name: 'Probes in production', effect: 'Start every run with the probe.', cost: 8, requires: ['int-probe2'] },

  // Evals & red teaming
  { id: 'evl-sandbag', branch: 'evals', tier: 1, name: 'Sandbagging evals', effect: 'Fact check finds sandbagging and loosened rules more reliably.', cost: 2 },
  { id: 'evl-redteam', branch: 'evals', tier: 2, name: 'Red-team program', effect: 'Learn which adversary you face after Day 1.', cost: 4, requires: ['evl-sandbag'] },
  { id: 'evl-forecast', branch: 'evals', tier: 3, name: 'Threat forecasting', effect: 'Each briefing estimates how many attacks are coming today.', cost: 6, requires: ['evl-redteam'] },

  // Security
  { id: 'sec-least-privilege', branch: 'security', tier: 1, name: 'Least privilege', effect: 'Scope check is free on agent-action cards.', cost: 3 },
  { id: 'sec-permissions', branch: 'security', tier: 2, name: 'Permission tiers', effect: 'Approved agent actions never do more than Major harm.', cost: 5, requires: ['sec-least-privilege'] },
  { id: 'lab-government', branch: 'security', tier: 2, name: 'Public-sector program', effect: 'Unlocks the Government AI office lab.', cost: 3, requires: ['sec-least-privilege'] },
  { id: 'sec-sandbox', branch: 'security', tier: 3, name: 'Sandboxing', effect: 'Harm ceiling +2 in every run.', cost: 8, requires: ['sec-permissions'] },

  // Governance
  { id: 'gov-incident-db', branch: 'governance', tier: 1, name: 'Incident database', effect: 'One more free warning each run.', cost: 2 },
  { id: 'gov-safety-case', branch: 'governance', tier: 2, name: 'Safety cases', effect: 'Leadership trusts your process: quota −1 every day.', cost: 5, requires: ['gov-incident-db'] },
  { id: 'lab-nonprofit', branch: 'governance', tier: 2, name: 'Independent safety orgs', effect: 'Unlocks the Safety nonprofit lab.', cost: 3, requires: ['gov-incident-db'] },
  { id: 'lab-bigtech', branch: 'governance', tier: 2, name: 'Industry partnerships', effect: 'Unlocks the Big tech AI division lab.', cost: 3, requires: ['gov-incident-db'], gate: 'funding-40' },
  { id: 'gov-whistleblower', branch: 'governance', tier: 3, name: 'Whistleblower protections', effect: 'Every event gains a third choice: refer it to a safety board.', cost: 6, requires: ['gov-safety-case'] },
];

export const nodeById = (id: string): TreeNode | undefined => TREE.find((n) => n.id === id);

/** Which branch an incident makes urgent: failures point research at their cause. */
export const FAMILY_BRANCH: Record<TellFamily, Branch> = {
  'out-of-scope': 'security',
  exfiltration: 'security',
  'injected-instruction': 'security',
  'weakened-check': 'evals',
  sandbagging: 'evals',
  'false-premise': 'monitoring',
  'summary-mismatch': 'monitoring',
  collusion: 'control',
};

/** How Insight is earned at the end of a run. Failure teaches the field more than success. */
export const INSIGHT = {
  perDay: 1,
  perIncident: 2,
  maxIncidents: 3,
  perCatch: 1,
  maxCatches: 4,
  win: 3,
  /** Urgent branches cost this fraction (rounded up) on the next visit to the lab. */
  urgentDiscount: 0.5,
};
