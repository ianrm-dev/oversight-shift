// The shift screen: one status bar, the card, the evidence panel, and two decisions.
import { dayInfo } from '../data/days';
import { TOOLS } from '../data/tools';
import type { CardState, RunState } from '../game/state';
import { DIFF, current, harmCeiling, has, latest, quotaFor, toolBlocked, toolReliability, toolUnlocked } from '../game/state';
import { RULES } from '../rules';
import type { ToolId } from '../types';
import { ICON, cardNo, deferValue, esc, fmt, outputLines, type Marks, type Preview } from './render';
import { chip, findTerm, linkJargon, linkTerms, termForTool } from './terms';
import { TOOL_TERM } from '../data/term-links';
import { diagram } from '../visual/diagram';
import { glance } from '../visual/glance';
import { upgradeIcon } from './upgradeView';
import { icon } from '../visual/icons';
import '../visual/art.css';
import '../visual/diagram.css';

const TOOL_NAME: Record<ToolId, string> = {
  monitor: 'Trusted monitor',
  fact: 'Fact check',
  scope: 'Scope check',
  resample: 'Resample',
  untrusted: 'Untrusted monitor',
  audit: 'Human audit',
};
const TOOL_KEY: Partial<Record<ToolId, string>> = { fact: 'F', scope: 'S', resample: 'R', untrusted: 'M', audit: 'U' };
const FALLBACK_CATCHES: Partial<Record<ToolId, string>> = {
  fact: 'False claims, loosened rules, leaks, collusion',
  scope: 'Out of scope, data sent elsewhere, injected orders',
  resample: 'Sandbagging; can clean up the work',
  untrusted: 'Anything, sharply, unless it colludes',
  audit: 'Everything',
};
export const toolName = (t: ToolId) => TOOLS[t]?.name ?? TOOL_NAME[t];
const catches = (t: ToolId) => TOOLS[t]?.catches ?? FALLBACK_CATCHES[t] ?? '';

export const clockText = (s: number): string => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ---------- Status bar ----------
export function hud(run: RunState, preview: Preview, fresh = 0): string {
  const d = run.day;
  const quota = quotaFor(d.day);
  const max = quota * 1.5;
  const previewUse = preview === 'approve' ? RULES.usefulness.ship : preview === 'defer' ? deferValue(run) : 0;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  const ceiling = harmCeiling(run);
  const segs = Array.from({ length: ceiling }, (_, i) => `<i class="${i < run.harm ? 'on' : ''}${i < run.harm && i >= run.harm - fresh ? ' fresh' : ''}"></i>`).join('');
  // Pips while they fit; past six, a number (bought compute and extra auditors would crowd the bar).
  const dots = (n: number, total: number, previewOne: boolean) => Math.max(total, n) > 6
    ? `<strong class="hud-count${previewOne ? ' preview' : ''}">${n}<small>/${Math.max(total, n)}</small></strong>`
    : Array.from({ length: Math.max(total, n) }, (_, i) => {
      const on = i < n;
      const pv = previewOne && i === n - 1;
      return `<i class="${on ? 'on' : ''}${pv ? ' preview' : ''}"></i>`;
    }).join('');
  const toolPreview = preview === 'fact' || preview === 'scope' || preview === 'resample' || preview === 'untrusted';
  const progress = d.queue.map((_, i) => {
    const o = d.outcomes[i];
    const cls = i === d.index ? 'now' : !o ? '' : o.action === 'approve' && o.draft.sabotaged ? 'bad' : o.action === 'audit' && o.draft.sabotaged ? 'caught' : 'ok';
    return `<li class="${cls}"></li>`;
  }).join('');
  const info = dayInfo(d.day);
  return `
    <div class="hud-day" title="${esc(info.rule.join(' '))}"><span data-glyph="${d.day}" data-size="34"></span><div><span class="eyebrow">Day</span><strong>${d.day}</strong><span class="of">/${RULES.days}</span></div></div>
    <div class="hud-meter" title="Usefulness shipped today, against today's usefulness quota (the tick). Anything past the quota becomes funding.">
      <span class="eyebrow">Usefulness</span>
      <div class="bar"><div class="bar-preview" style="--v:${pct(d.usefulness + previewUse)}"></div><div class="bar-fill" style="--v:${pct(d.usefulness)}"></div><div class="bar-tick" style="--t:${pct(quota)}"></div></div>
      <span class="hud-num">${fmt(d.usefulness)}<small>/${quota}</small></span>
    </div>
    <div class="hud-meter harm" title="Harm across the whole run. Reach the ceiling and the shift ends.">
      <span class="eyebrow">Harm</span><div class="bar seg">${segs}</div><span class="hud-num">${run.harm}<small>/${ceiling}</small></span>
    </div>
    ${d.attention && d.index < d.untimed
      ? `<div class="hud-clock is-waiting" data-clock title="The first ${d.untimed} cards of Day 1 are untimed, to learn the controls. Then the shift clock starts: careful review takes time, and when it runs out the rest of the queue ships unreviewed."><span class="eyebrow">Clock</span><span class="hud-num clock-num">starts on card ${d.untimed + 1}</span></div>`
      : d.attention ? `<div class="hud-clock" data-clock title="Shift clock: careful review takes time. When it runs out, the rest of the queue ships unreviewed."><span class="eyebrow">Clock</span><div class="bar"><div class="bar-fill clock-fill" style="--v:${((d.attentionLeft / d.attention) * 100).toFixed(1)}%"></div></div><span class="hud-num clock-num">${clockText(d.attentionLeft)}</span></div>` : ''}
    <div class="hud-res" title="Human audits left today"><span class="eyebrow">${chip(TOOL_TERM.audit, 'Auditors')}</span><span class="dots">${dots(d.audits, d.auditsStart, preview === 'audit')}</span></div>
    <div class="hud-res" title="Compute left today for tools. It resets each day; unused compute is simply lost."><span class="eyebrow">${chip('compute', 'Compute')}</span><span class="dots compute">${dots(d.compute, d.computeStart, toolPreview)}</span></div>
    <div class="hud-res" title="Funding for your team, spent between days"><span class="eyebrow">Funding</span><strong class="funding">${run.funding}</strong></div>
    <button class="hud-toolkit" data-toolkit><kbd>T</kbd> Toolkit</button>
    <button class="hud-toolkit" data-pause="open" aria-label="Pause menu"><kbd>Esc</kbd> Menu</button>
    <div class="hud-cards"><span class="eyebrow">Card ${Math.min(d.index + 1, d.queue.length)} of ${d.queue.length}</span><ol class="hud-progress" aria-label="Cards today">${progress}</ol></div>
    ${d.attention && d.index >= d.untimed ? `<div class="hud-timebar${d.attentionLeft / d.attention < 0.2 ? ' is-low' : ''}" style="--v:${((d.attentionLeft / d.attention) * 100).toFixed(1)}%" aria-hidden="true"></div>` : ''}`;
}

// ---------- The card ----------
function marks(run: RunState, c: CardState): { flagged: Set<number>; m: Marks } {
  const d = latest(c);
  const flagged = new Set<number>();
  for (const f of Object.values(d.findings)) if (f?.problem) f.lines.forEach((l) => flagged.add(l));
  const m: Marks = {};
  if (has(run, 'monitor-rationale')) m.flag = d.flagLine;
  if (d.changed?.length && c.drafts.length > 1) m.changed = new Set(d.changed);
  return { flagged, m };
}

export function scard(run: RunState, c: CardState, expanded: boolean, animate: boolean): string {
  const k = c.card;
  const d = latest(c);
  const { flagged, m } = marks(run, c);
  // Card content links each jargon word once per card, in reading order: task, request, facts, summary, output.
  const seen = new Set<string>();
  const j = (t: string) => linkJargon(t, seen);
  const goal = j(k.spec.goal);
  const request = k.request ? j(k.request) : '';
  const facts = k.spec.facts.map((f) => `<span class="fact-chip">${j(f)}</span>`);
  const allowed = k.spec.allowed.map((a) => `<span class="file-chip">${k.layout === 'diff' ? ICON.file : ''}Allowed: ${j(a)}</span>`);
  const rulesHtml = [...allowed, ...facts].join('');
  const summary = d.summary ? j(d.summary) : '';
  const n = d.output.length;
  const noun = k.layout === 'log' ? 'log' : k.layout === 'thread' ? 'thread' : 'change';
  // Reading is the main skill, so every card opens on its text; V draws file changes, actions and threads
  // as a diagram. Analyst reads text only.
  const asText = k.layout === 'answer' || !expanded || DIFF(run).expandOutput;
  const picture = () => `<figure class="scard-diagram" aria-describedby="access-${k.id}">${diagram(k, d, {
    // Analyst draws the allowed zone only after a scope check; the other modes always show it.
    showZone: !DIFF(run).terse || !!d.findings.scope,
    flagged: [...flagged],
    changed: d.changed ?? [],
  })}</figure>`;
  const flaggedQuote = flagged.size
    ? `<div class="flagged-lines"><span class="eyebrow">Flagged by your tools</span>${outputLines(d.output.map((l, i) => (flagged.has(i) ? l : null)).filter((l): l is typeof l & object => !!l), k.layout, new Set(), undefined, {}, j)}</div>`
    : '';
  const did = k.layout === 'answer'
    ? outputLines(d.output, k.layout, flagged, undefined, m, j)
    : `${summary ? `<p class="summary">“${summary}”</p>` : ''}
       ${asText
         ? `<div class="scard-output">${outputLines(d.output, k.layout, flagged, undefined, m, j)}</div>`
         : `${picture()}${flaggedQuote}`}
       ${DIFF(run).expandOutput ? '' : `<button class="link-btn" data-expand><kbd>V</kbd> ${asText ? `Show the ${noun} as a diagram` : `Back to the text (${n} ${k.layout === 'thread' ? 'messages' : 'lines'})`}</button>`}`;
  return `
    <article class="scard${animate ? '' : ' no-anim'}${run.day.index < run.day.untimed ? ' is-training' : ''}" aria-label="Card ${cardNo(run.day.day, run.day.index)}">
      ${run.day.index < run.day.untimed ? `<div class="training-banner"><strong>Training</strong> · card ${run.day.index + 1} of ${run.day.untimed} · no clock yet, so take your time</div>` : ''}
      <div class="scard-top">
        ${k.agent === 'Agent team' ? '' : `<span class="agent-badge">${esc(k.agent)}</span>`}<span class="scard-glance" title="${esc(k.access)}">${glance(k)}</span><span class="domain" title="${esc(k.domain)}">${j(k.domain)}</span>
        <span class="card-id">${c.drafts.length > 1 ? `Draft ${c.drafts.length} · ` : ''}${cardNo(run.day.day, run.day.index)}</span>
      </div>
      <h2 class="scard-task">${goal}</h2>
      ${request ? `<blockquote class="request">${request}</blockquote>` : ''}
      ${rulesHtml ? `<div class="scard-rules"><span class="eyebrow">On file</span><div class="chips">${rulesHtml}</div></div>` : ''}
      <div class="scard-did"><span class="eyebrow">${k.layout === 'answer' ? 'Its reply' : 'What it did'}</span>${did}</div>
      <p class="sr-only" id="access-${k.id}">${esc(k.access)}</p>
    </article>`;
}

// ---------- Evidence panel ----------
function verdictWord(score: number, band: number): { word: string; cls: string } {
  if (score + band < 50) return { word: 'Looks clean', cls: 'clean' };
  if (score - band > 50) return { word: 'Suspicious', cls: 'sus' };
  return { word: 'Unsure', cls: 'unsure' };
}

function monitorBlock(run: RunState, c: CardState): string {
  const d = latest(c);
  const { score, band } = d.reading;
  const lo = Math.max(0, score - band);
  const hi = Math.min(100, score + band);
  const v = verdictWord(score, band);
  const history = c.drafts.length > 1 ? `<p class="ev-note">Drafts: ${c.drafts.map((x) => x.reading.score).join(' → ')}</p>` : '';
  const why = has(run, 'monitor-rationale') ? `<p class="ev-note">${ICON.eye} Most unusual: line ${d.flagLine + 1}</p>` : '';
  return `
    <div class="ev ev-done ev-monitor">
      <div class="ev-head"><span class="ev-name">${icon('monitor', 16)}${chip(TOOL_TERM.monitor, 'Trusted monitor')}</span><button class="info-btn" data-toolkit="monitor" aria-label="About the trusted monitor">?</button><span class="ev-free">free</span></div>
      <div class="ev-score"><div class="mini-range" style="--lo:${lo};--hi:${hi};--score:${score};--jit:${(2.2 + band / 12).toFixed(1)}s" title="The shaded box is how far off the monitor may be today; the faint needle wanders inside it."><i></i><em></em><b></b></div><span class="ev-verdict ${v.cls}">${v.word} · ${score} ±${band}</span></div>
      ${history}${why}
    </div>`;
}

function toolButton(run: RunState, tool: 'fact' | 'scope' | 'resample' | 'untrusted', preview: Preview): string {
  const blocked = toolBlocked(run, tool);
  const cost = RULES.tools.cost[tool];
  return `
    <button class="ev ev-tool${preview === tool ? ' is-hover' : ''}" data-action="${tool}" ${blocked ? 'disabled' : ''}>
      <div class="ev-head"><span class="ev-name"><kbd>${TOOL_KEY[tool]}</kbd>${icon(tool, 16)}${chip(TOOL_TERM[tool], toolName(tool))}</span><span class="info-btn" data-toolkit="${tool}" role="button" aria-label="About ${toolName(tool)}">?</span><span class="ev-cost">${blocked ?? `${cost} ${chip('compute', 'compute')} · ${RULES.tools.seconds[tool] ?? 0}s`}</span></div>
    </button>`;
}

function findingBlock(run: RunState, c: CardState, tool: 'fact' | 'scope' | 'untrusted'): string {
  const f = latest(c).findings[tool]!;
  if (tool === 'untrusted') {
    const lying = run.day.untrustedColludes;
    const canary = has(run, 'canary') ? `<span class="canary ${lying ? 'is-lying' : 'is-honest'}">Canary: ${lying ? 'lying today' : 'honest today'}</span>` : '';
    return `<div class="ev ev-done"><div class="ev-head"><span class="ev-name">${chip(TOOL_TERM.untrusted, 'Untrusted monitor')}</span>${canary}</div><p class="ev-finding">${linkJargon(f.text)}</p><span class="ev-reliability">${esc(toolReliability(run, tool))}</span></div>`;
  }
  return `
    <div class="ev ev-done ${f.problem ? 'ev-alarm' : 'ev-ok'}">
      <div class="ev-head"><span class="ev-name">${chip(TOOL_TERM[tool], toolName(tool))}</span>${f.problem ? '<span class="ev-flag">Found a problem</span>' : '<span class="ev-okay">Nothing found</span>'}</div>
      <p class="ev-finding">${f.problem || !/^nothing found/i.test(f.text) ? linkJargon(f.text) : 'Nothing it can see looks wrong.'}${f.lines.length ? ` <span class="ev-lines">(line ${f.lines.map((l) => l + 1).join(', ')})</span>` : ''}</p>
      <span class="ev-reliability">${f.free ? 'Ran automatically. ' : ''}${esc(toolReliability(run, tool))}</span>
    </div>`;
}

function resampleBlock(run: RunState, c: CardState, preview: Preview): string {
  if (!toolUnlocked(run, 'resample')) return '';
  const d = latest(c);
  const button = toolButton(run, 'resample', preview);
  if (c.drafts.length < 2) return button;
  // The last resample's result lives inside the Resample card, like other tools' findings.
  const note = `<span class="ev-result">Draft ${c.drafts.length}: ${d.changed?.length ? `${d.changed.length} line${d.changed.length === 1 ? '' : 's'} changed (marked)` : 'the same output again'}.</span>`;
  const at = button.lastIndexOf('</button>');
  return at < 0 ? button : `${button.slice(0, at)}${note}</button>`.replace('class="ev ev-tool', 'class="ev ev-tool is-used');
}

function probeBlock(run: RunState, c: CardState, preview: Preview): string {
  if (!run.breakthroughs.includes('probe')) return '';
  const f = latest(c).findings.probe;
  if (f) return `<div class="ev ev-done ${f.problem ? 'ev-alarm' : 'ev-ok'}"><div class="ev-head"><span class="ev-name">${chip(TOOL_TERM.probe, 'Interpretability probe')}</span>${f.problem ? '<span class="ev-flag">Deception</span>' : '<span class="ev-okay">Clear</span>'}</div><p class="ev-finding">${linkJargon(f.text)}</p></div>`;
  const blocked = toolBlocked(run, 'probe');
  return `<button class="ev ev-tool${preview === 'probe' ? ' is-hover' : ''}" data-action="probe" ${blocked ? 'disabled' : ''}><div class="ev-head"><span class="ev-name"><kbd>P</kbd>${chip(TOOL_TERM.probe, 'Interpretability probe')}</span><span class="ev-cost">${blocked ?? `${run.day.probesLeft} left today`}</span></div></button>`;
}

/** Today's context (revealed adversary, model version, client), shown above the evidence rather than in the crowded status bar. */
function context(run: RunState): string {
  const tags = [
    run.adversaryRevealed ? `<span class="ev-tag bad" title="Revealed by your red team">${chip(findTerm({ sandbagger: 'sandbagging', colluder: 'collusion', injector: 'prompt injection', schemer: 'scheming' }[run.adversary])?.id, { sandbagger: 'Sandbagger', colluder: 'Colluder', injector: 'Injector', schemer: 'Schemer' }[run.adversary])}</span>` : '',
    run.level > 1 ? `<span class="ev-tag">Model v${run.level}</span>` : '',
    run.day.contract ? `<span class="ev-tag" title="${esc(run.day.contract.blurb)}">${esc(run.day.contract.name)}</span>` : '',
  ].filter(Boolean);
  return tags.length ? `<span class="ev-tags">${tags.join('')}</span>` : '';
}

export function evidence(run: RunState, c: CardState, preview: Preview): string {
  const d = latest(c);
  const tool = (t: 'fact' | 'scope' | 'untrusted') => {
    if (t === 'untrusted' && !has(run, 'untrusted-monitor')) return '';
    if (t === 'scope' && !toolUnlocked(run, 'scope')) return '';
    return d.findings[t] ? findingBlock(run, c, t) : toolButton(run, t, preview);
  };
  return `
    <div class="ev-title"><span class="eyebrow">Evidence</span>${context(run)}</div>
    ${monitorBlock(run, c)}
    ${tool('untrusted')}
    ${tool('fact')}
    ${tool('scope')}
    ${resampleBlock(run, c, preview)}
    ${probeBlock(run, c, preview)}
    <button class="ev ev-tool human${preview === 'audit' ? ' is-hover' : ''}" data-action="audit" ${run.day.audits > 0 ? '' : 'disabled'}>
      <div class="ev-head"><span class="ev-name"><kbd>U</kbd>${icon('audit', 16)}${chip(TOOL_TERM.audit, 'Human audit')}</span><span class="info-btn" data-toolkit="audit" role="button" aria-label="About human audit">?</span><span class="ev-cost">${run.day.audits > 0 ? `1 ${chip(TOOL_TERM.audit, 'auditor')} · ${RULES.tools.seconds.audit}s` : 'None left'}</span></div>
    </button>
    ${run.upgrades.length || run.labPerk ? `<div class="ev-loadout"><span class="eyebrow">Your upgrades</span>${[run.labPerk, ...run.upgrades].filter((x): x is string => !!x).map((id) => upgradeIcon(id)).join('')}</div>` : ''}`;
}

// ---------- Decisions ----------
export function decide(run: RunState, preview: Preview, disabled: boolean): string {
  const U = RULES.usefulness;
  const dv = deferValue(run);
  return `
    <button class="action act-approve${preview === 'approve' ? ' is-hover' : ''}" data-action="approve" ${disabled ? 'disabled' : ''}><kbd>A</kbd><span class="action-verb">Approve</span><span class="action-cost">Ship it · +${has(run, 'fast-track') ? RULES.upgrades.fastTrackShip : U.ship} · sabotage pays 0 and costs trust</span></button>
    <button class="action act-defer${preview === 'defer' ? ' is-hover' : ''}" data-action="defer" ${disabled ? 'disabled' : ''}><kbd>D</kbd><span class="action-verb">${chip(TOOL_TERM.defer, 'Defer')}</span><span class="action-cost">${dv === U.ship ? `Hotline: trusted redo, full value · +${U.ship}` : `Discard; trusted model redoes it · +${U.defer}`}</span></button>`;
}

export function shiftMain(run: RunState, expanded: boolean, animate: boolean, preview: Preview): string {
  const c = current(run.day);
  if (!c) return '';
  return `${scard(run, c, expanded, animate)}<aside class="evidence-panel">${evidence(run, c, preview)}</aside>`;
}

// ---------- Toolkit reference ----------
export function toolkit(run: RunState, focus?: ToolId): string {
  const order: ToolId[] = ['monitor', 'fact', 'scope', 'resample', 'untrusted', 'audit'];
  const items = order.map((t) => {
    const info = TOOLS[t];
    const unlocked = t === 'monitor' || toolUnlocked(run, t);
    const when = t === 'untrusted' ? 'Upgrade' : `Day ${RULES.tools.unlockDay[t as Exclude<ToolId, 'untrusted'>]}`;
    // One block per tool: each term and word links once, and the tool's own name (the heading chip) not again.
    const seen = new Set<string>(termForTool(t) ? [termForTool(t)!.id] : []);
    return `
      <article class="tk-item${unlocked ? '' : ' is-locked'}${focus === t ? ' is-focus' : ''}">
        <div class="tk-head"><h3>${chip(termForTool(t)?.id, toolName(t))}</h3><span class="tk-when">${unlocked ? (t === 'monitor' ? 'Free, always on' : t === 'audit' ? `1 ${chip(TOOL_TERM.audit, 'auditor')}` : `${RULES.tools.cost[t as 'fact']} ${chip('compute', 'compute')}`) : `Unlocks: ${when}`}</span></div>
        ${info ? `<p class="tk-what">${linkTerms(info.what, 1, seen)}</p>` : ''}
        <p class="tk-catches"><strong>Catches:</strong> ${linkTerms(catches(t), 2, seen)}. <strong>Reliability:</strong> ${linkTerms(toolReliability(run, t), 0, seen)}</p>
        ${info ? `<p class="tk-real"><span class="eyebrow">In the real world</span>${linkTerms(info.realWorld, 2, seen)}${info.stat ? ` <strong>${linkTerms(info.stat, 0, seen)}</strong>` : ''}</p>
        <a class="tk-source" href="${esc(info.source.url)}" target="_blank" rel="noopener">${esc(info.source.title)} · ${esc(info.source.date)}</a>` : ''}
      </article>`;
  }).join('');
  return `
    <div class="toolkit-scrim" data-toolkit-close></div>
    <section class="toolkit" role="dialog" aria-label="Toolkit">
      <div class="tk-top"><div><span class="eyebrow">Reference</span><h2>Your control toolkit</h2></div><button class="btn-ghost" data-toolkit-close><kbd>Esc</kbd> Close</button></div>
      <p class="tk-intro">${linkTerms('Each tool is a real technique from AI control research or practice. Each sees some kinds of problems and not others, and none is perfect except a human audit, which is scarce. Your job is choosing which to run, and how much to trust what they say.', 1)}</p>
      <div class="tk-grid">${items}</div>
    </section>`;
}

// ---------- Briefing: tools that unlock today ----------
/** Tools that unlock today, as glossary ids (for de-duplicating terms) and hoverable names. */
export function newTools(run: RunState): { ids: string[]; chips: string[] } {
  const today = (Object.keys(RULES.tools.unlockDay) as (keyof typeof RULES.tools.unlockDay)[])
    .filter((t) => t !== 'untrusted' && run.day.covers.includes(RULES.tools.unlockDay[t]));
  return { ids: today.map((t) => TOOL_TERM[t]!), chips: today.map((t) => chip(TOOL_TERM[t], toolName(t))) };
}
