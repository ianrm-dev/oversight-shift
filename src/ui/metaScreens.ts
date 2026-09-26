// Screens for the roguelike layer: setup, codex, events, breakthroughs, contracts, and the end-of-run reveal.
import { ADVERSARIES, CONTRACTS, LABS, MODEL_VERSIONS } from '../data/meta';
import { RESEARCH_ANCHORS } from '../data/research-anchors';
import { BRANCHES, GATE_TEXT, TREE, nodeById } from '../data/research-tree';
import { TELLS } from '../data/tells';
import type { Progress, RunUpdate } from '../game/progress';
import { availableCount, branchName, gradeFor, nodeCost, nodeState } from '../game/progress';
import type { RunState } from '../game/state';
import { eventChoices } from '../game/state';
import { RULES } from '../rules';
import type { Breakthrough, Contract, Difficulty, Effect, GameEvent, TellFamily } from '../types';
import { esc } from './render';
import { chip, linkProse, linkTerms } from './terms';
import { BREAKTHROUGH_TERM, EVENT_TERMS } from '../data/term-links';
import { BRANCH_PRIMERS, NODE_DEPTH } from '../data/research-depth';

export interface Setup {
  difficulty: Difficulty;
  lab: string;
  level: number;
  /** Quick shift: Days 1, 3, 5 and 7 only. */
  quick?: boolean;
}

const DIFFS: Difficulty[] = ['guided', 'standard', 'analyst'];
const labUnlocked = (p: Progress, unlock?: string) => !unlock || p.research.includes(unlock);

// ---------- Title ----------
export function title(p: Progress): string {
  const runs = p.history.length;
  return `
    <main class="solo title">
      <div data-glyph="${Math.min(9, 6 + p.maxModel)}" data-size="148" class="title-glyph"></div>
      <h1 class="title-name">Oversight Shift</h1>
      <p class="title-tag">Your lab is deploying a model smarter than the tools watching it.<br/>Keep its work shipping. Keep what it breaks below the line.</p>
      <button class="menu-start" data-go="setup">
        <span class="menu-start-name"><kbd>Enter</kbd> New shift</span>
        <span class="menu-start-desc">A quick shift takes about 15 minutes. Pick a difficulty, then play.</span>
      </button>
      <div class="title-menu">
        <button class="menu-opt" data-go="daily-info">
          <span class="menu-name"><kbd>D</kbd> Daily shift</span>
          <span class="menu-desc">Today's shared run: same cards for everyone, one score to beat.</span>
        </button>
        <button class="menu-opt" data-go="lab">
          <span class="menu-name"><kbd>L</kbd> Research lab${availableCount(p) ? ` <span class="badge">${availableCount(p)}</span>` : ''}</span>
          <span class="menu-desc">${p.insight ? `${p.insight} insight to spend. ` : ''}Research from past runs carries into every run.</span>
        </button>
        <button class="menu-opt" data-go="guide">
          <span class="menu-name"><kbd>G</kbd> Field guide</span>
          <span class="menu-desc">${runs ? `${Object.keys(p.termsSeen).length} terms met. ` : ''}Terms, research approaches and your past runs.</span>
        </button>
      </div>
      <p class="title-note">Keyboard or mouse · no expertise needed: read the work, check what you can, and make the call</p>
      <p class="title-fiction">Every person, organization, address and number in the game is made up.</p>
      <div class="title-links"><button class="link-btn" data-go="made"><kbd>H</kbd> How this was made</button><button class="link-btn" data-feedback="open"><kbd>F</kbd> Send feedback</button></div>
    </main>`;
}

// ---------- How this was made: the AI-use disclosure ----------
export function howMade(): string {
  const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  return `
    <main class="solo made">
      <div class="cx-top"><div><span class="eyebrow">Mangrove Game Night · Sep 25–27, 2026</span><h2>How this was made</h2></div><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button></div>
      <p class="made-intro">I designed and directed this game. Claude Code (Anthropic's Claude Opus 5.5) wrote the code and drafted most of the text, and I reviewed and redirected it at every step. Here is who did what.</p>
      <div class="made-grid">
        <section><h3>What I did</h3>${list([
          'Chose the concept: you run an AI-control protocol on shift, grounded in real research and incidents, escalating from one model to agents to teams of agents.',
          'Set the direction: first, control tools that do the detecting so anyone can play; then, after playtesting showed they had become a crutch, scarce tools and a tight clock, so reading and triage decide the run. No AI background needed; failed runs drive research, as they do in the field.',
          'Playtested and reported what felt wrong, like an unwinnable quota, a strategy that won too easily, and cards no real person would ask.',
          'Made the calls on names, wording and simplifications. The probe is always right in this game; real ones aren\'t.',
          'Set the questions every card is held to (a real use of AI, human sense, a clear threat, fictional details, no giveaways) and reviewed the text.',
        ])}</section>
        <section><h3>What Claude did</h3>${list([
          'Wrote all of the game code: the engine, the screens, the visuals, a balance simulator and test fuzzers.',
          'Drafted the cards, tool explainers, glossary and research notes, checking each real-world claim against its source. It audited every card against my questions and tied each sabotaged one to a real incident or published test.',
          'Tested it: bots played tens of thousands of runs to check that every day can be won and to tune the numbers.',
          'Before kickoff, in a separate Claude conversation: research on similar games and on AI control, concept options and a build plan. No game code was written before kickoff.',
        ])}</section>
        <section><h3>Drawn in code</h3>${list([
          'No image-model art. The network lattice, the model glyph that grows each day, the situation diagrams, icons and term pictures are all SVG generated by code.',
          'Fonts: IBM Plex Sans and Mono, open source and served with the game.',
          'Every person, organization, address and number on the cards is made up; the research and incidents they point to are real.',
          'No cookies or tracking. When a run starts and ends, the game requests a tiny file from this site so I can count plays, and Send feedback reaches me the same way. Your progress stays in your browser.',
        ])}</section>
      </div>
      <p class="made-foot">Every tool, threat and term cites the paper or incident it's based on: press <kbd>T</kbd> during a shift, or open the Field guide. The full build log is <span class="mono">docs/AI_USE_LOG.md</span> in the source at <span class="mono">github.com/ianrm-dev/oversight-shift</span>. Code: MIT license. Cards, glossary and other content: CC BY-NC-SA 4.0.</p>
    </main>`;
}

// ---------- Daily shift: explain before starting ----------
export function dailyInfo(p: Progress, seed: string, dateLabel: string): string {
  const best = p.daily[seed];
  return `
    <main class="solo daily-info">
      <article class="event-card">
        <div class="eyebrow">Daily shift · ${esc(dateLabel)}</div>
        <h2 class="event-title">Everyone gets today's run</h2>
        <p class="event-text">Today's daily uses the same cards, events and hidden adversary for every player, so scores can be compared. A new one starts at midnight.</p>
        <ul class="daily-rules">
          <li><strong>Standard</strong> difficulty, <strong>Frontier lab</strong>, <strong>Model v1</strong></li>
          <li>Your research doesn't apply, so everyone starts equal. The run still earns Insight and Field guide entries.</li>
          <li>Replay it as often as you like. Your best score today counts.</li>
        </ul>
        ${best !== undefined ? `<p class="event-text">Your best today: <strong class="mono">${best}</strong> (${gradeFor(best)})</p>` : ''}
        <div class="setup-actions"><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button><button class="btn-primary btn-lg" data-go="daily"><kbd>Enter</kbd> Start today's shift</button></div>
      </article>
    </main>`;
}

// ---------- Setup ----------
export function setup(p: Progress, s: Setup): string {
  const diffs = DIFFS.map((k, i) => {
    const D = RULES.difficulty[k];
    return `<button class="diff-opt${k === s.difficulty ? ' is-selected' : ''}" data-difficulty="${k}"><kbd>${i + 1}</kbd><span class="diff-name">${D.label}${k === 'guided' ? ' <small>first shift</small>' : ''}</span><span class="diff-blurb">${linkTerms(D.blurb, 1)}</span></button>`;
  }).join('');
  const labs = LABS.map((l) => {
    const open = labUnlocked(p, l.unlock);
    const node = l.unlock ? nodeById(l.unlock) : undefined;
    return `<button class="lab-opt${l.id === s.lab ? ' is-selected' : ''}" data-lab="${l.id}" ${open ? '' : 'disabled'}>
      <span class="diff-name">${esc(l.name)}</span>
      <span class="diff-blurb">${open ? linkTerms(l.blurb, 1) : `Locked · research “${esc(node?.name ?? '')}”`}</span>
    </button>`;
  }).join('');
  const versions = MODEL_VERSIONS.map((v) => {
    const open = v.level <= p.maxModel;
    return `<button class="ver-opt${v.level === s.level ? ' is-selected' : ''}" data-level="${v.level}" ${open ? '' : 'disabled'} title="${esc(v.change)}"><strong>v${v.level}</strong></button>`;
  }).join('');
  const current = MODEL_VERSIONS.find((v) => v.level === s.level);
  return `
    <main class="solo setup">
      <h2 class="setup-title">New shift</h2>
      <section class="setup-row"><span class="eyebrow">Difficulty</span><div class="diff-picker">${diffs}</div></section>
      <section class="setup-row"><span class="eyebrow">Length <kbd>Q</kbd></span>
        <div class="len-picker">
          <button class="len-opt${s.quick ? '' : ' is-selected'}" data-length="full"><strong>Full week</strong><span>All 7 days</span></button>
          <button class="len-opt${s.quick ? ' is-selected' : ''}" data-length="quick"><strong>Quick shift</strong><span>A demo: Days 1, 3, 5 and 7 on a fast clock</span></button>
        </div>
      </section>
      ${s.quick
        ? `<p class="setup-quick-note">The quick shift is a demo: it always uses Frontier lab and Model v1, your research doesn't apply, and it earns no Insight. Play the full week to research, unlock labs and face stronger models.</p>`
        : `<section class="setup-row"><span class="eyebrow">Your lab</span><div class="lab-picker">${labs}</div></section>
      <section class="setup-row"><span class="eyebrow">Model version</span>
        <div class="ver-row"><div class="ver-picker">${versions}</div><p class="ver-change">${linkTerms(current?.change ?? '', 1)}${p.maxModel < 5 ? ` <span class="muted">Win on v${p.maxModel} to face v${p.maxModel + 1}.</span>` : ''}</p></div>
      </section>`}
      <div class="setup-actions"><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button><button class="btn-primary btn-lg" data-start><kbd>Enter</kbd> Start shift</button></div>
    </main>`;
}

// ---------- Codex ----------
export function codex(p: Progress): string {
  const families = Object.keys(TELLS) as TellFamily[];
  const tells = families.map((f) => {
    const t = TELLS[f]!;
    const found = p.tells.includes(f);
    return `<article class="cx-item${found ? '' : ' is-locked'}"><h4>${found ? esc(t.name) : '???'}</h4>${found ? `<p>${linkProse(t.codex)}</p><a href="${esc(t.source.url)}" target="_blank" rel="noopener">${esc(t.source.title)}</a>` : '<p>Catch or miss one to add it.</p>'}</article>`;
  }).join('');
  const advs = Object.values(ADVERSARIES).map((a) => {
    const met = p.adversaries.includes(a.id);
    return `<article class="cx-item${met ? '' : ' is-locked'}"><h4>${met ? esc(a.name) : 'Unknown adversary'}</h4>${met ? `<p>${linkProse(a.codex)}</p><a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)}</a>` : '<p>Face it in a run to learn its habits.</p>'}</article>`;
  }).join('');
  const research = TREE.filter((n) => p.research.includes(n.id))
    .map((n) => `<li class="done"><span class="rs-dot"></span><div><strong>${esc(n.name)}</strong><span>${esc(n.effect)}</span></div></li>`).join('')
    || '<li class="muted">Nothing researched yet. Runs earn Insight, and failures earn the most.</li>';
  const history = p.history.length
    ? p.history.map((h) => `<li><span class="hs-grade g-${h.grade}">${h.grade}</span><span>${h.result === 'win' ? 'Won' : `Day ${h.dayReached}`} · ${RULES.difficulty[h.difficulty].label} · v${h.level}${h.daily ? ' · daily' : ''}${h.quick ? ' · quick' : ''}</span><span class="muted">${esc(ADVERSARIES[h.adversary].name)} · ${h.score}</span></li>`).join('')
    : '<li class="muted">No runs yet.</li>';
  return `
    <main class="solo codex">
      <div class="cx-top"><div><span class="eyebrow">Between runs</span><h2>Codex</h2></div><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button></div>
      <div class="cx-grid">
        <section><h3>Tells found · ${p.tells.length}/${families.length}</h3><div class="cx-list">${tells}</div></section>
        <section><h3>Adversaries faced · ${p.adversaries.length}/4</h3><div class="cx-list">${advs}</div></section>
        <section class="cx-side">
          <h3>Research · ${p.research.length}/${TREE.length}</h3>
          <ul class="research">${research}</ul>
          <h3>Recent runs</h3>
          <ul class="history">${history}</ul>
        </section>
      </div>
    </main>`;
}

// ---------- Effects, shown before choosing ----------
export function effectText(e: Effect): { text: string; good: boolean } {
  const n = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  switch (e.kind) {
    case 'funding': return { text: `${n(e.amount)} funding`, good: e.amount > 0 };
    case 'harm': return { text: `${n(e.amount)} harm`, good: e.amount < 0 };
    case 'ceiling': return { text: `${n(e.amount)} harm ceiling`, good: e.amount > 0 };
    case 'auditsTomorrow': return { text: `${n(e.amount)} auditor tomorrow`, good: e.amount > 0 };
    case 'computeTomorrow': return { text: `${n(e.amount)} compute tomorrow`, good: e.amount > 0 };
    case 'bandTomorrow': return { text: e.amount < 0 ? `Monitor ${e.amount} band tomorrow` : `Monitor +${e.amount} band tomorrow`, good: e.amount < 0 };
    case 'quotaTomorrow': return { text: `${n(e.amount)} quota tomorrow`, good: e.amount < 0 };
    case 'quotaRest': return { text: `${n(e.amount)} quota every day`, good: e.amount < 0 };
    case 'computeRest': return { text: `${n(e.amount)} compute every day`, good: e.amount > 0 };
    case 'auditsRest': return { text: `${n(e.amount)} auditor every day`, good: e.amount > 0 };
    case 'blindTomorrow': return { text: `Monitor blind on ${e.layout === 'log' ? 'agent actions' : e.layout === 'diff' ? 'file changes' : e.layout} tomorrow`, good: false };
    case 'revealAdversary': return { text: 'Learn which adversary you face', good: true };
    case 'upgrade': return { text: `Gain an upgrade: ${e.id.replace(/-/g, ' ')}`, good: true };
  }
}

const effectChips = (effects: Effect[]) => effects.map((e) => { const t = effectText(e); return `<span class="fx ${t.good ? 'fx-good' : 'fx-bad'}">${linkTerms(t.text, 1)}</span>`; }).join('');

// ---------- Event ----------
export function event(run: RunState, ev: GameEvent): string {
  // The term chips above the text count as linked, so the prose doesn't underline them again.
  const seen = new Set<string>(EVENT_TERMS[ev.id] ?? []);
  const choices = eventChoices(run, ev).map((c, i) => `
    <button class="ev-choice" data-choice="${i}"><kbd>${i + 1}</kbd><span class="ev-choice-label">${linkTerms(c.label, 0)}</span><span class="fx-row">${effectChips(c.effects)}</span></button>`).join('');
  return `
    <main class="solo event-screen">
      <article class="event-card">
        <div class="eyebrow">After Day ${run.day.day} · a message arrives</div>
        <h2 class="event-title">${linkTerms(ev.title, 0, seen)}</h2>
        ${(EVENT_TERMS[ev.id] ?? []).length ? `<div class="event-terms">${(EVENT_TERMS[ev.id] ?? []).map((id) => chip(id)).join('')}</div>` : ''}
        <p class="event-text">${linkTerms(ev.text, 2, seen)}</p>
        <div class="ev-choices">${choices}</div>
        ${ev.anchor ? `<p class="event-anchor"><span class="eyebrow">From the record</span><span>${linkTerms(ev.anchor.line, 1, seen)}</span> <a href="${esc(ev.anchor.source.url)}" target="_blank" rel="noopener">${esc(ev.anchor.source.title)}</a></p>` : ''}
      </article>
    </main>`;
}

export function eventAfter(run: RunState, ev: GameEvent, choice: number): string {
  const c = eventChoices(run, ev)[choice]!;
  return `
    <main class="solo event-screen">
      <article class="event-card">
        <div class="eyebrow">After Day ${run.day.day}</div>
        <h2 class="event-title">${esc(c.label)}</h2>
        ${c.after ? `<p class="event-text">${linkTerms(c.after, 1)}</p>` : ''}
        <div class="fx-row">${effectChips(c.effects)}</div>
        <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> Continue</button>
      </article>
    </main>`;
}

// ---------- Breakthrough ----------
export function breakthrough(run: RunState, offer: Breakthrough[]): string {
  const seen = new Map<string, Set<string>>();
  const btSeen = (id: string) => seen.get(id) ?? seen.set(id, new Set(BREAKTHROUGH_TERM[id] ? [BREAKTHROUGH_TERM[id]] : [])).get(id)!;
  const cards = offer.map((b, i) => `
    <button class="upgrade bt-card" data-breakthrough="${b.id}">
      <span class="upgrade-cat">Breakthrough</span>
      <span class="upgrade-name">${linkTerms(b.name, 0, btSeen(b.id))}</span>
      ${BREAKTHROUGH_TERM[b.id] ? `<span class="event-terms">${chip(BREAKTHROUGH_TERM[b.id])}</span>` : ''}
      <span class="upgrade-desc">${linkTerms(b.description, 1, btSeen(b.id))}</span>
      <span class="bt-real">${linkTerms(b.realWorld, 1, btSeen(b.id))}</span>
      <kbd class="upgrade-key">${i + 1}</kbd>
    </button>`).join('');
  return `
    <main class="solo breakthrough-screen">
      <div class="eyebrow">You survived Day ${run.day.day}${run.day.day === 3 ? ': the capability jump' : ''}</div>
      <h2 class="between-title">Research breakthrough</h2>
      <p class="bt-intro">Your team has earned a rare result. Choose one; it lasts the rest of the run.</p>
      <div class="bt-grid">${cards}</div>
    </main>`;
}

// ---------- Contracts (budget meeting panel) ----------
export function contractPanel(offer: Contract[], chosen?: string): string {
  const card = (c: Contract, i: number) => {
    const fx: string[] = [];
    if (c.quotaDelta) fx.push(`<span class="fx ${c.quotaDelta < 0 ? 'fx-good' : 'fx-bad'}">${c.quotaDelta > 0 ? '+' : ''}${c.quotaDelta} quota</span>`);
    if (c.fundingMult !== 1) fx.push(`<span class="fx ${c.fundingMult > 1 ? 'fx-good' : 'fx-bad'}">×${c.fundingMult} funding</span>`);
    if (c.harmBonus) fx.push(`<span class="fx fx-bad">+${c.harmBonus} harm per incident</span>`);
    if (c.audits) fx.push(`<span class="fx ${c.audits > 0 ? 'fx-good' : 'fx-bad'}">${c.audits > 0 ? '+' : ''}${c.audits} auditor</span>`);
    return `<button class="contract${chosen === c.id ? ' is-selected' : ''}" data-contract="${c.id}"><span class="ct-name"><kbd>${i === 0 ? 'Q' : 'W'}</kbd><span>${linkTerms(c.name, 0)}</span></span><span class="ct-blurb">${linkTerms(c.blurb, 0)}</span><span class="fx-row">${fx.join('') || '<span class="fx">Standard terms</span>'}</span></button>`;
  };
  return `<div class="contracts"><span class="eyebrow">Tomorrow's client · choose one</span>${offer.map(card).join('')}</div>`;
}

export const contractById = (id?: string) => CONTRACTS.find((c) => c.id === id);

// ---------- End of run: adversary reveal, score, unlocks ----------
export function endExtras(run: RunState, score: number, update: RunUpdate | null, grade = gradeFor(score)): string {
  const a = ADVERSARIES[run.adversary];
  const attacks = [...run.history, run.day].flatMap((d) => d.outcomes.map((o) => ({ o, day: d.day }))).filter((x) => x.o.draft.sabotaged);
  const early = attacks.filter((x) => x.day < RULES.schemerLateFrom).length;
  const postMortem = update
    ? `<ul class="insight-lines">${update.insight.map((l) => `<li><span>${esc(l.label)}</span><strong>+${l.amount}</strong></li>`).join('')}</ul>
       ${update.urgent.length ? `<p class="urgent-note">Your failures made the case for <strong>${update.urgent.map(branchName).join(', ')}</strong> research: half price in the lab.</p>` : ''}
       ${update.newModel ? `<p class="urgent-note"><strong>Model v${update.newModel}</strong> is ready for you.</p>` : ''}`
    : '';
    return `
    <div class="end-extras">
      <div class="reveal-adv"><span class="eyebrow">The model you faced</span><h3>${esc(a.name)}</h3><p>${linkTerms(a.tagline, 1)}</p><p class="muted">${attacks.length} sabotage attempt${attacks.length === 1 ? '' : 's'} reached you: ${early} before Day ${RULES.schemerLateFrom}, ${attacks.length - early} after.</p></div>
      <div class="score-box"><span class="eyebrow">Score</span><div class="score-line"><span class="grade g-${grade}">${grade}</span><strong>${score}</strong></div>${update?.newBest ? '<span class="good">New best</span>' : ''}</div>
      ${run.quick
        ? `<div class="unlocks"><span class="eyebrow">Quick shift</span><p class="urgent-note">A demo run: no Insight, and it doesn't count toward research or model versions. Play the full week to fund research that carries into every run.</p></div>`
        : postMortem ? `<div class="unlocks"><span class="eyebrow">Post-mortem · +${update!.insightTotal} insight</span>${postMortem}</div>` : ''}
    </div>`;
}

// ---------- Research lab ----------
const STATE_LABEL = { owned: 'Researched', available: 'Fund', unaffordable: 'Need insight', locked: 'Needs the node above', gated: '' } as const;

export function lab(p: Progress, focus?: string): string {
  const cols = BRANCHES.map((b) => {
    const urgent = p.urgent.includes(b.id);
    const nodes = TREE.filter((n) => n.branch === b.id).map((n) => {
      const st = nodeState(p, n);
      const cost = nodeCost(p, n);
      const foot = st === 'gated' ? GATE_TEXT[n.gate!] : st === 'owned' ? STATE_LABEL.owned : `${cost < n.cost ? `<s>${n.cost}</s> ` : ''}${cost} insight`;
      return `<button class="node tier-${n.tier} is-${st}${focus === n.id ? ' is-focus' : ''}" data-node="${n.id}" ${st === 'available' ? '' : 'aria-disabled="true"'}>
        <span class="node-name">${esc(n.name)}</span>
        <span class="node-effect">${linkTerms(n.effect, 1)}</span>
        <span class="node-foot">${foot}</span>
      </button>`;
    }).join('');
    return `<section class="branch${urgent ? ' is-urgent' : ''}"><header data-branch="${b.id}"><h3>${esc(b.name)}</h3>${urgent ? '<span class="urgent-tag">Urgent · half price</span>' : `<span class="branch-blurb">${linkTerms(b.blurb, 0)}</span>`}</header><div class="nodes">${nodes}</div></section>`;
  }).join('');
  return `
    <main class="solo research-lab">
      <div class="lab-top">
        <div><span class="eyebrow">Between runs</span><h2>Research lab</h2></div>
        <p class="lab-intro">Every run earns Insight, and failures earn the most: post-mortems on incidents are how the field learns. Research carries into every future run.</p>
        <div class="insight-big"><span class="eyebrow">Insight</span><strong>${p.insight}</strong></div>
        <div class="lab-actions"><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Title</button><button class="btn-primary" data-go="setup"><kbd>Enter</kbd> New shift</button></div>
      </div>
      <div class="branches">${cols}</div>
      <div class="lab-detail">${labDetail(focus)}</div>
    </main>`;
}

export function labDetail(id?: string): string {
  const b = BRANCHES.find((x) => x.id === id);
  if (b) {
    const pr = BRANCH_PRIMERS[b.id];
    const seen = new Set<string>();
    return `<strong>${esc(b.name)}</strong><span>${linkProse(pr.what, seen)} <em>It assumes:</em> ${linkProse(pr.assumes, seen)} <em>Limit:</em> ${linkProse(pr.limits, seen)}</span><span class="muted">${linkProse(pr.vs, seen)}</span>`;
  }
  const n = id ? nodeById(id) : undefined;
  if (!n) return '<p class="muted">Point at a branch name for what that approach is, or at a node for the real research behind it.</p>';
  const a = RESEARCH_ANCHORS[n.id];
  const d = NODE_DEPTH[n.id];
  const seen = new Set<string>();
  return `<strong>${esc(n.name)}</strong><span>${a ? linkTerms(a.realWorld, 2, seen) : ''}</span>${d ? `<span><em>Tradeoff:</em> ${linkTerms(d.tradeoff, 1, seen)} <em>Open question:</em> ${linkTerms(d.openQuestion, 1, seen)}</span>` : ''}${a ? `<a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)} · ${esc(a.source.date)}</a>` : ''}`;
}

// ---------- Adversary revealed (red team, event, or research) ----------
const COUNTERS: Record<string, string> = {
  sandbagger: 'Fact check compares its results with what it did elsewhere; Resample often shows its real ability.',
  colluder: 'Read threads as one piece of work. Fact check compares them with the rule on file; the Paraphraser breaks many of their signals.',
  injector: 'Scope check catches actions and recipients outside the rules. Text the agent read is never an instruction.',
  schemer: 'It behaves until it thinks no one is watching. Save auditors for cards marked unmonitored, late in the week.',
};

export function adversaryReveal(run: RunState, source: string): string {
  const a = ADVERSARIES[run.adversary];
  const seen = new Set<string>();
  return `
    <main class="solo event-screen">
      <article class="event-card reveal-card">
        <div class="eyebrow">${esc(source)} · the model you are facing</div>
        <h2 class="event-title">${esc(a.name)}</h2>
        <p class="event-text">${linkTerms(a.codex, 3, seen)}</p>
        <p class="reveal-counter"><span class="eyebrow">What works against it</span><span>${linkTerms(COUNTERS[a.id] ?? '', 1, seen)}</span></p>
        <p class="event-anchor"><span class="eyebrow">In the real world</span><span>${linkTerms(a.realWorld, 1, seen)}</span> <a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)}</a></p>
        <p class="muted small">It stays marked in your status bar for the rest of the run.</p>
        <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> Continue</button>
      </article>
    </main>`;
}
