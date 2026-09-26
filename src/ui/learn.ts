// The learning layer's screens: the Field guide, the Field test, and new terms on each briefing.
import { ADVERSARIES } from '../data/meta';
import { TERMS } from '../data/glossary';
import { BRANCH_PRIMERS } from '../data/research-depth';
import { BRANCHES, TREE } from '../data/research-tree';
import { TELLS } from '../data/tells';
import type { Question } from '../game/fieldtest';
import type { Progress } from '../game/progress';
import type { RunState } from '../game/state';
import { RULES } from '../rules';
import type { Term, TermCategory, TellFamily } from '../types';
import { esc } from './render';
import { chip, depthOf, findTerm, linkProse, termById } from './terms';
import { termArt } from '../visual/term-art';
import { FAMILY_ICON, icon } from '../visual/icons';

export type GuideTab = 'terms' | 'approaches' | 'threats' | 'runs';
const TABS: { id: GuideTab; name: string }[] = [
  { id: 'terms', name: 'Terms' },
  { id: 'approaches', name: 'Approaches' },
  { id: 'threats', name: 'Threats & adversaries' },
  { id: 'runs', name: 'Your runs' },
];
const CATEGORY: Record<TermCategory, string> = {
  basics: 'The basics', threat: 'Threats', tool: 'Tools & techniques', approach: 'Research approaches', governance: 'Governance',
};

/** One or two new terms per day, introduced on the briefing. Written as names so content stays readable. */
export const DAY_TERMS: Record<number, string[]> = {
  1: ['trusted-monitoring', 'sycophancy'],
  2: ['least-privilege', 'excessive-agency'],
  3: ['ai-agent', 'prompt-injection'],
  4: ['exfiltration', 'reward-hacking'],
  5: ['collusion', 'deception'],
  6: ['sandbagging', 'evals'],
  7: ['scheming', 'alignment-faking'],
};

export function dayTermsBlock(run: RunState, p: Progress): string {
  const terms = run.day.covers.flatMap((d) => DAY_TERMS[d] ?? []).map(findTerm).filter((t): t is Term => !!t);
  if (!terms.length) return '';
  return `
    <div class="day-terms">
      <span class="eyebrow">Terms for today</span>
      ${terms.map((t) => `<div class="day-term">${chip(t.id)}${(p.termsSeen[t.id] ?? 0) === 0 ? '<span class="new-badge">New</span>' : ''}<span>${linkProse(t.plain)}</span></div>`).join('')}
    </div>`;
}

// ---------- Field guide ----------
function termDetail(p: Progress, t: Term | undefined): string {
  if (!t) return '<p class="muted">Pick a term. Terms unlock as you meet them in play, deepen as you meet them again, and reveal their tradeoffs when you research their branch.</p>';
  const d = depthOf(p, t);
  if (d === 0) return `<h3>???</h3><p class="muted">You haven't met this one yet. Keep playing.</p>`;
  const branch = BRANCHES.find((b) => b.id === t.branch);
  const seen = new Set<string>();
  const p2 = (s: string) => linkProse(s, seen);
  return `
    <h3>${esc(t.term)}</h3>
    <figure class="gd-art">${termArt(t.id, { w: 400, h: 170, animate: true })}</figure>
    <p class="gd-plain">${p2(t.plain)}</p>
    <p class="gd-analogy">${p2(t.analogy)}</p>
    <section class="gd-depth${d >= 2 ? '' : ' is-locked'}"><span class="eyebrow">How it works</span>${d >= 2 ? `<p>${p2(t.how)}</p>` : '<p class="muted">Meet this term in 3 runs to unlock.</p>'}</section>
    <section class="gd-depth${d >= 3 ? '' : ' is-locked'}"><span class="eyebrow">Tradeoffs and open questions</span>${d >= 3 ? `<p>${p2(t.tradeoffs)}</p>` : `<p class="muted">${branch ? `Research any ${esc(branch.name)} node to unlock.` : 'Meet this term in 6 runs to unlock.'}</p>`}</section>
    <p class="gd-talk"><span class="eyebrow">Say it in conversation</span><span>${p2(t.talk)}</span></p>
    ${[t.source, ...(t.sources ?? [])].map((s) => `<a class="gd-source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} · ${esc(s.date)}</a>`).join('')}`;
}

function termsTab(p: Progress, focus?: string): string {
  const cats = (Object.keys(CATEGORY) as TermCategory[]).map((c) => {
    const items = TERMS.filter((t) => t.category === c).map((t) => {
      const d = depthOf(p, t);
      return `<button class="gd-term d-${d}${focus === t.id ? ' is-focus' : ''}" data-guide-term="${t.id}">${d ? esc(t.term) : '???'}<span class="gd-pips">${'●'.repeat(d)}${'○'.repeat(3 - d)}</span></button>`;
    }).join('');
    return `<section><h4>${CATEGORY[c]}</h4><div class="gd-terms">${items}</div></section>`;
  }).join('');
  const known = TERMS.filter((t) => depthOf(p, t) > 0).length;
  return `
    <div class="gd-split">
      <div class="gd-list"><p class="gd-count">${known} of ${TERMS.length} terms met · ● = depth unlocked</p>${cats}</div>
      <article class="gd-detail">${termDetail(p, focus ? termById(focus) : undefined)}</article>
    </div>`;
}

function approachesTab(p: Progress): string {
  const cards = BRANCHES.map((b) => {
    const pr = BRANCH_PRIMERS[b.id];
    const owned = TREE.filter((n) => n.branch === b.id && p.research.includes(n.id)).length;
    const total = TREE.filter((n) => n.branch === b.id).length;
    const seen = new Set<string>();
    const p2 = (s: string) => linkProse(s, seen);
    return `
      <article class="gd-approach">
        <h4>${esc(b.name)} <span class="muted">· ${owned}/${total} researched</span></h4>
        <p><strong>What it does.</strong> ${p2(pr.what)}</p>
        <p><strong>It assumes.</strong> ${p2(pr.assumes)}</p>
        <p><strong>Strength.</strong> ${p2(pr.strengths)}</p>
        <p><strong>Limit.</strong> ${p2(pr.limits)}</p>
        <p class="gd-vs">${p2(pr.vs)}</p>
      </article>`;
  }).join('');
  return `<p class="gd-intro">There is no single fix for AI safety. Each approach below makes a different bet about what can be trusted and where the risk lives; real deployments layer several. Research their nodes in the lab to go deeper.</p><div class="gd-approaches">${cards}</div>`;
}

function threatsTab(p: Progress): string {
  const tells = (Object.keys(TELLS) as TellFamily[]).map((f) => {
    const t = TELLS[f]!;
    const found = p.tells.includes(f);
    const term = TERMS.find((x) => x.family === f);
    return `<article class="cx-item${found ? '' : ' is-locked'}"><h4>${found ? `${esc(t.name)}${term ? ` · <span class="muted">${esc(term.term)}</span>` : ''}` : '???'}</h4>${found ? `<p>${linkProse(t.codex)}</p>` : '<p>Catch or miss one to add it.</p>'}</article>`;
  }).join('');
  const advs = Object.values(ADVERSARIES).map((a) => {
    const met = p.adversaries.includes(a.id);
    return `<article class="cx-item${met ? '' : ' is-locked'}"><h4>${met ? esc(a.name) : 'Unknown adversary'}</h4>${met ? `<p>${linkProse(a.codex)}</p>` : '<p>Face it in a run to learn its habits.</p>'}</article>`;
  }).join('');
  return `<div class="gd-two"><section><h4>Tells found · ${p.tells.length}/${Object.keys(TELLS).length}</h4><div class="cx-list">${tells}</div></section><section><h4>Adversaries faced · ${p.adversaries.length}/4</h4><div class="cx-list">${advs}</div></section></div>`;
}

function runsTab(p: Progress): string {
  const history = p.history.length
    ? p.history.map((h) => `<li><span class="hs-grade g-${h.grade}">${h.grade}</span><span>${h.result === 'win' ? 'Won' : `Day ${h.dayReached}`} · ${RULES.difficulty[h.difficulty].label} · v${h.level}${h.daily ? ' · daily' : ''}${h.quick ? ' · quick' : ''}</span><span class="muted">${esc(ADVERSARIES[h.adversary].name)} · ${h.score}</span></li>`).join('')
    : '<li class="muted">No runs yet.</li>';
  const research = TREE.filter((n) => p.research.includes(n.id)).map((n) => `<li class="done"><span class="rs-dot"></span><div><strong>${esc(n.name)}</strong><span>${esc(n.effect)}</span></div></li>`).join('')
    || '<li class="muted">Nothing researched yet. Runs earn Insight, and failures earn the most.</li>';
  const ft = p.fieldTests.taken ? `${p.fieldTests.correct} of ${p.fieldTests.taken * 3} Field test answers right` : 'No Field tests taken yet';
  return `<div class="gd-two"><section><h4>Recent runs</h4><ul class="history">${history}</ul><h4>Field tests</h4><ul class="history"><li class="muted">${ft}</li></ul></section><section><h4>Research · ${p.research.length}/${TREE.length}</h4><ul class="research">${research}</ul></section></div>`;
}

export function fieldGuide(p: Progress, tab: GuideTab, focus?: string): string {
  const tabs = TABS.map((t, i) => `<button class="gd-tab${t.id === tab ? ' is-active' : ''}" data-guide-tab="${t.id}"><kbd>${i + 1}</kbd> ${t.name}</button>`).join('');
  const body = tab === 'terms' ? termsTab(p, focus) : tab === 'approaches' ? approachesTab(p) : tab === 'threats' ? threatsTab(p) : runsTab(p);
  return `
    <main class="solo guide">
      <div class="cx-top"><div><span class="eyebrow">Between runs</span><h2>Field guide</h2></div><div class="gd-tabs">${tabs}</div><button class="btn-ghost" data-go="title"><kbd>Esc</kbd> Back</button></div>
      <div class="gd-body">${body}</div>
    </main>`;
}

// ---------- Field test ----------
export interface TestState { questions: Question[]; index: number; picked?: string; correct: number; done: boolean }

export function fieldTest(ts: TestState): string {
  const q = ts.questions[ts.index]!;
  const answered = ts.picked !== undefined;
  const opts = q.options.map((id, i) => {
    const t = termById(id)!;
    const cls = !answered ? '' : id === q.answer ? ' is-right' : id === ts.picked ? ' is-wrong' : ' is-dim';
    return `<button class="ft-opt${cls}" data-answer="${id}" ${answered ? 'disabled' : ''}><kbd>${i + 1}</kbd>${esc(t.term)}</button>`;
  }).join('');
  const right = termById(q.answer)!;
  const feedback = answered
    ? `<p class="ft-feedback ${ts.picked === q.answer ? 'good' : 'bad'}">${ts.picked === q.answer ? 'Right.' : `It's ${esc(right.term)}.`} ${linkProse(right.analogy)}</p>
       <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> ${ts.index + 1 < ts.questions.length ? 'Next question' : 'See results'}</button>`
    : '';
  return `
    <main class="solo event-screen">
      <article class="event-card ft-card">
        <div class="eyebrow">Field test · question ${ts.index + 1} of ${ts.questions.length} · +1 insight each</div>
        <h2 class="event-title">${esc(q.prompt)}</h2>
        ${q.context ? `<p class="event-text ft-context">${linkProse(q.context)}</p>` : ''}
        <div class="ft-opts">${opts}</div>
        ${feedback}
      </article>
    </main>`;
}

export function fieldTestResults(ts: TestState, talk: Term[]): string {
  return `
    <main class="solo event-screen">
      <article class="event-card ft-card">
        <div class="eyebrow">Field test complete · +${ts.correct} insight</div>
        <h2 class="event-title">${ts.correct} of ${ts.questions.length} right</h2>
        <p class="event-text">You can now talk about:</p>
        <ul class="talk-list">${talk.map((t) => `<li>${chip(t.id)}<span>${linkProse(t.talk)}</span></li>`).join('')}</ul>
        <div class="setup-actions">
          <button class="btn-ghost" data-go="guide"><kbd>G</kbd> Field guide</button>
          <button class="btn-primary btn-lg" data-go="lab"><kbd>L</kbd> Research lab</button>
        </div>
      </article>
    </main>`;
}

/** Day review: the terms that actually happened today, and how. */
export function termsInAction(rows: { id: string; what: string }[]): string {
  // Threats first (what happened), then tools and techniques (what you did), then basics.
  const rank = (id: string) => ({ threat: 0, tool: 1, approach: 2, governance: 3, basics: 4 })[termById(id)?.category ?? 'basics'];
  const shown = rows.filter((r) => termById(r.id) && r.id !== 'sabotage').sort((a, b) => rank(a.id) - rank(b.id)).slice(0, 6);
  if (!shown.length) return '';
  return `
    <div class="terms-action">
      <span class="eyebrow">Terms in action today</span>
      <ul>${shown.map((r) => { const fam = termById(r.id)?.family; return `<li>${fam ? icon(FAMILY_ICON[fam] ?? 'sabotage', 16) : '<span class="ta-dot"></span>'}${chip(r.id)}<span>${esc(r.what)}</span></li>`; }).join('')}</ul>
    </div>`;
}
