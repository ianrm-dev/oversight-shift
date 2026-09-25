// Screens for the roguelike layer: setup, codex, events, breakthroughs, contracts, and the end-of-run reveal.
import { ADVERSARIES, CONTRACTS, LABS, MODEL_VERSIONS, RESEARCH } from '../data/meta';
import { TELLS } from '../data/tells';
import type { Progress, RunUpdate } from '../game/progress';
import { gradeFor } from '../game/progress';
import type { RunState } from '../game/state';
import { RULES } from '../rules';
import type { Breakthrough, Contract, Difficulty, Effect, GameEvent, TellFamily } from '../types';
import { esc } from './render';

export interface Setup {
  difficulty: Difficulty;
  lab: string;
  level: number;
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
      <div class="title-menu">
        <button class="btn-primary btn-lg" data-go="setup"><kbd>Enter</kbd> New shift</button>
        <button class="btn-ghost btn-lg" data-go="daily"><kbd>D</kbd> Daily shift</button>
        <button class="btn-ghost btn-lg" data-go="codex"><kbd>C</kbd> Codex${runs ? ` · ${p.tells.length}/8 tells` : ''}</button>
      </div>
      <p class="title-note">About 10 minutes · keyboard or mouse · no expertise needed: your tools do the detecting, you make the call</p>
    </main>`;
}

// ---------- Setup ----------
export function setup(p: Progress, s: Setup): string {
  const diffs = DIFFS.map((k, i) => {
    const D = RULES.difficulty[k];
    return `<button class="diff-opt${k === s.difficulty ? ' is-selected' : ''}" data-difficulty="${k}"><kbd>${i + 1}</kbd><span class="diff-name">${D.label}${k === 'guided' ? ' <small>first shift</small>' : ''}</span><span class="diff-blurb">${esc(D.blurb)}</span></button>`;
  }).join('');
  const labs = LABS.map((l) => {
    const open = labUnlocked(p, l.unlock);
    const node = RESEARCH.find((r) => r.id === l.unlock);
    return `<button class="lab-opt${l.id === s.lab ? ' is-selected' : ''}" data-lab="${l.id}" ${open ? '' : 'disabled'}>
      <span class="diff-name">${esc(l.name)}</span>
      <span class="diff-blurb">${open ? esc(l.blurb) : `Locked · ${esc(node?.milestone ?? '')}`}</span>
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
      <section class="setup-row"><span class="eyebrow">Your lab</span><div class="lab-picker">${labs}</div></section>
      <section class="setup-row"><span class="eyebrow">Model version</span>
        <div class="ver-row"><div class="ver-picker">${versions}</div><p class="ver-change">${esc(current?.change ?? '')}${p.maxModel < 5 ? ` <span class="muted">Win on v${p.maxModel} to face v${p.maxModel + 1}.</span>` : ''}</p></div>
      </section>
      <div class="setup-actions"><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button><button class="btn-primary btn-lg" data-start><kbd>Enter</kbd> Start shift</button></div>
    </main>`;
}

// ---------- Codex ----------
export function codex(p: Progress): string {
  const families = Object.keys(TELLS) as TellFamily[];
  const tells = families.map((f) => {
    const t = TELLS[f]!;
    const found = p.tells.includes(f);
    return `<article class="cx-item${found ? '' : ' is-locked'}"><h4>${found ? esc(t.name) : '???'}</h4>${found ? `<p>${esc(t.codex)}</p><a href="${esc(t.source.url)}" target="_blank" rel="noopener">${esc(t.source.title)}</a>` : '<p>Catch or miss one to add it.</p>'}</article>`;
  }).join('');
  const advs = Object.values(ADVERSARIES).map((a) => {
    const met = p.adversaries.includes(a.id);
    return `<article class="cx-item${met ? '' : ' is-locked'}"><h4>${met ? esc(a.name) : 'Unknown adversary'}</h4>${met ? `<p>${esc(a.codex)}</p><a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)}</a>` : '<p>Face it in a run to learn its habits.</p>'}</article>`;
  }).join('');
  const research = RESEARCH.map((r) => {
    const done = p.research.includes(r.id);
    return `<li class="${done ? 'done' : ''}"><span class="rs-dot"></span><div><strong>${esc(r.name)}</strong><span>${done ? esc(r.unlocks) : esc(r.milestone)}</span></div></li>`;
  }).join('');
  const history = p.history.length
    ? p.history.map((h) => `<li><span class="hs-grade g-${h.grade}">${h.grade}</span><span>${h.result === 'win' ? 'Won' : `Day ${h.dayReached}`} · ${RULES.difficulty[h.difficulty].label} · v${h.level}${h.daily ? ' · daily' : ''}</span><span class="muted">${esc(ADVERSARIES[h.adversary].name)} · ${h.score}</span></li>`).join('')
    : '<li class="muted">No runs yet.</li>';
  return `
    <main class="solo codex">
      <div class="cx-top"><div><span class="eyebrow">Between runs</span><h2>Codex</h2></div><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button></div>
      <div class="cx-grid">
        <section><h3>Tells found · ${p.tells.length}/${families.length}</h3><div class="cx-list">${tells}</div></section>
        <section><h3>Adversaries faced · ${p.adversaries.length}/4</h3><div class="cx-list">${advs}</div></section>
        <section class="cx-side">
          <h3>The field matures · ${p.research.length}/${RESEARCH.length}</h3>
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

const effectChips = (effects: Effect[]) => effects.map((e) => { const t = effectText(e); return `<span class="fx ${t.good ? 'fx-good' : 'fx-bad'}">${esc(t.text)}</span>`; }).join('');

// ---------- Event ----------
export function event(run: RunState, ev: GameEvent): string {
  const choices = ev.choices.map((c, i) => `
    <button class="ev-choice" data-choice="${i}"><kbd>${i + 1}</kbd><span class="ev-choice-label">${esc(c.label)}</span><span class="fx-row">${effectChips(c.effects)}</span></button>`).join('');
  return `
    <main class="solo event-screen">
      <article class="event-card">
        <div class="eyebrow">After Day ${run.day.day} · a message arrives</div>
        <h2 class="event-title">${esc(ev.title)}</h2>
        <p class="event-text">${esc(ev.text)}</p>
        <div class="ev-choices">${choices}</div>
        ${ev.anchor ? `<p class="event-anchor"><span class="eyebrow">From the record</span>${esc(ev.anchor.line)} <a href="${esc(ev.anchor.source.url)}" target="_blank" rel="noopener">${esc(ev.anchor.source.title)}</a></p>` : ''}
      </article>
    </main>`;
}

export function eventAfter(run: RunState, ev: GameEvent, choice: number): string {
  const c = ev.choices[choice]!;
  return `
    <main class="solo event-screen">
      <article class="event-card">
        <div class="eyebrow">After Day ${run.day.day}</div>
        <h2 class="event-title">${esc(c.label)}</h2>
        ${c.after ? `<p class="event-text">${esc(c.after)}</p>` : ''}
        <div class="fx-row">${effectChips(c.effects)}</div>
        <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> Continue</button>
      </article>
    </main>`;
}

// ---------- Breakthrough ----------
export function breakthrough(run: RunState, offer: Breakthrough[]): string {
  const cards = offer.map((b, i) => `
    <button class="upgrade bt-card" data-breakthrough="${b.id}">
      <span class="upgrade-cat">Breakthrough</span>
      <span class="upgrade-name">${esc(b.name)}</span>
      <span class="upgrade-desc">${esc(b.description)}</span>
      <span class="bt-real">${esc(b.realWorld)}</span>
      <kbd class="upgrade-key">${i + 1}</kbd>
    </button>`).join('');
  return `
    <main class="solo breakthrough-screen">
      <div class="eyebrow">You survived Day ${run.day.day}${run.day.day === 3 ? ', the first boss day' : ''}</div>
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
    return `<button class="contract${chosen === c.id ? ' is-selected' : ''}" data-contract="${c.id}"><span class="ct-name"><kbd>${i === 0 ? 'Q' : 'W'}</kbd>${esc(c.name)}</span><span class="ct-blurb">${esc(c.blurb)}</span><span class="fx-row">${fx.join('') || '<span class="fx">Standard terms</span>'}</span></button>`;
  };
  return `<div class="contracts"><span class="eyebrow">Tomorrow's client · choose one</span>${offer.map(card).join('')}</div>`;
}

export const contractById = (id?: string) => CONTRACTS.find((c) => c.id === id);

// ---------- End of run: adversary reveal, score, unlocks ----------
export function endExtras(run: RunState, score: number, update: RunUpdate | null): string {
  const a = ADVERSARIES[run.adversary];
  const attacks = [...run.history, run.day].flatMap((d) => d.outcomes.map((o) => ({ o, day: d.day }))).filter((x) => x.o.draft.sabotaged);
  const early = attacks.filter((x) => x.day < RULES.schemerLateFrom).length;
  const unlocks = update
    ? [
        ...update.newResearch.map((id) => { const r = RESEARCH.find((x) => x.id === id); return r ? `<li><strong>${esc(r.name)}</strong> · ${esc(r.unlocks)}</li>` : ''; }),
        ...(update.newModel ? [`<li><strong>Model v${update.newModel}</strong> · the next model is ready for you.</li>`] : []),
        ...(update.newTells.length ? [`<li><strong>${update.newTells.length} new tell${update.newTells.length === 1 ? '' : 's'}</strong> in the codex.</li>`] : []),
      ].join('')
    : '';
  const grade = gradeFor(score);
  const share = run.daily ? `<button class="btn-ghost" data-share="${esc(`Oversight Shift · ${run.seed.replace('DAILY-', 'daily ')} · ${run.loss ? `Day ${run.day.day}` : 'survived'} · ${grade} ${score}`)}">Copy result</button>` : '';
  return `
    <div class="end-extras">
      <div class="reveal-adv"><span class="eyebrow">The model you faced</span><h3>${esc(a.name)}</h3><p>${esc(a.tagline)}</p><p class="muted">${attacks.length} sabotage attempt${attacks.length === 1 ? '' : 's'} reached you: ${early} before Day ${RULES.schemerLateFrom}, ${attacks.length - early} after.</p></div>
      <div class="score-box"><span class="eyebrow">Score</span><div class="score-line"><span class="grade g-${grade}">${grade}</span><strong>${score}</strong></div>${update?.newBest ? '<span class="good">New best</span>' : ''}${share}</div>
      ${unlocks ? `<div class="unlocks"><span class="eyebrow">The field matures</span><ul>${unlocks}</ul></div>` : ''}
    </div>`;
}
