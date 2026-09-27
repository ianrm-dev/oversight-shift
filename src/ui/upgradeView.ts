// How upgrades look: an icon, what they improve, and a compact chip for slots and the in-play loadout row.
import { upgradeById } from '../data/upgrades';
import type { IconId } from '../visual/icons';
import { icon } from '../visual/icons';

export const UPGRADE_ICON: Record<string, IconId> = {
  'sharper-monitor': 'monitor', 'monitor-rationale': 'monitor', 'untrusted-monitor': 'untrusted',
  'audit-headcount': 'audit', 'catch-bonus': 'target', 'compute-grant': 'compute', 'escalation-hotline': 'defer',
  'trusted-editing': 'edit', 'permission-limits': 'least-privilege', paraphraser: 'paraphrase', canary: 'canary',
  'incident-response': 'shield', overtime: 'people', 'fast-track': 'read',
};

/** Which part of your toolkit an upgrade improves. */
export const UPGRADE_IMPROVES: Record<string, string> = {
  'sharper-monitor': 'Trusted monitor', 'monitor-rationale': 'Trusted monitor',
  'untrusted-monitor': 'A new tool', 'audit-headcount': 'Human audit', 'catch-bonus': 'Human audit',
  'compute-grant': 'Compute', 'escalation-hotline': 'Defer', 'trusted-editing': 'Defer',
  'permission-limits': 'Agent actions', paraphraser: 'Agent teams', canary: 'Untrusted monitor', 'incident-response': 'Harm ceiling',
  overtime: 'Shift clock', 'fast-track': 'Approve',
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

/** A small labeled chip: icon + name, with the description as a tooltip. */
export function upgradeChip(id: string, extra = ''): string {
  const u = upgradeById(id);
  if (!u) return '';
  return `<span class="up-chip cat-${u.category}" title="${esc(`${u.name}: ${u.description}`)}"${extra}>${icon(UPGRADE_ICON[id] ?? 'shield', 16)}<span>${esc(u.name)}</span></span>`;
}

export const upgradeIcon = (id: string, size = 18): string => {
  const u = upgradeById(id);
  return u ? `<span class="up-icon cat-${u.category}" title="${esc(`${u.name}: ${u.description}`)}">${icon(UPGRADE_ICON[id] ?? 'shield', size)}</span>` : '';
};
