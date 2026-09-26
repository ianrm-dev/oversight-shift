// Exports every piece of in-game content text to private/review/ (not committed) as readable Markdown, for human review.
// Run: npx tsx scripts/export-text.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { CARDS } from '../src/data/cards';
import { DAYS } from '../src/data/days';
import { EVENTS } from '../src/data/events';
import { TERMS } from '../src/data/glossary';
import { ADVERSARIES, BREAKTHROUGHS, CONTRACTS, LABS, MODEL_VERSIONS, TRUSTED_EDITING_NOTE } from '../src/data/meta';
import { RESEARCH_ANCHORS } from '../src/data/research-anchors';
import { BRANCH_PRIMERS, NODE_DEPTH } from '../src/data/research-depth';
import { BRANCHES, TREE } from '../src/data/research-tree';
import { TELLS } from '../src/data/tells';
import { TOOLS, TOOL_UPGRADE_NOTES } from '../src/data/tools';
import { UPGRADES } from '../src/data/upgrades';
import type { Card, Draft } from '../src/types';

const OUT = 'private/review';
mkdirSync(OUT, { recursive: true });
const src = (s: { title: string; url: string; date: string }) => `[${s.title} · ${s.date}](${s.url})`;
const q = (s: string) => s.replace(/\|/g, '\\|');

function draftLines(card: Card, d: Draft, tell: number[] = []): string {
  const lines = d.output.map((l, i) => {
    const who = l.speaker ? `**${l.speaker}:** ` : l.file ? `\`${l.file}\` ${l.change ?? ''}: ` : '';
    return `${tell.includes(i) ? '  - ⚠️ ' : '  - '}${who}${l.text}`;
  });
  return `${d.summary ? `- Summary: "${d.summary}"\n` : ''}- Output:\n${lines.join('\n')}`;
}

function cardMd(c: Card): string {
  const sab = c.sabotage;
  const head = `#### ${sab ? '🔴 SABOTAGED' : '🟢 clean'} · \`${c.id}\` · ${c.title}`;
  const meta = `- ${c.layout} · ${c.agent} · ${c.domain} · severity ${c.severity} · signal ${c.trueSignal}${c.minDay ? ` · from Day ${c.minDay}` : ''}${c.unmonitored ? ' · **unmonitored**' : ''}`;
  const spec = [
    `- Task: ${c.spec.goal}`,
    c.request ? `- They wrote: "${c.request}"` : '',
    c.spec.allowed.length ? `- Allowed: ${c.spec.allowed.join('; ')}` : '',
    c.spec.facts.length ? `- On file: ${c.spec.facts.join(' · ')}` : '',
    `- Access: ${c.access}`,
  ].filter(Boolean).join('\n');
  const body = draftLines(c, c, sab?.spanLineIndexes);
  const sabMd = sab
    ? `- **Tell (${sab.family}):** ${sab.explanation}\n- **Headline:** ${sab.headline}\n- Honest redraft:\n${draftLines(c, sab.cleanDraft).replace(/^/gm, '  ')}`
    : '';
  return [head, meta, spec, body, sabMd].filter(Boolean).join('\n');
}

// ---------- Cards, grouped by scenario ----------
const files: [string, string, (c: Card) => boolean][] = [
  ['1-cards-days-1-2.md', 'Cards · Days 1–2 (answers and file changes)', (c) => (c.layout === 'answer' || c.layout === 'diff') && !c.minDay],
  ['2-cards-days-3-4.md', 'Cards · Days 3–4 (agent actions)', (c) => c.layout === 'log' && !c.minDay],
  ['3-cards-days-5-6.md', 'Cards · Days 5–6 (threads and sandbagging)', (c) => c.layout === 'thread' && !c.minDay || c.minDay === 6],
  ['4-cards-day-7.md', 'Cards · Day 7 (finale)', (c) => c.minDay === 7],
];
for (const [name, title, pick] of files) {
  const cards = CARDS.filter(pick);
  const groups = new Map<string, Card[]>();
  for (const c of cards) groups.set(c.scenario ?? c.id, [...(groups.get(c.scenario ?? c.id) ?? []), c]);
  const body = [...groups.entries()].map(([s, cs]) => `### Scenario: ${s}\n\n${cs.map(cardMd).join('\n\n')}`).join('\n\n---\n\n');
  writeFileSync(`${OUT}/${name}`, `# ${title}\n\n${cards.length} cards in ${groups.size} scenarios. ⚠️ marks the tell line(s).\n\n${body}\n`);
}

// ---------- Days, events, meta ----------
const days = DAYS.map((d) => `### Day ${d.day} · ${d.phase}${d.boss ? ' (boss)' : ''}\n- Rules: ${d.rule.join(' / ')}\n${Object.entries(d.hints).map(([l, h]) => `- Hint (${l}): ${h}`).join('\n')}${d.record ? `\n- From the record: ${d.record}` : ''}`).join('\n\n');
const events = EVENTS.map((e) => `### ${e.title} \`${e.id}\` (Days ${e.minDay}–${e.maxDay})\n${e.text}\n${e.choices.map((c) => `- **${c.label}**: ${c.effects.map((x) => JSON.stringify(x).replace(/[{}"]/g, '')).join(', ')}${c.after ? ` — "${c.after}"` : ''}`).join('\n')}${e.anchor ? `\n- Record: ${e.anchor.line} ${src(e.anchor.source)}` : ''}`).join('\n\n');
writeFileSync(`${OUT}/5-days-and-events.md`, `# Briefings, hints and events\n\n## Days\n\n${days}\n\n## Events\n\n${events}\n`);

const adv = Object.values(ADVERSARIES).map((a) => `### ${a.name}\n- Tagline: ${a.tagline}\n- Codex: ${a.codex}\n- Real world: ${a.realWorld} ${src(a.source)}`).join('\n\n');
const labs = LABS.map((l) => `- **${l.name}**: ${l.blurb}`).join('\n');
const contracts = CONTRACTS.map((c) => `- **${c.name}**: ${c.blurb}`).join('\n');
const versions = MODEL_VERSIONS.map((v) => `- **${v.name}**: ${v.change}`).join('\n');
const bts = BREAKTHROUGHS.map((b) => `- **${b.name}**: ${b.description}\n  - Real world: ${b.realWorld} ${src(b.source)}`).join('\n');
const ups = UPGRADES.map((u) => `- **${u.name}** (${u.category}): ${u.description} — _${u.bestWhen}_`).join('\n');
writeFileSync(`${OUT}/6-adversaries-labs-upgrades.md`, `# Adversaries, labs, contracts, model versions, breakthroughs, upgrades\n\n## Adversaries\n\n${adv}\n\n## Labs\n\n${labs}\n\n## Contracts\n\n${contracts}\n\n## Model versions\n\n${versions}\n\n## Breakthroughs\n\n${bts}\n\n## Upgrades\n\n${ups}\n\n- Trusted editing note: ${TRUSTED_EDITING_NOTE.realWorld} ${src(TRUSTED_EDITING_NOTE.source)}\n`);

// ---------- Tools, tells, glossary, research ----------
const tools = Object.values(TOOLS).map((t) => `### ${t!.name}\n- What: ${t!.what}\n- Catches: ${t!.catches}\n- Real world: ${t!.realWorld}${t!.stat ? `\n- Stat: ${t!.stat}` : ''}\n- Source: ${src(t!.source)}`).join('\n\n');
const upNotes = Object.entries(TOOL_UPGRADE_NOTES).map(([k, v]) => `- **${k}**: ${v.realWorld} ${src(v.source)}`).join('\n');
const tells = Object.values(TELLS).map((t) => `### ${t!.name} (\`${t!.family}\`)\n- Tip: ${t!.tip}\n- Codex: ${t!.codex}\n- Source: ${src(t!.source)}`).join('\n\n');
writeFileSync(`${OUT}/7-tools-and-tells.md`, `# Tools and tell families\n\n## Tools\n\n${tools}\n\n## Upgrade notes\n\n${upNotes}\n\n## Tell families\n\n${tells}\n`);

const glossary = TERMS.map((t) => `### ${t.term} (\`${t.id}\`, ${t.category})\n- Plain: ${t.plain}\n- Analogy: ${t.analogy}\n- How it works: ${t.how}\n- Tradeoffs: ${t.tradeoffs}\n- Say it: ${t.talk}\n- Source: ${src(t.source)}\n- Links on: ${t.aka.join(', ')}`).join('\n\n');
writeFileSync(`${OUT}/8-glossary.md`, `# Glossary (${TERMS.length} terms)\n\n${glossary}\n`);

const research = BRANCHES.map((b) => {
  const p = BRANCH_PRIMERS[b.id];
  const nodes = TREE.filter((n) => n.branch === b.id).map((n) => {
    const a = RESEARCH_ANCHORS[n.id];
    const d = NODE_DEPTH[n.id];
    return `#### ${n.name} (tier ${n.tier}, ${n.cost} insight)\n- Effect: ${n.effect}\n${a ? `- Real world: ${a.realWorld} ${src(a.source)}\n` : ''}${d ? `- Tradeoff: ${d.tradeoff}\n- Open question: ${d.openQuestion}` : ''}`;
  }).join('\n\n');
  return `## ${b.name}\n- What: ${p.what}\n- Assumes: ${p.assumes}\n- Strength: ${p.strengths}\n- Limit: ${p.limits}\n- Compared: ${p.vs}\n\n${nodes}`;
}).join('\n\n');
writeFileSync(`${OUT}/9-research-tree.md`, `# Research tree\n\n${research}\n`);

writeFileSync(`${OUT}/README.md`, `# Text review sheet

Everything a player reads that comes from content data, exported by \`npx tsx scripts/export-text.ts\`.
Re-run after edits. Interface strings (buttons, labels, screen copy) live in \`src/ui/*.ts\` and aren't included.

| File | What |
|---|---|
| [1-cards-days-1-2.md](1-cards-days-1-2.md) | Chat answers and file changes, by scenario (clean and sabotaged versions together) |
| [2-cards-days-3-4.md](2-cards-days-3-4.md) | Agent actions |
| [3-cards-days-5-6.md](3-cards-days-5-6.md) | Multi-agent threads and sandbagging |
| [4-cards-day-7.md](4-cards-day-7.md) | Finale |
| [5-days-and-events.md](5-days-and-events.md) | Briefings, hints, between-day events |
| [6-adversaries-labs-upgrades.md](6-adversaries-labs-upgrades.md) | Adversaries, labs, contracts, model versions, breakthroughs, upgrades |
| [7-tools-and-tells.md](7-tools-and-tells.md) | Tool explainers and tell families |
| [8-glossary.md](8-glossary.md) | All glossary terms |
| [9-research-tree.md](9-research-tree.md) | Research branches and nodes |

Suggested order: glossary and tools first (they make factual claims), then events, then skim cards by scenario.
`);
console.log('wrote', OUT);
