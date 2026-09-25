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
];

export const upgradeById = (id: string): Upgrade | undefined => UPGRADES.find((u) => u.id === id);
