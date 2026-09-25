import type { Upgrade } from '../types';

// Upgrades the engine applies today. The rest of the DESIGN.md pool (Monitor rationale,
// Untrusted monitor, Paired resample, Paraphraser, Canary) arrives with Days 5–7.
export const UPGRADES: Upgrade[] = [
  {
    id: 'scope-lens',
    name: 'Scope lens',
    category: 'information',
    description: "Files the output changes outside the task's allowed list get underlined.",
    bestWhen: 'Best on file-change days',
  },
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
    description: '+1 auditor hour every day.',
    bestWhen: 'Always solid',
  },
  {
    id: 'catch-bonus',
    name: 'Catch bonus',
    category: 'budget',
    description: 'When an Audit catches sabotage, you get the auditor hour back.',
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
    description: 'A copy of the strong model scores each card too: sharper, but it may collude from Day 5.',
    bestWhen: 'High risk, high reward',
  },
  {
    id: 'paired-resample',
    name: 'Paired resample',
    category: 'action',
    description: 'After a Resample, lines that changed between drafts are marked.',
    bestWhen: 'Best against sandbagging',
  },
  {
    id: 'paraphraser',
    name: 'Paraphraser',
    category: 'action',
    description: 'Rewords messages between agents, breaking hidden signals. Collusion reads higher; the untrusted monitor stays honest.',
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
];

export const upgradeById = (id: string): Upgrade | undefined => UPGRADES.find((u) => u.id === id);
