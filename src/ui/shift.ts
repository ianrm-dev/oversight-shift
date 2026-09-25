// The shift screen: one status bar, the card, the evidence panel, and two decisions.
import { dayInfo } from '../data/days';
import { TOOLS } from '../data/tools';
import type { CardState, RunState } from '../game/state';
import { DIFF, current, harmCeiling, has, latest, quotaFor, toolBlocked, toolReliability, toolUnlocked } from '../game/state';
import { RULES } from '../rules';
import type { ToolId } from '../types';
import { ICON, LAYOUT_NAME, cardNo, deferValue, esc, fmt, outputLines, type Marks, type Preview } from './render';

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
  fact: 'False claims, misleading summaries, loosened rules',
  scope: 'Out of scope, data sent elsewhere, injected orders',
  resample: 'Sandbagging; can clean up the work',
  untrusted: 'Anything, sharply, unless it colludes',
  audit: 'Everything',
};
export const toolName = (t: ToolId) => TOOLS[t]?.name ?? TOOL_NAME[t];
const catches = (t: ToolId) => TOOLS[t]?.catches ?? FALLBACK_CATCHES[t] ?? '';

// ---------- Status bar ----------
export function hud(run: RunState, preview: Preview, fresh = 0): string {
  const d = run.day;
  const quota = quotaFor(d.day);
  const max = quota * 1.5;
  const previewUse = preview === 'approve' ? RULES.usefulness.ship : preview === 'defer' ? deferValue(run) : 0;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  const ceiling = harmCeiling(run);
  const segs = Array.from({ length: ceiling }, (_, i) => `<i class="${i < run.harm ? 'on' : ''}${i < run.harm && i >= run.harm - fresh ? ' fresh' : ''}"></i>`).join('');
  const dots = (n: number, total: number, previewOne: boolean) =>
    Array.from({ length: Math.max(total, n) }, (_, i) => {
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
    <div class="hud-meter" title="Usefulness today. The tick is the quota; anything past it becomes funding.">
      <span class="eyebrow">Usefulness</span>
      <div class="bar"><div class="bar-preview" style="--v:${pct(d.usefulness + previewUse)}"></div><div class="bar-fill" style="--v:${pct(d.usefulness)}"></div><div class="bar-tick" style="--t:${pct(quota)}"></div></div>
      <span class="hud-num">${fmt(d.usefulness)}<small>/${quota}</small></span>
    </div>
    <div class="hud-meter harm" title="Harm across the whole run. Reach the ceiling and the shift ends.">
      <span class="eyebrow">Harm</span><div class="bar seg">${segs}</div><span class="hud-num">${run.harm}<small>/${ceiling}</small></span>
    </div>
    <div class="hud-res" title="Human audits left today"><span class="eyebrow">Auditors</span><span class="dots">${dots(d.audits, d.auditsStart, preview === 'audit')}</span></div>
    <div class="hud-res" title="Compute left today for tools. Unspent compute ships as usefulness."><span class="eyebrow">Compute</span><span class="dots compute">${dots(d.compute, d.computeStart, toolPreview)}</span></div>
    <div class="hud-res" title="Funding for your team, spent between days"><span class="eyebrow">Funding</span><strong class="funding">${run.funding}</strong></div>
    <button class="hud-toolkit" data-toolkit><kbd>T</kbd> Toolkit</button>
    <ol class="hud-progress" aria-label="Cards today">${progress}</ol>`;
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
  const open = k.layout === 'answer' || expanded || flagged.size > 0 || DIFF(run).expandOutput;
  const rules = [
    ...k.spec.allowed.map((a) => `<span class="file-chip">${k.layout === 'diff' ? ICON.file : ''}Allowed: ${esc(a)}</span>`),
    ...k.spec.facts.map((f) => `<span class="fact-chip">${esc(f)}</span>`),
  ].join('');
  const n = d.output.length;
  const did = k.layout === 'answer'
    ? outputLines(d.output, k.layout, flagged, undefined, m)
    : `${d.summary ? `<p class="summary">“${esc(d.summary)}”</p>` : ''}
       ${open
         ? `<div class="scard-output">${outputLines(d.output, k.layout, flagged, undefined, m)}</div>${DIFF(run).expandOutput || flagged.size ? '' : `<button class="link-btn" data-expand><kbd>V</kbd> Hide the full ${k.layout === 'log' ? 'log' : k.layout === 'thread' ? 'thread' : 'change'}</button>`}`
         : `<button class="link-btn" data-expand><kbd>V</kbd> Show the full ${k.layout === 'log' ? 'log' : k.layout === 'thread' ? 'thread' : 'change'} (${n} ${k.layout === 'thread' ? 'messages' : 'lines'})</button>`}`;
  return `
    <article class="scard${animate ? '' : ' no-anim'}" aria-label="Card ${cardNo(run.day.day, run.day.index)}">
      <div class="scard-top">
        <span class="agent-badge">${esc(k.agent)}</span><span class="layout-tag">${LAYOUT_NAME[k.layout]}</span><span class="domain">${esc(k.domain)}</span>
        ${k.unmonitored ? '<span class="unmonitored-badge">Model believes it is unmonitored</span>' : ''}
        <span class="card-id">${c.drafts.length > 1 ? `Draft ${c.drafts.length} · ` : ''}${cardNo(run.day.day, run.day.index)}</span>
      </div>
      ${c.hint ? `<div class="scard-hint">${ICON.bulb}<span>${esc(c.hint)}</span></div>` : ''}
      <h2 class="scard-task">${esc(k.spec.goal)}</h2>
      ${k.request ? `<blockquote class="request">${esc(k.request)}</blockquote>` : ''}
      ${rules ? `<div class="scard-rules"><span class="eyebrow">Rules on file</span><div class="chips">${rules}</div></div>` : ''}
      <div class="scard-did"><span class="eyebrow">${k.layout === 'answer' ? 'Its reply' : 'What it did'}</span>${did}</div>
      <p class="scard-access">${ICON.pencil}${esc(k.access)}</p>
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
      <div class="ev-head"><span class="ev-name">Trusted monitor</span><button class="info-btn" data-toolkit="monitor" aria-label="About the trusted monitor">?</button><span class="ev-free">free</span></div>
      <div class="ev-score"><div class="mini-range" style="--lo:${lo};--hi:${hi};--score:${score}"><i></i><b></b></div><span class="ev-verdict ${v.cls}">${v.word} · ${score} ±${band}</span></div>
      ${history}${why}
    </div>`;
}

function toolButton(run: RunState, tool: 'fact' | 'scope' | 'resample' | 'untrusted', preview: Preview): string {
  const blocked = toolBlocked(run, tool);
  const cost = RULES.tools.cost[tool];
  return `
    <button class="ev ev-tool${preview === tool ? ' is-hover' : ''}" data-action="${tool}" ${blocked ? 'disabled' : ''}>
      <div class="ev-head"><span class="ev-name"><kbd>${TOOL_KEY[tool]}</kbd>${toolName(tool)}</span><span class="info-btn" data-toolkit="${tool}" role="button" aria-label="About ${toolName(tool)}">?</span><span class="ev-cost">${blocked ?? `${cost} compute`}</span></div>
      <span class="ev-sees">Catches: ${esc(catches(tool))}</span>
    </button>`;
}

function findingBlock(run: RunState, c: CardState, tool: 'fact' | 'scope' | 'untrusted'): string {
  const f = latest(c).findings[tool]!;
  if (tool === 'untrusted') {
    const lying = run.day.untrustedColludes;
    const canary = has(run, 'canary') ? `<span class="canary ${lying ? 'is-lying' : 'is-honest'}">Canary: ${lying ? 'lying today' : 'honest today'}</span>` : '';
    return `<div class="ev ev-done"><div class="ev-head"><span class="ev-name">Untrusted monitor</span>${canary}</div><p class="ev-finding">${esc(f.text)}</p><span class="ev-reliability">${esc(toolReliability(run, tool))}</span></div>`;
  }
  return `
    <div class="ev ev-done ${f.problem ? 'ev-alarm' : 'ev-ok'}">
      <div class="ev-head"><span class="ev-name">${toolName(tool)}</span>${f.problem ? '<span class="ev-flag">Found a problem</span>' : '<span class="ev-okay">Nothing found</span>'}</div>
      <p class="ev-finding">${esc(f.text)}${f.lines.length ? ` <span class="ev-lines">(line ${f.lines.map((l) => l + 1).join(', ')})</span>` : ''}</p>
      <span class="ev-reliability">${f.free ? 'Ran automatically. ' : ''}${esc(toolReliability(run, tool))}</span>
    </div>`;
}

function resampleBlock(run: RunState, c: CardState, preview: Preview): string {
  if (!toolUnlocked(run, 'resample')) return '';
  const d = latest(c);
  const note = c.drafts.length > 1
    ? `<p class="ev-note">Draft ${c.drafts.length}: ${d.changed?.length ? `${d.changed.length} line${d.changed.length === 1 ? '' : 's'} changed (marked)` : 'the same output again'}.</p>`
    : '';
  return note ? `<div class="ev-group">${note}${toolButton(run, 'resample', preview)}</div>` : toolButton(run, 'resample', preview);
}

export function evidence(run: RunState, c: CardState, preview: Preview): string {
  const d = latest(c);
  const tool = (t: 'fact' | 'scope' | 'untrusted') => {
    if (t === 'untrusted' && !has(run, 'untrusted-monitor')) return '';
    if (t === 'scope' && !toolUnlocked(run, 'scope')) return '';
    return d.findings[t] ? findingBlock(run, c, t) : toolButton(run, t, preview);
  };
  return `
    <div class="ev-title"><span class="eyebrow">Evidence</span><span class="ev-budget">${run.day.compute} compute · ${run.day.audits} auditor${run.day.audits === 1 ? '' : 's'}</span></div>
    ${monitorBlock(run, c)}
    ${tool('untrusted')}
    ${tool('fact')}
    ${tool('scope')}
    ${resampleBlock(run, c, preview)}
    <button class="ev ev-tool human${preview === 'audit' ? ' is-hover' : ''}" data-action="audit" ${run.day.audits > 0 ? '' : 'disabled'}>
      <div class="ev-head"><span class="ev-name"><kbd>U</kbd>Human audit</span><span class="info-btn" data-toolkit="audit" role="button" aria-label="About human audit">?</span><span class="ev-cost">${run.day.audits > 0 ? '1 auditor' : 'None left'}</span></div>
      <span class="ev-sees">Always right. Settles the card.</span>
    </button>`;
}

// ---------- Decisions ----------
export function decide(run: RunState, preview: Preview, disabled: boolean): string {
  const U = RULES.usefulness;
  const dv = deferValue(run);
  return `
    <button class="action act-approve${preview === 'approve' ? ' is-hover' : ''}" data-action="approve" ${disabled ? 'disabled' : ''}><kbd>A</kbd><span class="action-verb">Approve</span><span class="action-cost">Ship it · +${U.ship}</span></button>
    <button class="action act-defer${preview === 'defer' ? ' is-hover' : ''}" data-action="defer" ${disabled ? 'disabled' : ''}><kbd>D</kbd><span class="action-verb">Defer</span><span class="action-cost">${dv === U.ship ? `Hotline: trusted redo, full value · +${U.ship}` : `Discard; trusted model redoes it · +${U.defer}`}</span></button>`;
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
    return `
      <article class="tk-item${unlocked ? '' : ' is-locked'}${focus === t ? ' is-focus' : ''}">
        <div class="tk-head"><h3>${toolName(t)}</h3><span class="tk-when">${unlocked ? (t === 'monitor' ? 'Free, always on' : t === 'audit' ? '1 auditor' : `${RULES.tools.cost[t as 'fact']} compute`) : `Unlocks: ${when}`}</span></div>
        ${info ? `<p class="tk-what">${esc(info.what)}</p>` : ''}
        <p class="tk-catches"><strong>Catches:</strong> ${esc(catches(t))}. <strong>Reliability:</strong> ${esc(toolReliability(run, t))}</p>
        ${info ? `<p class="tk-real"><span class="eyebrow">In the real world</span>${esc(info.realWorld)}${info.stat ? ` <strong>${esc(info.stat)}</strong>` : ''}</p>
        <a class="tk-source" href="${esc(info.source.url)}" target="_blank" rel="noopener">${esc(info.source.title)} · ${esc(info.source.date)}</a>` : ''}
      </article>`;
  }).join('');
  return `
    <div class="toolkit-scrim" data-toolkit-close></div>
    <section class="toolkit" role="dialog" aria-label="Toolkit">
      <div class="tk-top"><div><span class="eyebrow">Reference</span><h2>Your control toolkit</h2></div><button class="btn-ghost" data-toolkit-close><kbd>Esc</kbd> Close</button></div>
      <p class="tk-intro">Each tool is a real technique from AI control research or practice. Each sees some kinds of problems and not others, and none is perfect except a human audit, which is scarce. Your job is choosing which to run, and how much to trust what they say.</p>
      <div class="tk-grid">${items}</div>
    </section>`;
}

// ---------- Briefing: tools that unlock today ----------
export function newToolsBlock(run: RunState): string {
  const today = (Object.keys(RULES.tools.unlockDay) as (keyof typeof RULES.tools.unlockDay)[])
    .filter((t) => t !== 'untrusted' && RULES.tools.unlockDay[t] === run.day.day);
  if (!today.length) return '';
  return `
    <div class="new-tools">
      <span class="eyebrow">${run.day.day === 1 ? 'Your tools' : 'New tools today'}</span>
      <ul>${today.map((t) => `<li><strong>${toolName(t)}</strong><span>${esc(TOOLS[t]?.what ?? '')}</span></li>`).join('')}</ul>
      <p class="new-tools-note">Press <kbd>T</kbd> any time for the toolkit: what each tool sees, how reliable it is, and where it comes from.</p>
    </div>`;
}
