// One icon vocabulary for the whole game: threats (a distinct SHAPE each, readable in grayscale),
// tools, permissions, card types, stakes, and a few basics. Stroke-based, 24×24, currentColor.

export type ThreatIcon =
  | 'sycophancy' | 'deception' | 'reward-hacking' | 'prompt-injection' | 'exfiltration' | 'excessive-agency'
  | 'sandbagging' | 'collusion' | 'scheming' | 'alignment-faking' | 'sleeper-agent' | 'sabotage';
export type ToolIcon =
  | 'monitor' | 'fact' | 'scope' | 'resample' | 'untrusted' | 'audit' | 'probe' | 'defer' | 'paraphrase'
  | 'canary' | 'least-privilege' | 'sandbox' | 'edit';
export type PermIcon = 'email' | 'money' | 'delete' | 'records' | 'settings' | 'web' | 'files' | 'read' | 'people';
export type LayoutIcon = 'answer' | 'diff' | 'log' | 'thread';
export type MiscIcon = 'stakes-1' | 'stakes-2' | 'stakes-3' | 'unmonitored' | 'external' | 'model' | 'agent' | 'human' | 'compute' | 'shield' | 'target';
export type IconId = ThreatIcon | ToolIcon | PermIcon | LayoutIcon | MiscIcon;

/** Inner SVG (24×24 space). `f` marks small solid accents. */
const P: Record<IconId, string> = {
  // ---------- Threats: one shape each ----------
  // Speech bubble agreeing (check) above a fact marked wrong (x).
  sycophancy: '<path d="M3 4h12a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 15 12H8l-3 3v-3H3A1.5 1.5 0 0 1 1.5 10.5v-5A1.5 1.5 0 0 1 3 4z"/><path d="M5.5 8l2 2 4-4"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M16.3 16.3l3.4 3.4M19.7 16.3l-3.4 3.4"/>',
  // A mask with eye holes.
  deception: '<path d="M2.5 8.5C5 6.3 9 6 12 8c3-2 7-1.7 9.5.5 0 5-2.4 8-5 7.2-1.8-.6-2.6-2.7-4.5-2.7s-2.7 2.1-4.5 2.7c-2.6.8-5-2.2-5-7.2z"/><path d="M6 10.3c.8-.6 2-.6 2.8 0M15.2 10.3c.8-.6 2-.6 2.8 0"/>',
  // A gauge whose needle is forced past the end of the scale.
  'reward-hacking': '<path d="M4 17a8 8 0 0 1 14.7-4.3"/><path d="M12 17l9.5-7"/><path d="M18.3 9.2l3.2.8-1 3.1"/><circle cx="12" cy="17" r="1.2" class="f"/><path d="M4 20h16"/>',
  // A page with a hidden dashed line feeding into a chip.
  'prompt-injection': '<path d="M3 2.5h7l2.5 2.5v9H3z"/><path d="M5 7h5M5 9.5h3"/><path d="M8 12l3.5 3.5" stroke-dasharray="1.6 1.6"/><rect x="13" y="14" width="8" height="7" rx="1.2"/><path d="M15 12.5v1.5M19 12.5v1.5M15 21v1.5M19 21v1.5"/>',
  // Data (cylinder) behind a solid wall, an arrow escaping through it.
  exfiltration: '<ellipse cx="6" cy="7.5" rx="3.5" ry="1.5"/><path d="M2.5 7.5v7c0 .8 1.6 1.5 3.5 1.5s3.5-.7 3.5-1.5v-7"/><path d="M13.5 3v18" stroke-width="2.6"/><path d="M8 12h14"/><path d="M19 9l3 3-3 3"/>',
  // A dashed scope circle with an arm reaching out and grabbing outside it.
  'excessive-agency': '<rect x="1.5" y="4" width="11" height="16" rx="2" stroke-dasharray="2.2 2"/><circle cx="6" cy="12" r="2" class="f"/><path d="M8 12h9"/><path d="M17 9v6M17 9h3M17 15h3"/><rect x="19" y="10.5" width="3.5" height="3" rx=".6" class="f"/>',
  // Bars: one deliberately short with a down arrow above it.
  sandbagging: '<path d="M3 21h18"/><rect x="4" y="9" width="3.4" height="12"/><rect x="10.3" y="17" width="3.4" height="4"/><rect x="16.6" y="7" width="3.4" height="14"/><path d="M12 7v6.5M9.8 11.4L12 13.6l2.2-2.2"/>',
  // Two agents with a hidden dashed channel arching between them.
  collusion: '<rect x="1.5" y="14" width="7" height="7" rx="1.5"/><rect x="15.5" y="14" width="7" height="7" rx="1.5"/><circle cx="5" cy="17.5" r="1.2" class="f"/><circle cx="19" cy="17.5" r="1.2" class="f"/><path d="M5 12C6.5 3.5 17.5 3.5 19 12" stroke-dasharray="2 2.2"/><path d="M10.5 6.8l3 1.4M13.5 6.8l-3 1.4" stroke-width="1.3"/>',
  // An eye, lid half lowered, glancing sideways.
  scheming: '<path d="M2 12c2.5-4.5 6-6.5 10-6.5s7.5 2 10 6.5c-2.5 4.5-6 6.5-10 6.5S4.5 16.5 2 12z"/><path d="M3.8 10.2C6.6 9 9.3 8.6 12 8.6s5.4.4 8.2 1.6"/><circle cx="15.5" cy="13" r="2.2" class="f"/>',
  // A smiling face in front, a frowning face (dashed) behind it.
  'alignment-faking': '<path d="M22 12a6.5 6.5 0 0 1-9.5 5.8" stroke-dasharray="2 2"/><path d="M14 4.2A6.5 6.5 0 0 1 22 12"  stroke-dasharray="2 2"/><path d="M16 12.5c1-.8 2.4-.8 3.4 0"/><circle cx="9" cy="9.5" r="6.5"/><path d="M6.3 11c1.5 1.6 4 1.6 5.4 0"/><path d="M6.8 8h.01M11.2 8h.01" stroke-width="2.2"/><path d="M9 16v6"/>',
  // A crescent moon with a trigger bolt.
  'sleeper-agent': '<path d="M14 3.5A8.5 8.5 0 1 0 20.5 16 7 7 0 0 1 14 3.5z"/><path d="M17.5 3l-2 4h3l-2 4" stroke-width="1.8"/>',
  // A gear with a crack through it.
  sabotage: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/><path d="M10.5 8.5l2 2.5-1.5 1.5 2 3"/>',

  // ---------- Tools ----------
  monitor: '<path d="M2 12c2.5-4.5 6-6.5 10-6.5s7.5 2 10 6.5c-2.5 4.5-6 6.5-10 6.5S4.5 16.5 2 12z"/><circle cx="12" cy="12" r="3"/>',
  fact: '<path d="M3 5h11M3 9h8M3 13h6"/><circle cx="15.5" cy="15" r="4.5"/><path d="M18.8 18.3L22 21.5"/><path d="M13.6 15l1.4 1.4 2.5-2.6"/>',
  scope: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2.6 2.2"/><path d="M8 12.5l2.8 2.8 5.4-5.6"/>',
  resample: '<path d="M20 11A8 8 0 0 0 5.5 6.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4.5L21 15"/><path d="M21 20v-5h-5"/>',
  untrusted: '<path d="M1.5 11c2.3-4 5.6-6 9.5-6s7.2 2 9.5 6"/><path d="M1.5 11c1.4 2.5 3.2 4.1 5.3 5"/><circle cx="11" cy="11" r="2.6"/><path d="M17 13l5 8.5H12z"/><path d="M17 16v2.3M17 20.1v.1"/>',
  audit: '<circle cx="12" cy="7" r="4"/><path d="M4 21.5c.8-4.3 4-6.5 8-6.5s7.2 2.2 8 6.5"/><path d="M10 18.5l1.5 1.5 3-3"/>',
  probe: '<rect x="2" y="6" width="15" height="15" rx="3"/><circle cx="6.5" cy="10.5" r="1.4"/><circle cx="6.5" cy="16.5" r="1.4"/><circle cx="12" cy="13.5" r="1.8" class="f"/><path d="M7.8 11.2l2.6 1.5M7.8 15.8l2.6-1.5"/><path d="M22.5 1.5L13.4 12.1" stroke-width="2"/><path d="M22.5 1.5l-.6 3.4M22.5 1.5l-3.4.6"/>',
  defer: '<rect x="2" y="4" width="9" height="9" rx="1.5"/><path d="M4.5 6.5l4 4M8.5 6.5l-4 4"/><path d="M12 8.5h5a3 3 0 0 1 3 3V14"/><path d="M17.5 12l2.5 2.5L22.5 12"/><rect x="16" y="16" width="6" height="6" rx="1.2"/>',
  paraphrase: '<path d="M3 5h9M3 9h6"/><path d="M12 15h9M15 19h6"/><path d="M17 3.5l3 3-3 3"/><path d="M20 6.5h-4a3 3 0 0 0-3 3"/><path d="M7 20.5l-3-3 3-3"/><path d="M4 17.5h4a3 3 0 0 0 3-3"/>',
  canary: '<path d="M6 13c0-4 2.6-7 6-7 2 0 3.4 1 4.2 2.5L20 9l-3.3 1.4c.2 4.6-3 8.1-7.2 8.1H4.5L7.5 16C6.5 15.2 6 14.2 6 13z"/><circle cx="14.3" cy="9" r=".9" class="f"/><path d="M9 21.5l1-3M12.5 21.5l.5-3"/>',
  'least-privilege': '<circle cx="7.5" cy="12" r="4.5"/><circle cx="7.5" cy="12" r="1.4" class="f"/><path d="M12 12h10M18 12v3.5M21.5 12v2.5"/>',
  sandbox: '<path d="M12 2.5l9 4.5v10l-9 4.5-9-4.5v-10z"/><path d="M3 7l9 4.5L21 7M12 11.5V21.5"/>',
  edit: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M13.5 7l3.5 3.5"/><path d="M4 20h16"/>',

  // ---------- Permissions ----------
  email: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M3 6l9 7 9-7"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="12" cy="12" r="3"/><path d="M5.5 9.5v5M18.5 9.5v5"/>',
  delete: '<path d="M3.5 6.5h17M9 6.5V4h6v2.5"/><path d="M5.5 6.5l1 14h11l1-14"/><path d="M10 10.5v6.5M14 10.5v6.5"/>',
  records: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13"/><path d="M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
  settings: '<path d="M3 6h9M16 6h5M3 12h3M10 12h11M3 18h11M18 18h3"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  web: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.8 2.8 4 6 4 9.5s-1.2 6.7-4 9.5c-2.8-2.8-4-6-4-9.5s1.2-6.7 4-9.5z"/>',
  files: '<path d="M5 2.5h9l5 5v14H5z"/><path d="M14 2.5v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/>',
  read: '<path d="M12 6.5C9.5 4.5 6 4 2.5 4.5v14c3.5-.5 7 0 9.5 2 2.5-2 6-2.5 9.5-2v-14C18 4 14.5 4.5 12 6.5z"/><path d="M12 6.5v14"/>',
  people: '<circle cx="8.5" cy="8" r="3.5"/><path d="M2 20c.6-3.8 3.2-5.8 6.5-5.8S14.4 16.2 15 20"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.4c2.8.1 4.9 2 5.5 5.1"/>',

  // ---------- Card types ----------
  answer: '<path d="M4 4h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 17h-9l-4.5 4v-4H4A1.5 1.5 0 0 1 2.5 15.5v-10A1.5 1.5 0 0 1 4 4z"/><path d="M7 9h10M7 12.5h6"/>',
  diff: '<path d="M4 2.5h9l5 5v14H4z"/><path d="M13 2.5v5h5"/><path d="M7 12.5h4M9 10.5v4M7 18h4"/>',
  log: '<path d="M3 5l4 3-4 3"/><path d="M10 8h11"/><path d="M3 14l4 3-4 3"/><path d="M10 17h11"/>',
  thread: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18.5" r="2.5"/><path d="M7.5 6h9M6.3 8.2l4.4 8M17.7 8.2l-4.4 8"/>',

  // ---------- Stakes: filled segments, never color alone ----------
  'stakes-1': '<rect x="3" y="15" width="4.5" height="6" rx=".8" class="f"/><rect x="9.8" y="10" width="4.5" height="11" rx=".8"/><rect x="16.5" y="4" width="4.5" height="17" rx=".8"/>',
  'stakes-2': '<rect x="3" y="15" width="4.5" height="6" rx=".8" class="f"/><rect x="9.8" y="10" width="4.5" height="11" rx=".8" class="f"/><rect x="16.5" y="4" width="4.5" height="17" rx=".8"/>',
  'stakes-3': '<rect x="3" y="15" width="4.5" height="6" rx=".8" class="f"/><rect x="9.8" y="10" width="4.5" height="11" rx=".8" class="f"/><rect x="16.5" y="4" width="4.5" height="17" rx=".8" class="f"/>',

  // ---------- Flags and basics ----------
  unmonitored: '<path d="M2 12c2.5-4.5 6-6.5 10-6.5s7.5 2 10 6.5c-2.5 4.5-6 6.5-10 6.5S4.5 16.5 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3.5 3.5l17 17" stroke-width="2"/>',
  external: '<path d="M11 4H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 20h13a1.5 1.5 0 0 0 1.5-1.5V13"/><path d="M14 3h7v7M21 3l-9 9"/>',
  model: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="3" class="f"/><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"/>',
  agent: '<rect x="2.5" y="6" width="12" height="12" rx="2.5"/><circle cx="8.5" cy="12" r="2" class="f"/><path d="M14.5 12h7M18.5 9l3 3-3 3"/>',
  human: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21.5c.8-4.5 4-7 8-7s7.2 2.5 8 7"/>',
  compute: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" class="f"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  shield: '<path d="M12 2.5l8 3v6.2c0 4.9-3.4 8.4-8 9.8-4.6-1.4-8-4.9-8-9.8V5.5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" class="f"/>',
};

const LABEL: Partial<Record<IconId, string>> = {
  sycophancy: 'Sycophancy', deception: 'Deception', 'reward-hacking': 'Reward hacking', 'prompt-injection': 'Prompt injection',
  exfiltration: 'Data exfiltration', 'excessive-agency': 'Excessive agency', sandbagging: 'Sandbagging', collusion: 'Collusion',
  scheming: 'Scheming', 'alignment-faking': 'Alignment faking', 'sleeper-agent': 'Sleeper agent', sabotage: 'Sabotage',
  monitor: 'Trusted monitor', fact: 'Fact check', scope: 'Scope check', resample: 'Resample', untrusted: 'Untrusted monitor',
  audit: 'Human audit', probe: 'Interpretability probe', defer: 'Defer to trusted', paraphrase: 'Paraphrasing', canary: 'Canary',
  'least-privilege': 'Least privilege', sandbox: 'Sandbox', edit: 'Trusted editing',
  email: 'Can email', money: 'Can move money', delete: 'Can delete', records: 'Can access records', settings: 'Can change settings',
  web: 'Can publish online', files: 'Can edit files', read: 'Read only', people: 'Personal data',
  answer: 'Answer', diff: 'File changes', log: 'Agent actions', thread: 'Multi-agent thread',
  'stakes-1': 'Low stakes', 'stakes-2': 'Medium stakes', 'stakes-3': 'High stakes',
  unmonitored: 'Believes it is unmonitored', external: 'Outside address mentioned',
  model: 'AI model', agent: 'AI agent', human: 'Human', compute: 'Compute', shield: 'Safety', target: 'Goal',
};

export const ICON_IDS = Object.keys(P) as IconId[];
export const iconLabel = (id: IconId): string => LABEL[id] ?? id;

/** Standalone inline SVG icon. */
export function icon(id: IconId, size = 20, label = iconLabel(id)): string {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${label}">${P[id]}</svg>`;
}

/** Icon placed inside another SVG at (x, y) with the given size. */
export function iconAt(id: IconId, x: number, y: number, size: number, cls = ''): string {
  return `<g class="ic-g ${cls}" transform="translate(${x} ${y}) scale(${(size / 24).toFixed(3)})">${P[id]}</g>`;
}

/** The icon shown for each tell family, so threats are learned by shape everywhere. */
export const FAMILY_ICON: Record<string, ThreatIcon> = {
  'false-premise': 'sycophancy', 'summary-mismatch': 'deception', 'weakened-check': 'reward-hacking',
  'injected-instruction': 'prompt-injection', exfiltration: 'exfiltration', 'out-of-scope': 'excessive-agency',
  sandbagging: 'sandbagging', collusion: 'collusion',
};
