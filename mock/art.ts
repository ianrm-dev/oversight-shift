// Gallery for the icon set, term pictures and at-a-glance strips. Mock only.
import '../src/fonts';
import '../src/theme.css';
import '../src/ui.css';
import '../src/visual/art.css';
import './mock.css';
import { CARDS } from '../src/data/cards';
import { TERMS } from '../src/data/glossary';
import { glance } from '../src/visual/glance';
import { ICON_IDS, icon, iconLabel } from '../src/visual/icons';
import { termArt } from '../src/visual/term-art';

const params = new URLSearchParams(location.search);
const size = Number(params.get('size') ?? 24);
const only = params.get('only');
if (only) document.querySelectorAll<HTMLElement>('.ag-sec').forEach((s) => { s.hidden = s.id !== only; });

const groups: [string, string[]][] = [
  ['Threats', ['sycophancy', 'deception', 'reward-hacking', 'prompt-injection', 'exfiltration', 'excessive-agency', 'sandbagging', 'collusion', 'scheming', 'alignment-faking', 'sleeper-agent', 'sabotage']],
  ['Tools', ['monitor', 'fact', 'scope', 'resample', 'untrusted', 'audit', 'probe', 'defer', 'paraphrase', 'canary', 'least-privilege', 'sandbox', 'edit']],
  ['Permissions', ['email', 'money', 'delete', 'records', 'settings', 'web', 'files', 'read', 'people']],
  ['Card types, stakes, flags, basics', ICON_IDS.filter((id) => !['sycophancy', 'deception', 'reward-hacking', 'prompt-injection', 'exfiltration', 'excessive-agency', 'sandbagging', 'collusion', 'scheming', 'alignment-faking', 'sleeper-agent', 'sabotage', 'monitor', 'fact', 'scope', 'resample', 'untrusted', 'audit', 'probe', 'defer', 'paraphrase', 'canary', 'least-privilege', 'sandbox', 'edit', 'email', 'money', 'delete', 'records', 'settings', 'web', 'files', 'read', 'people'].includes(id))],
];
document.querySelector('#icon-grid')!.innerHTML = groups.map(([name, ids]) => `
  <h3>${name}</h3>
  <div class="ag-icons">${ids.map((id) => `<figure class="ag-icon">${icon(id as never, size)}${icon(id as never, 16)}<figcaption>${iconLabel(id as never)}</figcaption></figure>`).join('')}</div>`).join('');

document.querySelector('#term-grid')!.innerHTML = TERMS.map((t) => `
  <figure class="ag-term">${termArt(t.id, { animate: true, label: t.term })}<figcaption><strong>${t.term}</strong><span>${t.plain}</span></figcaption></figure>`).join('');

const pick = (layout: string, n: number) => CARDS.filter((c) => c.layout === layout).filter((_, i) => i % 3 === 0).slice(0, n);
const cards = [...pick('answer', 5), ...pick('diff', 5), ...pick('log', 6), ...pick('thread', 4), ...CARDS.filter((c) => c.unmonitored).slice(0, 2)];
document.querySelector('#glance-list')!.innerHTML = cards.map((c) => `
  <div class="ag-glance"><code>${c.id}</code><span class="muted">${c.access}</span>${glance(c)}</div>`).join('');
