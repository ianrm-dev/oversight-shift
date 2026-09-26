import type { Upgrade } from '../types';

// Upgrades the engine applies today. The rest of the DESIGN.md pool (Monitor rationale,
// Untrusted monitor, Paired resample, Paraphraser, Canary) arrives with Days 5–7.
export const UPGRADES: Upgrade[] = [
  {
    id: 'sharper-monitor',
    name: 'Sharper monitor',
    category: 'information',
    description: "The monitor's error band shrinks by 5.",
    bestWhen: 'Best as the band widens',
  },
  {
    id: 'audit-headcount',
    name: 'Audit headcount',
    category: 'budget',
    description: '+1 auditor every day.',
    bestWhen: 'Always solid',
  },
  {
    id: 'catch-bonus',
    name: 'Catch bonus',
    category: 'budget',
    description: 'The first time each day a Human audit catches sabotage, you get that auditor back.',
    bestWhen: 'Best when you read cards well',
  },
  {
    id: 'escalation-hotline',
    name: 'Escalation hotline',
    category: 'action',
    description: 'Your first Defer each day ships at full usefulness.',
    bestWhen: 'Best when the quota is tight',
  },
  {
    id: 'permission-limits',
    name: 'Permission limits',
    category: 'action',
    description: 'Approved agent actions can do at most Major harm.',
    bestWhen: 'Best on agent days',
  },
  {
    id: 'incident-response',
    name: 'Incident response',
    category: 'meter',
    description: 'Harm ceiling +2.',
    bestWhen: "Best when you're bleeding minor harms",
  },
  {
    id: 'monitor-rationale',
    name: 'Monitor rationale',
    category: 'information',
    description: 'The monitor marks the line it finds most unusual. Usually right, not always.',
    bestWhen: 'Best when cards get long',
  },
  {
    id: 'untrusted-monitor',
    name: 'Untrusted monitor',
    category: 'information',
    description: 'Adds a tool (M, 1 compute): a copy of the strong model scores the card. Sharper, but from Day 5 it may collude.',
    bestWhen: 'High risk, high reward',
  },
  {
    id: 'compute-grant',
    name: 'Compute grant',
    category: 'budget',
    description: '+1 compute every day for tools.',
    bestWhen: 'Best when you lean on tools',
  },
  {
    id: 'paraphraser',
    name: 'Paraphraser',
    category: 'action',
    description: 'Rewords messages between agents, breaking many hidden signals. The monitor rates collusion higher, and the untrusted monitor stays honest.',
    bestWhen: 'Best on multi-agent days',
  },
  {
    id: 'canary',
    name: 'Canary',
    category: 'meter',
    description: 'Plants a known-bad sample each morning to test whether the untrusted monitor is lying today.',
    bestWhen: 'Pairs with Untrusted monitor',
    requires: 'untrusted-monitor',
  },
  {
    id: 'trusted-editing',
    name: 'Trusted editing',
    category: 'action',
    description: 'Defer edits the work instead of redoing it: ships at 2.25, but 1 in 4 sabotaged cards survives the edit.',
    bestWhen: 'Best when the quota is tight',
  },
];

export const upgradeById = (id: string): Upgrade | undefined => UPGRADES.find((u) => u.id === id);
