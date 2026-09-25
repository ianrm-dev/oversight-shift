import type { Upgrade } from '../types';

// Placeholder: the full pool of 12 comes from DESIGN.md.
export const UPGRADES: Upgrade[] = [
  {
    id: 'monitor-rationale',
    name: 'Monitor rationale',
    category: 'information',
    description: 'Each score comes with a one-line reason.',
    bestWhen: 'Early days',
  },
  {
    id: 'audit-headcount',
    name: 'Audit headcount',
    category: 'budget',
    description: '+1 Audit per day.',
    bestWhen: 'Always solid',
  },
];
