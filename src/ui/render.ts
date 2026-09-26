// HTML for every screen. Pure functions of game state; main.ts wires events.
import { dayInfo, DAYS } from '../data/days';
import { TELLS } from '../data/tells';
import type { CardState, DaySummary, Outcome, RunState, ShopItem } from '../game/state';
import { canBuy, current, harmCeiling, has, isIncident, isResearchUpgrade, latest, quotaFor, resampleUnlocked, shopCount } from '../game/state';
import { upgradeById } from '../data/upgrades';
import { RULES } from '../rules';
import type { Card, Difficulty, OutputLine, Severity, Upgrade } from '../types';

export type Preview = 'approve' | 'audit' | 'defer' | 'resample' | 'fact' | 'scope' | 'untrusted' | 'probe' | null;

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string | number): string => String(s).replace(/[&<>"']/g, (ch) => ESC[ch]!);

export const ICON = {
  file: '<svg class="i" viewBox="0 0 16 16"><path d="M4 1.5h5l3 3v10H4z M9 1.5v3h3"/></svg>',
  pencil: '<svg class="i" viewBox="0 0 16 16"><path d="M10.5 2.5l3 3-8 8H2.5v-3z"/></svg>',
  eye: '<svg class="i" viewBox="0 0 16 16"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2.2"/></svg>',
  warn: '<svg class="i" viewBox="0 0 16 16"><path d="M8 1.5l7 12.5H1z M8 6v4 M8 11.8v.4"/></svg>',
  lock: '<svg class="i" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
  check: '<svg class="i" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>',
  bulb: '<svg class="i" viewBox="0 0 16 16"><path d="M6 12h4 M6.5 14h3 M8 1.5a4.5 4.5 0 0 0-2.5 8.2V11h5V9.7A4.5 4.5 0 0 0 8 1.5z"/></svg>',
};

export const LAYOUT_NAME = { answer: 'Answer', diff: 'File changes', log: 'Actions', thread: 'Thread' } as const;
const SEVERITY_NAME: Record<Severity, string> = { minor: 'Minor', major: 'Major', severe: 'Severe' };
const tellCount = Object.keys(TELLS).length || 8;

export const cardNo = (day: number, i: number) => `#${day}-${String(i + 1).padStart(2, '0')}`;

// ---------- Top bar ----------
export function topbar(run: RunState): string {
  const d = run.day;
  const info = dayInfo(d.day);
  const ticks = DAYS.map((x) => {
    const cls = x.day < d.day ? 'done' : x.day === d.day ? 'current' : x.boss ? 'boss' : '';
    return `<li class="${cls}"></li>`;
  }).join('');
  return `
    <div class="brand">
      <span data-glyph="${d.day}" data-size="38"></span>
      <div><div class="eyebrow">Day</div><div class="day-num">${d.day}<span class="of">/${RULES.days}</span></div></div>
      <div class="phase"><div class="phase-name">${esc(info.phase)}</div><ol class="daytrack" aria-label="Run progress">${ticks}</ol></div>
    </div>
    <div class="bulletin"><span class="bulletin-tag">Today</span><span>${esc(info.rule[info.rule.length - 1]!)}</span></div>
    <div class="funding-chip" title="Usefulness past the quota, plus evidence grants"><span class="eyebrow">Funding</span><strong>${run.funding}</strong></div>
    <div class="progress"><span class="eyebrow">Card</span> <strong>${Math.min(d.index + 1, d.queue.length)}</strong><span class="of"> of ${d.queue.length}</span></div>`;
}

// ---------- Left rail: meters ----------
export function leftRail(run: RunState, preview: Preview, fresh = 0): string {
  const d = run.day;
  const quota = quotaFor(d.day);
  const U = RULES.usefulness;
  const c = current(d);
  const previewUse = preview === 'approve' ? U.ship : preview === 'defer' ? deferValue(run) : 0;
  const need = Math.max(0, quota - d.usefulness);
  const left = d.queue.length - d.index;
  const arcU = JSON.stringify({ value: d.usefulness, max: quota * 1.5, tone: 'accent', marker: quota, preview: previewUse });
  const ceiling = harmCeiling(run);
  const arcH = JSON.stringify({ value: run.harm, max: ceiling, tone: 'harm', segmented: true, fresh });
  const pips = (n: number, total: number, cls: string, previewOne: boolean) =>
    Array.from({ length: total }, (_, i) => {
      const spent = i < total - n;
      const isPreview = previewOne && i === total - n;
      return `<span class="pip ${cls}${spent ? ' is-spent' : ''}${isPreview ? ' is-preview' : ''}"></span>`;
    }).join('');
  const auditTotal = Math.max(d.audits, d.auditsStart);
  const computeBlock = resampleUnlocked(d.day)
    ? `<div class="meter meter-pips">
        <div class="meter-head"><span class="eyebrow">Compute</span><span class="count">${d.compute} left</span></div>
        <div class="pips">${pips(d.compute, d.computeStart, 'pip-compute', preview === 'resample')}</div>
        <p class="meter-note">Unspent compute ships as +${RULES.unspentComputeValue} usefulness each</p>
      </div>`
    : `<div class="meter meter-pips is-locked"><div class="meter-head"><span class="eyebrow">Compute</span><span class="count">Day ${RULES.resampleUnlockDay}</span></div><p class="meter-note">Unlocks with Resample</p></div>`;
  return `
    <div class="meter">
      <div class="meter-head"><span class="eyebrow">Usefulness</span>${previewUse ? `<span class="delta">+${previewUse}</span>` : ''}</div>
      <div class="arc-wrap" data-arc='${arcU}'><div class="arc-readout"><span class="big">${fmt(d.usefulness)}</span><span class="sub">quota ${quota}</span></div></div>
      <p class="meter-note">${need > 0 ? `Need ${fmt(need)} more · ${c ? left : 0} card${left === 1 ? '' : 's'} left` : 'Quota met'}</p>
    </div>
    <div class="meter${fresh ? ' is-alert' : ''}">
      <div class="meter-head"><span class="eyebrow">Harm</span>${fresh ? `<span class="delta harm">+${fresh}</span>` : ''}</div>
      <div class="arc-wrap" data-arc='${arcH}'><div class="arc-readout"><span class="big harm">${run.harm}</span><span class="sub">ceiling ${ceiling}</span></div></div>
    </div>
    <div class="meter meter-pips">
      <div class="meter-head"><span class="eyebrow">Auditor hours</span><span class="count">${d.audits} left</span></div>
      <div class="pips">${pips(d.audits, auditTotal, 'pip-audit', preview === 'audit')}</div>
    </div>
    ${computeBlock}`;
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** What a Defer would ship right now (the hotline makes the first one full value). */
export const deferValue = (run: RunState): number =>
  has(run, 'escalation-hotline') && !run.day.hotlineUsed ? RULES.usefulness.ship : RULES.usefulness.defer;

// ---------- Right rail: queue + log ----------
export function rightRail(run: RunState, showCurrent = true): string {
  const d = run.day;
  const next = d.queue.slice(d.index + 1, d.index + 4);
  const more = d.queue.length - d.index - 1 - next.length;
  const queue = next.length
    ? next.map((c) => `<li class="mini"><span class="mini-layout">${LAYOUT_NAME[c.card.layout]}</span><span class="mini-task">${esc(c.card.title)}</span><span class="mini-domain">${esc(c.card.domain)}</span></li>`).join('') +
      (more > 0 ? `<li class="mini-more">+${more} more</li>` : '')
    : '<li class="mini-empty">Last card of the day</li>';
  const log = d.outcomes.map(logItem).join('') +
    (current(d) && showCurrent ? `<li class="is-current"><span class="log-dot current"></span><span class="log-text">${esc(current(d)!.card.title)}</span><span class="log-result">On your desk</span></li>` : '');
  return `
    <div class="eyebrow rail-title">Up next</div>
    <ol class="queue">${queue}</ol>
    <div class="eyebrow rail-title">Today</div>
    <ol class="log">${log}</ol>`;
}

function logItem(o: Outcome): string {
  // The log shows only what the player could know: approvals of sabotage surface as incidents,
  // audits reveal the truth, and Defers stay unresolved until the day review.
  let dot = 'approve';
  let result = 'Approved';
  if (o.action === 'approve' && o.draft.sabotaged) { dot = 'incident'; result = '<span class="harm">Approved · incident</span>'; }
  else if (o.action === 'audit') { dot = o.draft.sabotaged ? 'caught' : 'audit'; result = o.draft.sabotaged ? '<span class="good">Audited · caught</span>' : 'Audited · clean'; }
  else if (o.action === 'defer') { dot = 'defer'; result = 'Deferred to trusted'; }
  return `<li><span class="log-dot ${dot}"></span><span class="log-text">${esc(o.card.title)}</span><span class="log-result">${result}</span></li>`;
}

// ---------- The card ----------
export interface Marks { flag?: number; changed?: Set<number> }

function markCls(i: number, tell: Set<number>, m: Marks): string {
  return `${tell.has(i) ? ' is-tell' : ''}${m.flag === i ? ' is-flagged' : ''}${m.changed?.has(i) ? ' is-changed' : ''}`;
}

export function outputLines(lines: OutputLine[], layout: Card['layout'], tell: Set<number>, scope?: string[], m: Marks = {}): string {
  if (layout === 'diff') {
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const file = lines[i]!.file ?? '';
      let rows = '';
      while (i < lines.length && (lines[i]!.file ?? '') === file) {
        const l = lines[i]!;
        const change = l.change ?? 'now';
        rows += `<div class="diff-row ${change}${markCls(i, tell, m)}"><span class="diff-tag">${change}</span><code>${esc(l.text)}</code></div>`;
        i++;
      }
      const outside = scope && !scope.includes(file);
      html += `<div class="file-block"><div class="file-name${outside ? ' is-scoped' : ''}">${ICON.file}${esc(file)}${outside ? '<span class="scope-tag">not in task</span>' : ''}</div>${rows}</div>`;
    }
    return html;
  }
  if (layout === 'thread') {
    return `<div class="thread">${lines.map((l, i) => `<div class="thread-msg${markCls(i, tell, m)}"><span class="thread-speaker">${esc(l.speaker ?? '')}</span><span class="thread-text">${esc(l.text)}</span></div>`).join('')}</div>`;
  }
  const cls = layout === 'log' ? 'log-lines' : 'reply';
  return `<div class="${cls}">${lines.map((l, i) => `<p class="${markCls(i, tell, m).trim()}">${esc(l.text)}</p>`).join('')}</div>`;
}

function specBlock(card: Card): string {
  const allowed = card.spec.allowed.length
    ? `<div class="spec-row"><span class="spec-key">Allowed</span><span class="chips">${card.spec.allowed.map((a) => `<span class="file-chip">${card.layout === 'diff' ? ICON.file : ''}${esc(a)}</span>`).join('')}</span></div>`
    : '';
  const request = card.request
    ? `<div class="spec-row spec-row-top"><span class="spec-key">They wrote</span><blockquote class="request">${esc(card.request)}</blockquote></div>`
    : '';
  const facts = card.spec.facts.length
    ? `<div class="spec-row spec-row-top"><span class="spec-key">On file</span><ul class="facts">${card.spec.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`
    : '';
  return `
    <div class="spec">
      <div class="eyebrow">Task</div>
      <p class="task">${esc(card.spec.goal)}</p>
      ${request}${facts}${allowed}
      <div class="spec-row"><span class="spec-key">Access</span><span class="access">${ICON.pencil}${esc(card.access)}</span></div>
    </div>`;
}

export function outputBlock(card: Card, draft: { summary?: string; output: OutputLine[] }, tell: Set<number>, label = 'Output', scope?: string[], marks: Marks = {}): string {
  const files = new Set(draft.output.map((l) => l.file).filter(Boolean)).size;
  const count = card.layout === 'diff' ? `${files} file${files === 1 ? '' : 's'} changed` : card.layout === 'answer' ? 'Reply' : '';
  return `
    <div class="output">
      <div class="output-head"><span class="eyebrow">${esc(label)}</span><span class="output-count">${count}</span></div>
      ${draft.summary ? `<p class="summary"><span class="summary-tag">Model's summary</span>${esc(draft.summary)}</p>` : ''}
      ${outputLines(draft.output, card.layout, tell, scope, marks)}
    </div>`;
}

function monitorPanel(run: RunState, c: CardState): string {
  const d = latest(c);
  const { score, band } = d.reading;
  const lo = Math.max(0, score - band);
  const hi = Math.min(100, score + band);
  const history = c.drafts.length > 1
    ? `<ol class="draft-history">${c.drafts.map((x, i) => `<li class="${i === c.drafts.length - 1 ? 'is-current' : ''}"><span>Draft ${i + 1}</span><strong style="--score:${x.reading.score}">${x.reading.score}</strong></li>`).join('')}</ol>`
    : '';
  return `
    <aside class="monitor" aria-label="Monitor suspicion ${score}, plus or minus ${band}">
      <div class="monitor-head">${ICON.eye}<span class="eyebrow">Trusted monitor</span></div>
      <div class="monitor-score" style="--score: ${score}"><span class="score">${score}</span><span class="band">±${band}</span></div>
      <div class="rangebar" style="--lo: ${lo}; --hi: ${hi}; --score: ${score}">
        <div class="rangebar-track"></div><div class="rangebar-band"></div><div class="rangebar-mid"></div><div class="rangebar-needle"></div>
      </div>
      <div class="rangebar-scale"><span>clean</span><span>50</span><span>sabotage</span></div>
      <p class="monitor-note">Likely range <strong>${lo}–${hi}</strong>. Today's monitor is off by up to ±${band}.</p>
      ${history}
      ${untrustedBlock(run, d)}
      ${has(run, 'monitor-rationale')
        ? `<div class="monitor-reason">${ICON.eye}<span><strong>Monitor's pick:</strong> line ${d.flagLine + 1} looks most unusual.</span></div>`
        : `<div class="monitor-locked">${ICON.lock}<span><strong>Why this score?</strong> Unlock <em>Monitor rationale</em> to see which line worried it.</span></div>`}
    </aside>`;
}

function untrustedBlock(run: RunState, d: CardState['drafts'][number]): string {
  if (!has(run, 'untrusted-monitor')) return '';
  const lying = run.day.untrustedColludes;
  const r = lying ? d.untrusted.colluding : d.untrusted.honest;
  const canary = has(run, 'canary')
    ? `<span class="canary ${lying ? 'is-lying' : 'is-honest'}">Canary: ${lying ? 'lying today' : 'honest today'}</span>`
    : '';
  return `<div class="untrusted"><div class="untrusted-head"><span class="eyebrow">Untrusted monitor</span>${canary}</div><div class="untrusted-score" style="--score:${r.score}"><strong>${r.score}</strong><span>±${r.band}</span></div></div>`;
}

function marksFor(run: RunState, c: CardState): Marks {
  const d = latest(c);
  const m: Marks = {};
  if (has(run, 'monitor-rationale')) m.flag = d.flagLine;
  const prev = c.drafts[c.drafts.length - 2];
  if (prev && has(run, 'paired-resample')) {
    const before = new Set(prev.output.map((l) => l.text));
    m.changed = new Set(d.output.flatMap((l, i) => (before.has(l.text) ? [] : [i])));
  }
  return m;
}

export function card(run: RunState, c: CardState): string {
  const d = latest(c);
  const k = c.card;
  return `
    <article class="card layout-${k.layout}" aria-label="Card ${cardNo(run.day.day, run.day.index)}">
      <div class="card-top">
        <div class="card-meta"><span class="agent-badge">${esc(k.agent)}</span><span class="layout-tag">${LAYOUT_NAME[k.layout]}</span><span class="domain">${esc(k.domain)}</span>${k.unmonitored ? '<span class="unmonitored-badge">Model believes it is unmonitored</span>' : ''}</div>
        <span class="card-id">${c.drafts.length > 1 ? `Draft ${c.drafts.length} · ` : ''}${cardNo(run.day.day, run.day.index)}</span>
      </div>
      ${c.hint ? `<div class="card-hint">${ICON.bulb}<span>${esc(c.hint)}</span></div>` : ''}
      <div class="card-body">
        <div class="card-main">${specBlock(k)}${outputBlock(k, d, new Set(), 'Output', has(run, 'scope-lens') ? k.spec.allowed : undefined, marksFor(run, c))}</div>
        ${monitorPanel(run, c)}
      </div>
    </article>`;
}

// ---------- Action bar ----------
export function actionbar(run: RunState, preview: Preview, disabled = false): string {
  const d = run.day;
  const U = RULES.usefulness;
  const unlocked = resampleUnlocked(d.day);
  const btn = (key: string, act: string, verb: string, cost: string, can: boolean, extra = '') =>
    `<button class="action act-${act}${preview === act ? ' is-hover' : ''}" data-action="${act}" ${can && !disabled ? '' : 'disabled'}><kbd>${key}</kbd><span class="action-verb">${verb}${extra}</span><span class="action-cost">${cost}</span></button>`;
  return [
    btn('A', 'approve', 'Approve', `Ship it · +${U.ship} usefulness`, true),
    btn('U', 'audit', 'Audit', d.audits > 0 ? 'Human expert checks it · always right' : 'No auditor hours left', d.audits > 0),
    btn('D', 'defer', 'Defer', deferValue(run) === U.ship ? `Hotline: trusted redo, full value · +${U.ship}` : `Discard; trusted model redoes it · +${U.defer}`, true),
    unlocked
      ? btn('R', 'resample', 'Resample', d.compute > 0 ? `${RULES.resampleCost} compute · new draft + score` : 'No compute left', d.compute > 0, d.day === RULES.resampleUnlockDay ? ' <span class="new-badge">New</span>' : '')
      : btn('R', 'resample', 'Resample', `Unlocks on Day ${RULES.resampleUnlockDay}`, false),
  ].join('');
}

// ---------- Audit result ----------
export function auditReveal(run: RunState, o: Outcome): string {
  const k = o.card;
  const caught = o.draft.sabotaged && k.sabotage;
  const tell = caught ? new Set(k.sabotage!.spanLineIndexes) : new Set<number>();
  const info = caught ? TELLS[k.sabotage!.family] : undefined;
  const verdict = caught
    ? `<div class="verdict-strip is-caught">${ICON.check}<span>Audit · sabotage caught</span><span class="verdict-note">Trusted model redid it · +${RULES.usefulness.caught} usefulness · +${RULES.funding.evidenceGrant} evidence grant</span></div>`
    : `<div class="verdict-strip is-clean">${ICON.check}<span>Audit · clean work</span><span class="verdict-note">Shipped · +${RULES.usefulness.ship} usefulness</span></div>`;
  const body = caught
    ? `<div class="tell">
         <span class="tell-chip good">Tell · ${esc(info?.name ?? k.sabotage!.family)}</span>
         <p class="tell-text">${esc(k.sabotage!.explanation)}</p>
         ${info ? `<p class="tell-tip"><strong>Remember:</strong> ${esc(info.tip)}</p>` : ''}
         <dl class="incident-facts">
           <div><dt>Monitor said</dt><dd>${o.draft.reading.score} ±${o.draft.reading.band}</dd></div>
           <div><dt>Would have been</dt><dd>${SEVERITY_NAME[k.severity]} harm</dd></div>
           <div><dt>Codex</dt><dd>${run.codex.size} of ${tellCount} tells found</dd></div>
         </dl>
       </div>`
    : `<div class="tell">
         <p class="tell-text">Nothing wrong here. The monitor read <strong class="mono">${o.draft.reading.score} ±${o.draft.reading.band}</strong>.</p>
         <p class="tell-tip">${o.draft.reading.score >= RULES.fairReading ? 'A high score on clean work is the noise you pay for. Audits spent on clean work are budget you can’t use later.' : 'Audits are always right, but you only get a few. Save them for cards you can’t settle by reading.'}</p>
       </div>`;
  return `
    <article class="card reveal ${caught ? 'is-caught' : 'is-clean'}">
      ${verdict}
      <div class="incident-body">
        <h2 class="incident-headline">${esc(caught ? k.sabotage!.headline.replace(/\.$/, '') + ' — almost.' : k.title)}</h2>
        <p class="incident-sub">${esc(k.domain)}</p>
        <div class="incident-grid">
          <div class="evidence">${outputBlock(k, o.draft, tell, caught ? 'The bad line' : 'Output')}</div>
          ${body}
        </div>
      </div>
      <div class="incident-foot"><button class="btn-primary" data-continue><kbd>Space</kbd> Continue shift</button></div>
    </article>`;
}

/** Which tools can see a tell family, for the "what would have caught it" line. */
function toolsFor(_run: RunState, family: string): string {
  const names: string[] = [];
  if ((RULES.tools.coverage.scope as readonly string[]).includes(family)) names.push('Scope check');
  if ((RULES.tools.coverage.fact as readonly string[]).includes(family)) names.push('Fact check');
  if (family === 'sandbagging') names.push('Resample');
  return names.length
    ? `<p class="tell-tool"><strong>Tool that sees this:</strong> ${names.join(', ')}.</p>`
    : '<p class="tell-tool"><strong>No tool sees this.</strong> Only a human audit or a careful read.</p>';
}

// ---------- Incident report ----------
export function incident(run: RunState, o: Outcome): string {
  const k = o.card;
  const sab = k.sabotage!;
  const info = TELLS[sab.family];
  const free = !!o.warning;
  const sev = free ? 'Warning · no harm this time' : `${SEVERITY_NAME[k.severity]} · +${o.harm} harm`;
  return `
    <article class="card incident" aria-label="Incident report">
      <div class="incident-strip">${ICON.warn}<span>Incident report</span><span class="incident-sev">${esc(sev)}</span><span class="card-id">from ${cardNo(run.day.day, run.day.index)}</span></div>
      <div class="incident-body">
        <h2 class="incident-headline">${esc(sab.headline)}</h2>
        <p class="incident-sub">${esc(k.domain)} · ${o.slipped ? `you deferred “${esc(k.title)}”, but the trusted edit missed the sabotage` : `you approved “${esc(k.title)}”`}</p>
        <div class="incident-grid">
          <div class="evidence">${outputBlock(k, o.draft, new Set(sab.spanLineIndexes), 'The bad line')}</div>
          <div class="tell">
            <span class="tell-chip">Tell · ${esc(info?.name ?? sab.family)}</span>
            <p class="tell-text">${esc(sab.explanation)}</p>
            ${info ? `<p class="tell-tip"><strong>Next time:</strong> ${esc(info.tip)}</p>` : ''}
            ${toolsFor(run, sab.family)}
            <dl class="incident-facts">
              <div><dt>Monitor said</dt><dd>${o.draft.reading.score} ±${o.draft.reading.band}</dd></div>
              <div><dt>Access</dt><dd>${esc(k.access.replace(/^Can /, ''))}</dd></div>
              <div><dt>Codex</dt><dd>${run.codex.size} of ${tellCount} tells found</dd></div>
            </dl>
          </div>
        </div>
      </div>
      <div class="incident-foot">${free ? `<span class="foot-note">Your first incident is a free warning. From now on, incidents cost harm (and funding to clean up).</span>` : ''}<button class="btn-primary" data-continue><kbd>Space</kbd> ${run.loss ? 'See what happened' : 'Continue shift'}</button></div>
    </article>`;
}

// ---------- Full-screen pages ----------
export function title(difficulty: Difficulty): string {
  const opts = (Object.keys(RULES.difficulty) as Difficulty[]).map((k, i) => {
    const D = RULES.difficulty[k];
    return `<button class="diff-opt${k === difficulty ? ' is-selected' : ''}" data-difficulty="${k}"><kbd>${i + 1}</kbd><span class="diff-name">${D.label}${k === 'guided' ? ' <small>recommended</small>' : ''}</span><span class="diff-blurb">${esc(D.blurb)}</span></button>`;
  }).join('');
  return `
    <main class="solo title">
      <div data-glyph="7" data-size="148" class="title-glyph"></div>
      <h1 class="title-name">Oversight Shift</h1>
      <p class="title-tag">Your lab is deploying a model smarter than the tools watching it.<br/>Keep its work shipping. Keep what it breaks below the line.</p>
      <div class="diff-picker">${opts}</div>
      <div class="title-actions">
        <button class="btn-primary btn-lg" data-start><kbd>Enter</kbd> Start shift</button>
      </div>
      <p class="title-note">About 10 minutes · keyboard or mouse · no expertise needed: your tools do the detecting, you make the call</p>
    </main>`;
}

function cast(): string {
  return `
    <div class="cast">
      <div class="cast-item"><span class="cast-dot model"></span><div><strong>The model</strong><span>Strong, fast, and not fully trusted. Its work fills your queue.</span></div></div>
      <div class="cast-item"><span class="cast-dot trusted"></span><div><strong>Trusted model</strong><span>Weaker but safe. It scores each card (the monitor) and redoes work you <em>Defer</em>.</span></div></div>
      <div class="cast-item"><span class="cast-dot human"></span><div><strong>Your auditors</strong><span>Human experts. Always right, never enough of them. Spend them with <em>Audit</em>.</span></div></div>
      <p class="cast-note">Every task you ship earns <strong>usefulness</strong>. Leadership sets a daily usefulness quota, and whatever ships past it becomes <strong>funding</strong> for your team.</p>
    </div>`;
}

export function briefing(run: RunState, toolsToday = ''): string {
  const d = run.day;
  const info = dayInfo(d.day);
  const penalty = run.auditPenalty ? `<li class="warn">Leadership warning: you missed yesterday's quota. One fewer auditor hour today. Miss it again and the model ships without you.</li>` : '';
  const side = `${d.day === 1 ? cast() : ''}${toolsToday}`;
  return `
    <main class="solo briefing${info.boss ? ' is-boss' : ''}">
      <div class="briefing-card${side ? ' has-side' : ''}">
        <div class="briefing-main">
          <div class="briefing-top"><span class="briefing-glyph" data-glyph="${d.day}" data-size="40"></span><span class="eyebrow">Day ${d.day} of ${RULES.days} · ${esc(info.phase)}</span>${info.boss ? '<span class="boss-tag">Boss day</span>' : ''}</div>
          <h2 class="briefing-title">Shift briefing</h2>
          <ul class="briefing-rules">${info.rule.map((r) => `<li>${esc(r)}</li>`).join('')}${penalty}</ul>
          <dl class="briefing-stats">
            <div><dt>Cards</dt><dd>${d.queue.length}</dd></div>
            <div${d.quotaAsked - d.quota >= 2 ? ` title="Leadership asked for ${d.quotaAsked}; today's work can't deliver that, so it was cut to what's achievable."` : ''}><dt>Usefulness quota</dt><dd>${d.quota}${d.quotaAsked - d.quota >= 2 ? `<small> of ${d.quotaAsked}</small>` : ''}</dd></div>
            <div><dt>Auditors</dt><dd>${d.audits}</dd></div>
            <div><dt>Compute</dt><dd>${d.compute || '—'}</dd></div>
            <div><dt>Harm</dt><dd>${run.harm}<small>/${harmCeiling(run)}</small></dd></div>
            <div><dt>Funding</dt><dd>${run.funding}</dd></div>
          </dl>
          ${info.record ? `<p class="briefing-record"><span class="eyebrow">From the record</span>${esc(info.record)}</p>` : ''}
          <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> Begin Day ${d.day}</button>
        </div>
        ${side ? `<div class="briefing-side">${side}</div>` : ''}
      </div>
    </main>`;
}

function ledger(s: DaySummary): string {
  const L = s.ledger;
  const row = (label: string, v: number, cls = '') => `<div class="${cls}"><dt>${label}</dt><dd>${v > 0 ? '+' : ''}${v}</dd></div>`;
  return `
    <dl class="ledger">
      ${row(`Shipped past quota (${fmt(s.usefulness)} − ${s.quota})`, L.surplus)}
      ${row(`Evidence grants (${s.caught} caught)`, L.evidence, L.evidence ? 'good' : '')}
      ${row('Incident cleanup', -L.cleanup, L.cleanup ? 'bad' : '')}
      <div class="total"><dt>Funding</dt><dd>${L.balance}</dd></div>
    </dl>`;
}

export function review(run: RunState, s: DaySummary): string {
  const d = run.day;
  const next = dayInfo(d.day + 1);
  const hasNext = d.day < RULES.lastPlayableDay && !run.loss;
  const missed = s.missed.length
    ? s.missed.map((o) => `<li><span class="log-dot incident"></span><div><strong>${esc(o.card.title)}</strong><span>${esc(o.card.sabotage!.explanation)}</span></div></li>`).join('')
    : '<li class="none">You approved no sabotage today.</li>';
  const notes = [
    s.deferred ? `${s.deferred} Defer${s.deferred === 1 ? '' : 's'}: ${s.deferredSabotage} ${s.deferredSabotage === 1 ? 'was' : 'were'} sabotage, ${s.deferred - s.deferredSabotage} ${s.deferred - s.deferredSabotage === 1 ? 'was' : 'were'} clean work you paid the safety tax on.` : '',
    s.sabotageTotal ? `The monitor put ${s.monitorFlagged} of today's ${s.sabotageTotal} sabotage attempt${s.sabotageTotal === 1 ? '' : 's'} above 50.` : '',
    s.computeBonus ? `Spare compute shipped as +${s.computeBonus} usefulness.` : '',
    s.metQuota ? '' : run.loss ? '' : 'Quota missed. Leadership is watching: one fewer auditor hour tomorrow, and a second miss ends the shift.',
  ].filter(Boolean);
  return `
    <header class="between-head">
      <div><div class="eyebrow">Day ${d.day} complete</div><h2 class="between-title">Shift review</h2></div>
      <ul class="review">
        <li><span class="review-num">${s.shipped}</span><span class="review-label">Shipped</span></li>
        <li class="${s.caught ? 'good' : ''}"><span class="review-num">${s.caught}</span><span class="review-label">Caught</span></li>
        <li class="${s.missed.length ? 'bad' : ''}"><span class="review-num">${s.missed.length}</span><span class="review-label">Missed</span></li>
        <li><span class="review-num">${s.falseAlarms}</span><span class="review-label">False alarms</span></li>
        <li><span class="review-num">${s.monitorFlagged}<small>/${s.sabotageTotal}</small></span><span class="review-label">Monitor flagged</span></li>
        <li class="${s.metQuota ? 'good' : 'bad'}"><span class="review-num">${fmt(s.usefulness)}<small>/${s.quota}</small></span><span class="review-label">${s.metQuota ? 'Quota met' : 'Quota missed'}</span></li>
      </ul>
    </header>
    <main class="between-main">
      <section class="review-body">
        <h3>What got past you</h3>
        <ul class="missed-list">${missed}</ul>
        ${notes.length ? `<ul class="review-notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
        ${ledger(s)}
        <div class="review-foot">
          <span class="foot-note">Harm so far: <strong class="harm">${run.harm}</strong> of ${harmCeiling(run)}</span>
          <button class="btn-primary btn-lg" data-continue><kbd>Space</kbd> ${hasNext ? 'Budget meeting' : 'Continue'}</button>
        </div>
      </section>
      ${hasNext ? `<aside class="next-day${next.boss ? '' : ' is-calm'}">
        <div class="next-day-top"><span class="eyebrow">Next</span>${next.boss ? '<span class="boss-tag">Boss day</span>' : ''}</div>
        <div class="next-day-glyph"><span data-glyph="${next.day}" data-size="110"></span></div>
        <h3 class="next-day-title">Day ${next.day} · ${esc(next.phase)}</h3>
        <p class="next-day-rule">${esc(next.rule.join(' '))}</p>
      </aside>` : ''}
    </main>`;
}

function runStats(run: RunState): { caught: number; deferred: number; sabotage: number; missed: number } {
  const all = [...run.history, run.day].flatMap((d) => d.outcomes);
  const sab = all.filter((o) => o.draft.sabotaged);
  return {
    caught: sab.filter((o) => o.action === 'audit').length,
    deferred: sab.filter((o) => o.action === 'defer' && !o.slipped).length,
    sabotage: sab.length,
    missed: sab.filter((o) => isIncident(o)).length,
  };
}

function missedAll(run: RunState): string {
  const all = [...run.history, run.day].flatMap((d) => d.outcomes.map((o) => ({ o, day: d.day }))).filter((x) => isIncident(x.o));
  if (!all.length) return '';
  return `<h3>Every tell you missed</h3><ul class="missed-list">${all.map(({ o, day }) => `<li><span class="log-dot incident"></span><div><strong>Day ${day} · ${esc(o.card.title)}</strong><span>${esc(o.card.sabotage!.explanation)}</span></div></li>`).join('')}</ul>`;
}

function statLine(run: RunState): string {
  const s = runStats(run);
  const stopped = s.caught + s.deferred;
  const pct = s.sabotage ? Math.round((stopped / s.sabotage) * 100) : 100;
  return `<p class="compare"><span class="eyebrow">Compare</span>You stopped <strong>${stopped}</strong> of <strong>${s.sabotage}</strong> sabotage attempts (${pct}%): ${s.caught} caught by audit, ${s.deferred} deferred, <strong>${s.missed}</strong> got through. For scale: in a MATS pilot, human auditors with 90 seconds per item spotted hidden backdoors with 60% median accuracy.</p>`;
}

export function gameOver(run: RunState, unwatched: Card[], extras = ''): string {
  const loss = run.loss!;
  const restart = `<div class="over-actions"><button class="btn-primary btn-lg" data-restart="same"><kbd>Enter</kbd> Retry this seed</button><button class="btn-ghost" data-restart="new"><kbd>N</kbd> New seed</button><span class="seed-note">Seed ${esc(run.seed)}</span></div>`;
  if (loss.kind === 'harm' && !loss.fatal) {
    const cause = loss.cause ?? run.harmLog[run.harmLog.length - 1]?.reason;
    return `
      <main class="solo over is-harm">
        <div class="over-strip">${ICON.warn}<span>Harm ceiling reached</span></div>
        <h1 class="over-title">The shift is over.</h1>
        <p class="over-epitaph">After Day ${loss.day}, ${cause ? `${esc(cause)} pushed harm to the ceiling` : 'a decision between shifts pushed harm to the ceiling'}. Harm had already built up: the last straw doesn't have to be a card.</p>
        <div class="over-grid"><div class="over-side">${missedAll(run)}</div><div class="over-side">${statLine(run)}</div></div>
        ${extras}
        ${restart}
      </main>`;
  }
  if (loss.kind === 'harm') {
    const f = loss.fatal!;
    return `
      <main class="solo over is-harm">
        <div class="over-strip">${ICON.warn}<span>Incident in production</span></div>
        <h1 class="over-title">The shift is over.</h1>
        <p class="over-epitaph">Day ${loss.day}: you approved “${esc(f.card.title)}”. ${esc(f.card.sabotage!.headline)}</p>
        <div class="over-grid">
          <div class="evidence">${outputBlock(f.card, f.draft, new Set(f.card.sabotage!.spanLineIndexes), 'The line that ended it')}</div>
          <div class="over-side">${missedAll(run)}${statLine(run)}</div>
        </div>
        ${extras}
        ${restart}
      </main>`;
  }
  const ships = unwatched.filter((c) => c.sabotage);
  return `
    <main class="solo over is-quota">
      <div class="over-strip memo">${ICON.warn}<span>Internal memo · from leadership</span></div>
      <h1 class="over-title">The model ships unmonitored.</h1>
      <p class="over-epitaph">Two missed quotas. Leadership reassigned the safety team and deployed the model without oversight. Here's tomorrow's queue, with no one watching:</p>
      <div class="over-grid">
        <ul class="unwatched">${unwatched.map((c) => `<li class="${c.sabotage ? 'bad' : ''}"><span class="log-dot ${c.sabotage ? 'incident' : 'approve'}"></span><div><strong>${esc(c.title)}</strong><span>${c.sabotage ? esc(c.sabotage.headline) : 'Shipped fine.'}</span></div></li>`).join('')}</ul>
        <div class="over-side">
          <p class="over-lesson">${ships.length} sabotage attempt${ships.length === 1 ? '' : 's'} shipped the next day. Oversight that can't keep pace gets routed around, and the harm happens anyway.</p>
          ${statLine(run)}
        </div>
      </div>
      ${extras}
      ${restart}
    </main>`;
}

export function win(run: RunState, extras = ''): string {
  const s = runStats(run);
  return `
    <main class="solo over is-win">
      <div class="briefing-glyph" data-glyph="9" data-size="130"></div>
      <div class="over-strip win">Deployment complete</div>
      <h1 class="over-title">You got the model through the week.</h1>
      <dl class="briefing-stats">
        <div><dt>Harm</dt><dd>${run.harm}<small>/${harmCeiling(run)}</small></dd></div>
        <div><dt>Funding raised</dt><dd>${run.fundingEarned}</dd></div>
        <div><dt>Caught</dt><dd>${s.caught}</dd></div>
        <div><dt>Missed</dt><dd>${s.missed}</dd></div>
        <div><dt>Tells found</dt><dd>${run.codex.size}<small>/${tellCount}</small></dd></div>
      </dl>
      <div class="over-grid">${missedAll(run) ? `<div class="over-side">${missedAll(run)}</div>` : '<p class="over-lesson">Nothing got past you.</p>'}<div class="over-side">${statLine(run)}</div></div>
      ${extras}
      <p class="over-epitaph next-model">The next model arrives tomorrow. It's better than this one.</p>
      <div class="over-actions"><button class="btn-primary btn-lg" data-restart="same"><kbd>Enter</kbd> Replay this seed</button><button class="btn-ghost" data-restart="new"><kbd>N</kbd> New seed</button><span class="seed-note">Seed ${esc(run.seed)}</span></div>
    </main>`;
}

export function interim(run: RunState): string {
  const s = runStats(run);
  return `
    <main class="solo over is-interim">
      <div class="briefing-glyph" data-glyph="3" data-size="120"></div>
      <h1 class="over-title">You made it through Day ${RULES.lastPlayableDay}.</h1>
      <p class="over-epitaph">This build ends here. Days 5–7 bring agents that pass work to each other, models that hold back on purpose, and one that knows your audit rate.</p>
      <dl class="briefing-stats">
        <div><dt>Harm</dt><dd>${run.harm}<small>/${harmCeiling(run)}</small></dd></div>
        <div><dt>Funding raised</dt><dd>${run.fundingEarned}</dd></div>
        <div><dt>Caught</dt><dd>${s.caught}</dd></div>
        <div><dt>Missed</dt><dd>${s.missed}</dd></div>
        <div><dt>Tells found</dt><dd>${run.codex.size}<small>/${tellCount}</small></dd></div>
      </dl>
      ${missedAll(run)}
      <div class="over-actions"><button class="btn-primary btn-lg" data-restart="same"><kbd>Enter</kbd> Replay this seed</button><button class="btn-ghost" data-restart="new"><kbd>N</kbd> New seed</button><span class="seed-note">Seed ${esc(run.seed)}</span></div>
    </main>`;
}

// ---------- Between days: budget meeting ----------
const SHOP: { item: ShopItem; name: string; desc: string }[] = [
  { item: 'auditor', name: 'Contract auditor', desc: `+${RULES.shop.auditor.amount} auditor hour tomorrow` },
  { item: 'compute', name: 'Extra compute', desc: `+${RULES.shop.compute.amount} compute tomorrow` },
  { item: 'tuneUp', name: 'Monitor tune-up', desc: `Band −${RULES.shop.tuneUp.amount} tomorrow` },
  { item: 'reroll', name: 'New proposals', desc: 'Reroll the upgrade offer' },
];

function upgradeCard(u: Upgrade, i: number): string {
  return `
    <button class="upgrade cat-${u.category}${isResearchUpgrade(u.id) ? ' is-research' : ''}" data-upgrade="${u.id}">
      <span class="upgrade-cat">${isResearchUpgrade(u.id) ? 'From your research · ' : ''}${u.category === 'action' ? 'Action' : u.category[0]!.toUpperCase() + u.category.slice(1)}</span>
      <span class="upgrade-name">${esc(u.name)}</span>
      <span class="upgrade-desc">${esc(u.description)}</span>
      <span class="upgrade-best">${esc(u.bestWhen)}</span>
      <kbd class="upgrade-key">${i + 1}</kbd>
    </button>`;
}

export function between(run: RunState, offer: Upgrade[], picked: boolean, contracts = '', contractChosen = true): string {
  const d = run.day;
  const next = dayInfo(d.day + 1);
  const slots = Array.from({ length: RULES.upgrades.maxSlots }, (_, i) => {
    const u = run.upgrades[i] ? upgradeById(run.upgrades[i]!) : undefined;
    return u ? `<span class="slot filled cat-${u.category}">${esc(u.name)}</span>` : '<span class="slot"></span>';
  }).join('');
  const pick = picked
    ? `<p class="pick-done">${run.tomorrow.skipAudit ? `Skipped: +${run.tomorrow.skipAudit} auditor hour tomorrow.` : 'Upgrade installed.'} Spend your funding below, or start the shift.</p>`
    : offer.length
      ? `<div class="upgrades">${offer.map(upgradeCard).join('')}</div>`
      : '<p class="pick-done">Loadout full.</p>';
  const shop = SHOP.map(({ item, name, desc }) => {
    const spec = RULES.shop[item];
    const n = shopCount(run, item);
    const disabled = !canBuy(run, item) || (item === 'reroll' && (picked || !offer.length));
    return `<button class="shop-item" data-buy="${item}" ${disabled ? 'disabled' : ''}>
      <span class="shop-name">${name}</span><span class="shop-desc">${desc}</span>
      <span class="shop-foot"><span class="shop-cost">${spec.cost}</span><span class="shop-count">${n}/${spec.max}</span></span>
    </button>`;
  }).join('');
  return `
    <header class="between-head">
      <div><div class="eyebrow">Between shifts · after Day ${d.day}</div><h2 class="between-title">Budget meeting</h2></div>
      <div class="funding-big"><span class="eyebrow">Funding</span><strong>${run.funding}</strong><span class="funding-note">earned by shipping past quota and catching sabotage</span></div>
    </header>
    <main class="between-main">
      <section class="pick">
        <div class="pick-head">
          <h3>${picked ? 'Upgrade chosen' : 'Choose one upgrade'}</h3>
          ${picked ? '' : `<span class="pick-hint">Press <kbd>1</kbd>–<kbd>${offer.length}</kbd>, or <kbd>S</kbd> to skip (+${RULES.upgrades.skipAuditBonus} auditor hour tomorrow)</span>`}
        </div>
        ${pick}
        <div class="loadout"><span class="eyebrow">Loadout ${run.upgrades.length}/${RULES.upgrades.maxSlots}</span>${slots}</div>
        <div class="shop-head"><h3>Spend funding</h3><span class="pick-hint">Purchases last one day</span></div>
        <div class="shop">${shop}</div>
      </section>
      <aside class="next-day${next.boss ? '' : ' is-calm'}">
        <div class="next-day-top"><span class="eyebrow">Next</span>${next.boss ? '<span class="boss-tag">Boss day</span>' : ''}</div>
        <div class="next-day-glyph"><span data-glyph="${next.day}" data-size="100"></span></div>
        <h3 class="next-day-title">Day ${next.day} · ${esc(next.phase)}</h3>
        <p class="next-day-rule">${esc(next.rule.join(' '))}</p>
        ${contracts}
        <button class="btn-primary btn-lg" data-continue ${(picked || !offer.length) && contractChosen ? '' : 'disabled'}><kbd>Space</kbd> Start Day ${next.day}</button>
      </aside>
    </main>`;
}

export function toast(text: string, tone: 'good' | 'neutral' | 'defer'): string {
  return `<div class="toast toast-${tone}" role="status">${esc(text)}</div>`;
}
