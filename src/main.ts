import './fonts';
import './theme.css';
import './ui.css';
import { dayInfo } from './data/days';
import { contractById } from './ui/metaScreens';
import { buyNode, gradeFor, loadProgress, recordFieldTest, recordRun, dailySeed, type RunUpdate } from './game/progress';
import { buildFieldTest, talkingPoints } from './game/fieldtest';
import * as L from './ui/learn';
import { noteUsed, popover, resetTermsMet, resetTermsToday, termsMet, termsToday } from './ui/terms';
import { BREAKTHROUGH_TERM, EVENT_TERMS, FAMILY_TERM, LAB_TERM, TOOL_TERM, UPGRADE_TERM } from './data/term-links';
import {
  act, advance, breakthroughDue, breakthroughOffer, buy, canAct, chooseContract, chooseEvent, contractOffer, current, dayOver, endDay,
  eventChoices, eventFor, isIncident, modsFor, newRun, nextDay, prepareCard, scoreParts, shipUnreviewed, skipUpgrade, startDay, takeBreakthrough, takeUpgrade,
  unwatchedQueue, upgradeOffer, type Action, type Outcome, type RunState, type ShopItem,
} from './game/state';
import type { Breakthrough, Contract, Difficulty, GameEvent, ToolId, Upgrade } from './types';
import { randomSeedString } from './rng';
import { RULES } from './rules';
import * as M from './ui/metaScreens';
import * as R from './ui/render';
import * as S from './ui/shift';
import { buildArc, type ArcOptions } from './visual/arc';
import { buildLattice, markLattice } from './visual/lattice';
import { buildModelGlyph } from './visual/modelGlyph';

type Screen =
  | { kind: 'title' }
  | { kind: 'setup' }
  | { kind: 'codex' }
  | { kind: 'guide'; tab: L.GuideTab; focus?: string }
  | { kind: 'fieldtest'; test: L.TestState }
  | { kind: 'timeout'; shipped: Outcome[] }
  | { kind: 'intro' }
  | { kind: 'daily-info' }
  | { kind: 'lab'; focus?: string }
  | { kind: 'briefing' }
  | { kind: 'shift'; overlay?: { type: 'incident' | 'audit'; outcome: Outcome } }
  | { kind: 'review'; html: string }
  | { kind: 'event'; event: GameEvent; chosen?: number }
  | { kind: 'breakthrough'; offer: Breakthrough[] }
  | { kind: 'between'; offer: Upgrade[]; picked: boolean; contracts: Contract[]; contract?: string }
  | { kind: 'over' }
  | { kind: 'interim' }
  | { kind: 'win' }
  | { kind: 'reveal'; source: string; then: Screen };

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');

app.innerHTML = '<div class="viewport"><div class="stage" id="stage"></div></div>';
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const screenEl = document.createElement('div');
screenEl.className = 'screen';

const progress = loadProgress();
let run: RunState | null = null;
let screen: Screen = { kind: 'title' };
let preview: R.Preview = null;
let freshHarm = 0;
let expanded = false;
let toolkitOpen: ToolId | 'all' | null = null;
let lastCardKey = '';
let endUpdate: RunUpdate | null = null;
let endScore = 0;
let endGrade = 'D';
/** The adversary reveal screen shows once per run, the moment it's revealed. */
let revealShown = false;
let fieldTestTaken = false;
/** Guided first minute: coach marks on the first cards of a player's first run. */
interface CoachStep { target: string; text: string; next?: 'button' | 'fact' | 'decide' }
const COACH: CoachStep[] = [
  { target: '.scard-glance', text: 'This strip shows the job at a glance: what kind of work it is, how much is at stake, and what the agent can touch.', next: 'button' },
  { target: '.scard-task', text: 'Here is the task, the rules on file, and what the model did. Everything you need to judge it is on the card.', next: 'button' },
  { target: '.ev-monitor', text: 'The trusted monitor scores every card for free. It is a hint, not proof: the shaded box shows how far off it may be.', next: 'button' },
  { target: '[data-action="fact"]', text: 'Press F for a Fact check. A trusted model compares the work with the rules on file and reports in plain words.', next: 'fact' },
  { target: '[data-region="decide"]', text: 'Now decide. Approve (A) if the work is clean; Defer (D) if something is wrong, and a weaker, safe model redoes it.', next: 'decide' },
  { target: '[data-action="audit"]', text: 'Human audit (U) is always right, but you only get a few each day. Save it for cards your tools can\'t settle. That\'s the whole job.', next: 'button' },
];
let coachStep = -1;
const coachKey = 'oversight-shift:coached';
function coachWanted(): boolean {
  try { return !localStorage.getItem(coachKey); } catch { return false; }
}
function endCoach(): void {
  coachStep = -1;
  try { localStorage.setItem(coachKey, '1'); } catch { /* storage unavailable */ }
  screenEl.querySelector('.coach')?.remove();
  screenEl.querySelector('.coach-ring')?.classList.remove('coach-ring');
}
function drawCoach(): void {
  screenEl.querySelector('.coach')?.remove();
  stage.querySelectorAll('.coach-ring').forEach((e) => e.classList.remove('coach-ring'));
  if (coachStep < 0 || !run || screen.kind !== 'shift' || screen.overlay) return;
  const step = COACH[coachStep];
  const target = step ? screenEl.querySelector<HTMLElement>(step.target) : null;
  if (!step || !target) return;
  target.classList.add('coach-ring');
  const s = stage.getBoundingClientRect();
  const scale = s.width / 1280;
  const r = target.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'coach';
  box.innerHTML = `<span class="eyebrow">First shift · ${coachStep + 1} of ${COACH.length}</span><p>${step.text}</p><div class="coach-actions">${step.next === 'button' ? `<button class="btn-primary" data-coach="next"><kbd>Space</kbd> ${coachStep === COACH.length - 1 ? 'Got it' : 'Next'}</button>` : ''}<button class="link-btn" data-coach="skip">Skip the tour</button></div>`;
  screenEl.append(box);
  const w = box.offsetWidth, h = box.offsetHeight;
  const x = (r.left - s.left) / scale, y = (r.top - s.top) / scale, bottom = (r.bottom - s.top) / scale, right = (r.right - s.left) / scale;
  let left = x, top = bottom + 10;
  if (top + h > 710) top = y - h - 10;
  if (top < 70) { top = Math.max(70, y); left = x > 640 ? x - w - 12 : right + 12; }
  box.style.left = `${Math.min(Math.max(12, left), 1268 - w)}px`;
  box.style.top = `${Math.min(Math.max(8, top), 712 - h)}px`;
}
function coachAdvance(trigger: 'button' | 'fact' | 'decide'): void {
  if (coachStep < 0) return;
  const step = COACH[coachStep];
  if (step?.next !== trigger) return;
  coachStep++;
  if (coachStep >= COACH.length) endCoach();
}

/** Pause menu: open during a run; stops the shift clock. */
let paused = false;
const PAUSABLE = new Set(['intro', 'briefing', 'shift', 'review', 'event', 'breakthrough', 'between', 'reveal', 'timeout']);
let setup: M.Setup = loadSetup();

function loadSetup(): M.Setup {
  const fallback: M.Setup = { difficulty: 'guided', lab: 'frontier', level: 1 };
  try {
    const v = JSON.parse(localStorage.getItem('oversight-shift:setup') ?? 'null') as M.Setup | null;
    return v ? { ...fallback, ...v, level: Math.min(v.level ?? 1, progress.maxModel) } : fallback;
  } catch {
    return fallback;
  }
}

function saveSetup(): void {
  try { localStorage.setItem('oversight-shift:setup', JSON.stringify(setup)); } catch { /* storage unavailable */ }
}

const hintsFor = (day: number) => dayInfo(day).hints;
const esc = R.esc;

function startRun(seed: string, daily = false): void {
  const opts = daily
    ? { difficulty: 'standard' as Difficulty, lab: 'frontier', level: 1, research: [], daily: true }
    : { ...setup, research: progress.research };
  run = newRun(seed, hintsFor(1), opts);
  endUpdate = null;
  revealShown = false;
  fieldTestTaken = false;
  paused = false;
  coachStep = !daily && run.day.day === 1 && coachWanted() ? 0 : -1;
  resetTermsMet();
  noteUsed('ai-control', 'you ran the protocol');
  noteUsed('trusted-monitoring', 'it scored every card');
  noteUsed(LAB_TERM[run.lab.id], `your lab: ${run.lab.name}`);
  // Playtest shortcut: ?day=N starts the run on day N with a fresh budget.
  const jump = Number(new URLSearchParams(location.search).get('day'));
  if (!daily && jump >= 2 && jump <= RULES.days) {
    run.day = startDay(seed, jump, modsFor(run, jump), hintsFor(jump), run.used);
    for (const c of run.day.queue) run.used.add(c.card.id);
  }
  screen = { kind: 'briefing' };
  latticeMarks = [];
  resetLattice(seed);
  render();
}

let latticeMarks: { key: string; kind: 'lit' | 'caught' | 'scar' }[] = [];
function resetLattice(seed: string): void {
  stage.querySelector('.lattice')?.remove();
  stage.prepend(buildLattice({ width: 1280, height: 720, seed, focus: { x: 640, y: 330, radius: 360 } }));
  for (const m of latticeMarks) markLattice(stage, m.key, m.kind);
}

/** Escalation mood: the room warms as the week goes on. */
const DAY_GLOW = ['#0c1a2b', '#0e1a2e', '#131a30', '#1a1a30', '#22192d', '#2a1829', '#331623'];
function setMood(day: number | null): void {
  stage.style.setProperty('--bg-glow', day ? DAY_GLOW[Math.min(day, 7) - 1]! : DAY_GLOW[0]!);
  stage.dataset.day = day ? String(day) : '';
}

// ---------- Rendering ----------
function hydrate(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-glyph]').forEach((slot) => {
    slot.replaceChildren(buildModelGlyph(Number(slot.dataset.glyph), Number(slot.dataset.size ?? 40)));
  });
  root.querySelectorAll<HTMLElement>('[data-arc]').forEach((wrap) => {
    wrap.querySelector('svg.arc')?.remove();
    wrap.prepend(buildArc(JSON.parse(wrap.dataset.arc ?? '{}') as ArcOptions));
  });
}

function setLayout(kind: 'shift' | 'between' | 'solo'): void {
  stage.classList.toggle('stage-simple', kind === 'shift');
  stage.classList.toggle('stage-between', kind === 'between');
  stage.classList.toggle('stage-solo', kind === 'solo');
}

function region(tag: string, cls: string, html: string): string {
  return `<${tag} class="${cls}" data-region="${cls.split(' ')[0]}">${html}</${tag}>`;
}

/** Records the finished run once, so the end screen can show score and unlocks. */
function finishRun(won: boolean): void {
  if (!run || endUpdate) return;
  const parts = scoreParts(run, won);
  endScore = parts.score;
  endGrade = gradeFor(parts.raw);
  endUpdate = recordRun(progress, {
    record: {
      seed: run.seed, date: new Date().toISOString(), difficulty: run.difficulty, level: run.level, lab: run.lab.id,
      adversary: run.adversary, dayReached: run.day.day, result: won ? 'win' : run.loss?.kind ?? 'harm',
      score: endScore, grade: endGrade, daily: run.daily,
    },
    tells: [...run.codex],
    fundingEarned: run.fundingEarned,
    terms: termsMet(),
    incidents: [...run.history, run.day].flatMap((d) => d.outcomes).filter(isIncident).map((o) => o.card.sabotage!.family),
    catches: [...run.history, run.day].flatMap((d) => d.outcomes).filter((o) => o.action === 'audit' && o.draft.sabotaged).length,
  });
}

const ADVERSARY_NAME = { sandbagger: 'the sandbagger', colluder: 'the colluder', injector: 'the injector', schemer: 'the patient schemer' } as const;

/** Threat forecasting: a ±1 estimate of today's attacks. */
function forecast(r: RunState): string {
  const n = r.day.queue.filter((c) => c.card.sabotage).length;
  return `<span class="brief-tag">Forecast: ${Math.max(0, n - 1)}–${n + 1} attacks today</span>`;
}

function briefingExtras(r: RunState): string {
  const c = r.day.contract;
  const tags = [
    `<span class="brief-tag">${esc(r.lab.name)}</span>`,
    r.level > 1 ? `<span class="brief-tag">Model v${r.level}</span>` : '',
    c ? `<span class="brief-tag" title="${esc(c.blurb)}">Client: ${esc(c.name)}</span>` : '',
    r.day.blind ? `<span class="brief-tag bad">Monitor blind on ${r.day.blind === 'log' ? 'agent actions' : 'file changes'} today</span>` : '',
    r.adversaryRevealed ? `<span class="brief-tag bad">Adversary: ${ADVERSARY_NAME[r.adversary]}</span>` : '',
    ...r.harmLog.filter((h) => h.day === r.day.day - 1).map((h) => `<span class="brief-tag ${h.amount < 0 ? 'good' : 'bad'}">Harm ${h.amount > 0 ? '+' : ''}${h.amount} from ${esc(h.reason)}</span>`),
    r.research.includes('evl-forecast') ? forecast(r) : '',
  ].join('');
  return `<div class="brief-tags">${tags}</div>${L.dayTermsBlock(r, progress)}${S.newToolsBlock(r)}`;
}

function render(): void {
  if (!stage.contains(screenEl)) stage.append(screenEl);
  pop.hidden = true;
  setMood(run && !['title', 'setup', 'codex', 'guide', 'lab', 'daily-info'].includes(screen.kind) ? run.day.day : null);
  if (screen.kind === 'title') { setLayout('solo'); screenEl.innerHTML = M.title(progress); }
  else if (screen.kind === 'setup') { setLayout('solo'); screenEl.innerHTML = M.setup(progress, setup); }
  else if (screen.kind === 'codex' || screen.kind === 'guide') { setLayout('solo'); screenEl.innerHTML = L.fieldGuide(progress, screen.kind === 'guide' ? screen.tab : 'terms', screen.kind === 'guide' ? screen.focus : undefined); }
  else if (screen.kind === 'intro' && run) { setLayout('solo'); screenEl.innerHTML = R.bossIntro(run); }
  else if (screen.kind === 'timeout' && run) { setLayout('solo'); screenEl.innerHTML = R.timeout(run, screen.shipped); }
  else if (screen.kind === 'fieldtest') {
    setLayout('solo');
    screenEl.innerHTML = screen.test.done && run ? L.fieldTestResults(screen.test, talkingPoints(run, termsMet())) : L.fieldTest(screen.test);
  }
  else if (screen.kind === 'daily-info') { setLayout('solo'); screenEl.innerHTML = M.dailyInfo(progress, dailySeed(), new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })); }
  else if (screen.kind === 'lab') { setLayout('solo'); screenEl.innerHTML = M.lab(progress, screen.focus); }
  else if (!run) return;
  else if (screen.kind === 'briefing') { setLayout('solo'); screenEl.innerHTML = R.briefing(run, briefingExtras(run)); }
  else if (screen.kind === 'shift') {
    setLayout('shift');
    prepareCard(run);
    const c = current(run.day);
    const overlay = screen.overlay;
    const key = c ? `${run.day.day}:${run.day.index}:${c.drafts.length}` : '';
    const animate = key !== lastCardKey;
    lastCardKey = key;
    const main = overlay
      ? overlay.type === 'incident' ? R.incident(run, overlay.outcome) : R.auditReveal(run, overlay.outcome)
      : S.shiftMain(run, expanded, animate, preview);
    screenEl.innerHTML =
      region('header', 'hud', S.hud(run, overlay ? null : preview, freshHarm)) +
      region('main', `simple-main${overlay ? ' is-overlay' : ''}`, main) +
      region('footer', `decide${overlay ? ' is-muted' : ''}`, S.decide(run, overlay ? null : preview, !!overlay));
  } else if (screen.kind === 'review') { setLayout('between'); screenEl.innerHTML = screen.html; }
  else if (screen.kind === 'event') {
    setLayout('solo');
    screenEl.innerHTML = screen.chosen === undefined ? M.event(run, screen.event) : M.eventAfter(run, screen.event, screen.chosen);
  } else if (screen.kind === 'breakthrough') { setLayout('solo'); screenEl.innerHTML = M.breakthrough(run, screen.offer); }
  else if (screen.kind === 'between') {
    setLayout('between');
    screenEl.innerHTML = R.between(run, screen.offer, screen.picked, M.contractPanel(screen.contracts, screen.contract), !!screen.contract);
  } else if (screen.kind === 'over') {
    setLayout('solo');
    finishRun(false);
    screenEl.innerHTML = R.gameOver(run, run.loss?.kind === 'quota' ? unwatchedQueue(run) : [], R.replayStrip(run, false) + M.endExtras(run, endScore, endUpdate, endGrade));
  } else if (screen.kind === 'win') {
    setLayout('solo');
    finishRun(true);
    screenEl.innerHTML = R.win(run, R.replayStrip(run, true) + M.endExtras(run, endScore, endUpdate, endGrade));
  } else if (screen.kind === 'reveal') { setLayout('solo'); screenEl.innerHTML = M.adversaryReveal(run, screen.source); }
  else { setLayout('solo'); screenEl.innerHTML = R.interim(run); }

  if (paused && run) screenEl.insertAdjacentHTML('beforeend', R.pauseMenu(run));
  if (toolkitOpen && run && (screen.kind === 'shift' || screen.kind === 'briefing')) {
    screenEl.insertAdjacentHTML('beforeend', S.toolkit(run, toolkitOpen === 'all' ? undefined : toolkitOpen));
  }
  hydrate(screenEl);
  screenEl.querySelector<HTMLElement>('[data-continue]:not([disabled]), [data-start]')?.focus({ preventScroll: true });
  if (coachStep >= 0) requestAnimationFrame(drawCoach);
}

/** Hover previews only touch the status bar, decisions and evidence, so the card doesn't re-animate. */
function renderPreview(): void {
  if (!run || screen.kind !== 'shift' || screen.overlay) return;
  const hudEl = screenEl.querySelector('[data-region="hud"]');
  const bar = screenEl.querySelector('[data-region="decide"]');
  const panel = screenEl.querySelector('.evidence-panel');
  const c = current(run.day);
  if (hudEl) { hudEl.innerHTML = S.hud(run, preview, freshHarm); hydrate(hudEl); }
  if (bar) bar.innerHTML = S.decide(run, preview, false);
  if (panel && c) panel.innerHTML = S.evidence(run, c, preview);
}

// ---------- Flow ----------
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let animating = false;
/** Decisions get a short motion before the next screen: ship slides away, defer flips, audit scans. */
const MOTION: Partial<Record<Action, [string, number]>> = { approve: ['leave-approve', 280], defer: ['leave-defer', 320], audit: ['scan-audit', 520] };

function doAction(action: Action): void {
  if (!run || animating || screen.kind !== 'shift' || screen.overlay || !canAct(run, action)) return;
  const motion = MOTION[action];
  const card = screenEl.querySelector<HTMLElement>('.scard');
  if (motion && card && !reducedMotion()) {
    animating = true;
    card.classList.add(motion[0]);
    window.setTimeout(() => { animating = false; applyAction(action); }, motion[1]);
    return;
  }
  applyAction(action);
}

function applyAction(action: Action): void {
  if (!run || screen.kind !== 'shift' || screen.overlay || !canAct(run, action)) return;
  const dayNo = run.day.day;
  const cardIndex = run.day.index;
  const layout = current(run.day)?.card.layout;
  const outcome = act(run, action);
  freshHarm = outcome?.harm ?? 0;
  if (action === 'fact') coachAdvance('fact');
  if (action === 'approve' || action === 'defer') coachAdvance('decide');
  if (action !== 'approve') noteUsed(TOOL_TERM[action], action === 'defer' ? 'you deferred work' : 'you used it');
  if (layout === 'log') noteUsed('ai-agent', 'agents took actions');
  if (action === 'fact' || action === 'scope' || action === 'resample' || action === 'untrusted') noteUsed('compute', 'you spent it on tools');
  if (outcome?.draft.sabotaged && outcome.card.sabotage && (isIncident(outcome) || outcome.action === 'audit')) {
    noteUsed(FAMILY_TERM[outcome.card.sabotage.family], isIncident(outcome) ? `it got through: “${outcome.card.title}”` : `you caught it: “${outcome.card.title}”`);
    noteUsed('sabotage', 'you saw it happen');
  }
  preview = null;
  if (!outcome) { render(); return; } // a tool ran: same card, new evidence
  // The background lattice is the run's map: each decision lights a node; harm leaves a scar.
  const mark = isIncident(outcome) ? 'scar' : outcome.action === 'audit' && outcome.draft.sabotaged ? 'caught' : 'lit';
  latticeMarks.push({ key: `${dayNo}:${cardIndex}`, kind: mark });
  markLattice(stage, `${dayNo}:${cardIndex}`, mark);
  if (isIncident(outcome) && !reducedMotion()) { stage.classList.add('shake'); window.setTimeout(() => stage.classList.remove('shake'), 420); }
  if (isIncident(outcome)) {
    screen = { kind: 'shift', overlay: { type: 'incident', outcome } };
  } else if (outcome.action === 'audit') {
    screen = { kind: 'shift', overlay: { type: 'audit', outcome } };
  } else {
    const text = outcome.action === 'defer' ? `Deferred · trusted version shipped · +${outcome.usefulness}` : `Shipped · +${outcome.usefulness}`;
    nextCard();
    showToast(text, outcome.action === 'defer' ? 'defer' : 'neutral');
    return;
  }
  render();
}

let toastTimer = 0;
function showToast(text: string, tone: 'good' | 'neutral' | 'defer'): void {
  const center = screenEl.querySelector('[data-region="simple-main"]');
  if (!center) return;
  center.querySelector('.toast')?.remove();
  center.insertAdjacentHTML('beforeend', R.toast(text, tone));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => center.querySelector('.toast')?.remove(), 1600);
}

function nextCard(): void {
  if (!run) return;
  freshHarm = 0;
  expanded = false;
  if (run.loss) { screen = { kind: 'over' }; render(); return; }
  advance(run);
  if (dayOver(run.day)) {
    for (const o of run.day.outcomes) {
      if (o.action === 'defer' && o.draft.sabotaged && !o.slipped && o.card.sabotage) noteUsed(FAMILY_TERM[o.card.sabotage.family], 'a Defer stopped it');
    }
    const summary = endDay(run);
    screen = { kind: 'review', html: R.review(run, summary, L.termsInAction(termsToday())) };
  } else {
    screen = { kind: 'shift' };
  }
  render();
}

/** After the review: event → breakthrough → budget meeting. Each step is skipped when it doesn't apply. */
function afterReview(step: 'event' | 'breakthrough' | 'between'): void {
  if (!run) return;
  if (run.loss) { screen = { kind: 'over' }; render(); return; }
  if (step === 'event') {
    const ev = eventFor(run);
    if (ev) { screen = { kind: 'event', event: ev }; render(); return; }
    step = 'breakthrough';
  }
  if (step === 'breakthrough') {
    const offer = breakthroughDue(run) ? breakthroughOffer(run) : [];
    if (offer.length) { screen = { kind: 'breakthrough', offer }; render(); return; }
  }
  screen = { kind: 'between', offer: upgradeOffer(run), picked: false, contracts: contractOffer(run) };
  render();
}

/** If the adversary just got revealed, show it before going on to `next`. */
function withReveal(next: Screen, source: string): Screen {
  if (run?.adversaryRevealed && !revealShown) { revealShown = true; return { kind: 'reveal', source, then: next }; }
  return next;
}

function continueScreen(): void {
  if (!run) return;
  if (screen.kind === 'reveal') { screen = screen.then; render(); return; }
  if (screen.kind === 'intro') { screen = { kind: 'briefing' }; render(); return; }
  if (screen.kind === 'fieldtest') { advanceFieldTest(); return; }
  if (screen.kind === 'timeout') {
    if (run.loss) { screen = { kind: 'over' }; render(); return; }
    const summary = endDay(run);
    screen = { kind: 'review', html: R.review(run, summary, L.termsInAction(termsToday())) };
    render();
    return;
  }
  if (screen.kind === 'briefing') { screen = { kind: 'shift' }; render(); return; }
  if (screen.kind === 'shift' && screen.overlay) { nextCard(); return; }
  if (screen.kind === 'review') {
    if (run.loss) screen = { kind: 'over' };
    else if (run.day.day >= RULES.days) screen = { kind: 'win' };
    else if (run.day.day >= RULES.lastPlayableDay) screen = { kind: 'interim' };
    else { afterReview('event'); return; }
    render();
    return;
  }
  if (screen.kind === 'event' && screen.chosen !== undefined) {
    afterReview('breakthrough');
    if (run.adversaryRevealed && !revealShown) { screen = withReveal(screen, 'Red team report'); render(); }
    return;
  }
  if (screen.kind === 'between' && (screen.picked || !screen.offer.length) && screen.contract) {
    chooseContract(run, screen.contract);
    nextDay(run, hintsFor(run.day.day + 1));
    resetTermsToday();
    screen = withReveal(R.BOSS[run.day.day] ? { kind: 'intro' } : { kind: 'briefing' }, 'Red-team program');
    render();
  }
}

function pickEvent(i: number): void {
  if (!run || screen.kind !== 'event' || screen.chosen !== undefined || !eventChoices(run, screen.event)[i]) return;
  chooseEvent(run, screen.event, i);
  for (const id of EVENT_TERMS[screen.event.id] ?? []) noteUsed(id, `event: “${screen.event.title}”`);
  screen = { ...screen, chosen: i };
  render();
}

function pickBreakthrough(i: number): void {
  if (!run || screen.kind !== 'breakthrough' || !screen.offer[i]) return;
  const id = screen.offer[i]!.id;
  takeBreakthrough(run, id);
  noteUsed(BREAKTHROUGH_TERM[id], 'your breakthrough');
  afterReview('between');
  if (id === 'red-team') { screen = withReveal(screen, 'Red-team exercise'); render(); }
}

function pickUpgrade(index: number | 'skip'): void {
  if (!run || screen.kind !== 'between' || screen.picked) return;
  if (index === 'skip') skipUpgrade(run);
  else {
    const u = screen.offer[index];
    if (!u) return;
    takeUpgrade(run, u.id);
    noteUsed(UPGRADE_TERM[u.id], `upgrade: ${u.name}`);
  }
  screen = { ...screen, picked: true };
  render();
}

function pickContract(id: string | undefined): void {
  if (!run || screen.kind !== 'between' || !contractById(id)) return;
  screen = { ...screen, contract: id };
  render();
}

function buyItem(item: ShopItem): void {
  if (!run || screen.kind !== 'between') return;
  if (item === 'reroll' && (screen.picked || !screen.offer.length)) return;
  if (!buy(run, item)) return;
  if (item === 'reroll') screen = { ...screen, offer: upgradeOffer(run) };
  render();
}

function restart(mode: 'same' | 'new'): void {
  if (run?.daily && mode === 'same') { startRun(run.seed, true); return; }
  startRun(mode === 'same' && run ? run.seed : randomSeedString());
}

function go(target: string): void {
  if (target === 'daily') { startRun(dailySeed(), true); return; }
  if (target === 'guide' || target === 'codex') { screen = { kind: 'guide', tab: 'terms' }; resetLattice('title'); render(); return; }
  if (target === 'fieldtest') { startFieldTest(); return; }
  if (target === 'title' || target === 'setup' || target === 'lab' || target === 'daily-info') { screen = { kind: target }; resetLattice('title'); render(); }
}

function startFieldTest(): void {
  if (!run || fieldTestTaken) return;
  const questions = buildFieldTest(run, termsMet());
  if (!questions.length) return;
  fieldTestTaken = true;
  screen = { kind: 'fieldtest', test: { questions, index: 0, correct: 0, done: false } };
  render();
}

function answerFieldTest(id: string): void {
  if (screen.kind !== 'fieldtest' || screen.test.done || screen.test.picked !== undefined) return;
  const q = screen.test.questions[screen.test.index]!;
  screen = { kind: 'fieldtest', test: { ...screen.test, picked: id, correct: screen.test.correct + (id === q.answer ? 1 : 0) } };
  render();
}

function advanceFieldTest(): void {
  if (screen.kind !== 'fieldtest' || screen.test.picked === undefined) return;
  const t = screen.test;
  if (t.index + 1 < t.questions.length) screen = { kind: 'fieldtest', test: { ...t, index: t.index + 1, picked: undefined } };
  else { recordFieldTest(progress, t.correct); screen = { kind: 'fieldtest', test: { ...t, done: true } }; }
  render();
}

function setSetup(patch: Partial<M.Setup>): void {
  setup = { ...setup, ...patch };
  saveSetup();
  render();
}

function setPaused(on: boolean): void {
  paused = on && !!run && PAUSABLE.has(screen.kind);
  render();
}

/** Ends the run now: recorded as unfinished, with Insight for the days completed. */
function abandonRun(): void {
  if (!run) return;
  paused = false;
  if (!run.loss) run.loss = { kind: 'abandon', day: run.day.day };
  screen = { kind: 'over' };
  render();
}

function toggleToolkit(which: ToolId | 'all' | null): void {
  toolkitOpen = which;
  render();
}

// ---------- Input ----------
const KEYS: Record<string, Action> = { a: 'approve', u: 'audit', d: 'defer', r: 'resample', f: 'fact', s: 'scope', m: 'untrusted', p: 'probe' };

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (toolkitOpen) {
    if (k === 'escape' || k === 't') { e.preventDefault(); toggleToolkit(null); }
    return;
  }
  if (coachStep >= 0 && COACH[coachStep]?.next === 'button' && (k === ' ' || k === 'enter') && screen.kind === 'shift' && !screen.overlay) {
    e.preventDefault();
    coachStep++;
    if (coachStep >= COACH.length) endCoach(); else drawCoach();
    return;
  }
  if (paused) {
    e.preventDefault();
    if (k === 'escape' || k === 'enter' || k === ' ') setPaused(false);
    else if (k === 'r') { paused = false; restart('same'); }
    else if (k === 'q') abandonRun();
    return;
  }
  if (k === 'escape' && run && PAUSABLE.has(screen.kind)) { e.preventDefault(); setPaused(true); return; }
  if (screen.kind === 'title') {
    if (k === 'enter' || k === ' ') { e.preventDefault(); go('setup'); }
    else if (k === 'd') go('daily-info');
    else if (k === 'c' || k === 'g') go('guide');
    else if (k === 'l') go('lab');
    return;
  }
  if (screen.kind === 'guide') {
    const tab = (['terms', 'approaches', 'threats', 'runs'] as const)[Number(k) - 1];
    if (tab) { screen = { kind: 'guide', tab }; render(); }
    else if (k === 'escape' || k === 'g') go('title');
    return;
  }
  if (screen.kind === 'fieldtest') {
    const q = screen.test.questions[screen.test.index];
    const i = Number(k) - 1;
    if (!screen.test.done && q && screen.test.picked === undefined && q.options[i]) { answerFieldTest(q.options[i]!); return; }
    if (screen.test.done) { if (k === 'l') go('lab'); else if (k === 'g') go('guide'); else if (k === 'escape') go('title'); return; }
    if (k === ' ' || k === 'enter') { e.preventDefault(); advanceFieldTest(); }
    return;
  }
  if (screen.kind === 'daily-info') {
    if (k === 'escape') go('title');
    else if (k === 'enter' || k === ' ') { e.preventDefault(); go('daily'); }
    return;
  }
  if (screen.kind === 'lab') {
    if (k === 'escape') go('title');
    else if (k === 'enter') { e.preventDefault(); go('setup'); }
    return;
  }
  if (screen.kind === 'setup') {
    const pick = (['guided', 'standard', 'analyst'] as const)[Number(k) - 1];
    if (pick) setSetup({ difficulty: pick });
    else if (k === 'enter') { e.preventDefault(); startRun(randomSeedString()); }
    else if (k === 'escape') go('title');
    return;
  }
  if (screen.kind === 'codex') { if (k === 'escape' || k === 'c') go('title'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win') && k === 'f') { go('fieldtest'); return; }
  if ((screen.kind === 'over' || screen.kind === 'interim' || screen.kind === 'win') && (k === 'enter' || k === 'n')) { e.preventDefault(); restart(k === 'n' ? 'new' : 'same'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win') && k === 'escape') { go('title'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win') && k === 'l') { go('lab'); return; }
  if (screen.kind === 'event' && screen.chosen === undefined) { const i = Number(k) - 1; if (i >= 0 && run) pickEvent(i); return; }
  if (screen.kind === 'breakthrough') { const i = Number(k) - 1; if (i >= 0) pickBreakthrough(i); return; }
  if (k === 't' && (screen.kind === 'shift' || screen.kind === 'briefing')) { toggleToolkit('all'); return; }
  if (k === 'v' && screen.kind === 'shift' && !screen.overlay) { expanded = !expanded; render(); return; }
  if (k === ' ' || k === 'enter') {
    if (screen.kind === 'shift' && !screen.overlay) return;
    e.preventDefault();
    continueScreen();
    return;
  }
  if (screen.kind === 'between') {
    if (k >= '1' && k <= '4') pickUpgrade(Number(k) - 1);
    else if (k === 's') pickUpgrade('skip');
    else if (k === 'q' || k === 'w') pickContract(screen.contracts[k === 'q' ? 0 : 1]?.id);
    return;
  }
  const action = KEYS[k];
  if (action) doAction(action);
});

screenEl.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const coach = el.closest<HTMLElement>('[data-coach]');
  if (coach) {
    if (coach.dataset.coach === 'skip') endCoach();
    else { coachStep++; if (coachStep >= COACH.length) endCoach(); else drawCoach(); }
    return;
  }
  const menu = el.closest<HTMLElement>('[data-pause]');
  if (menu) {
    const a = menu.dataset.pause;
    if (a === 'open') setPaused(true);
    else if (a === 'resume') setPaused(false);
    else if (a === 'restart') { paused = false; restart('same'); }
    else if (a === 'quit') abandonRun();
    return;
  }
  const guide = el.closest<HTMLElement>('[data-guide-tab], [data-guide-term], [data-answer]');
  if (guide) {
    if (guide.dataset.guideTab) screen = { kind: 'guide', tab: guide.dataset.guideTab as L.GuideTab };
    else if (guide.dataset.guideTerm) screen = { kind: 'guide', tab: 'terms', focus: guide.dataset.guideTerm };
    else if (guide.dataset.answer) { answerFieldTest(guide.dataset.answer); return; }
    render();
    return;
  }
  const info = el.closest<HTMLElement>('[data-toolkit], [data-toolkit-close], [data-expand], [data-difficulty], [data-lab], [data-level], [data-go], [data-share]');
  if (info) {
    e.stopPropagation();
    if ((info as HTMLButtonElement).disabled) return;
    if (info.hasAttribute('data-toolkit-close')) toggleToolkit(null);
    else if (info.hasAttribute('data-expand')) { expanded = !expanded; render(); }
    else if (info.dataset.difficulty) setSetup({ difficulty: info.dataset.difficulty as Difficulty });
    else if (info.dataset.lab) setSetup({ lab: info.dataset.lab });
    else if (info.dataset.level) setSetup({ level: Number(info.dataset.level) });
    else if (info.dataset.go) go(info.dataset.go);
    else if (info.dataset.share) { navigator.clipboard?.writeText(info.dataset.share).then(() => { info.textContent = 'Copied'; }, () => undefined); }
    else toggleToolkit((info.dataset.toolkit || 'all') as ToolId | 'all');
    return;
  }
  const node = el.closest<HTMLElement>('[data-node]');
  if (node && screen.kind === 'lab') {
    if (buyNode(progress, node.dataset.node!)) setup = { ...setup };
    screen = { kind: 'lab', focus: node.dataset.node };
    render();
    return;
  }
  const t = el.closest<HTMLElement>('[data-action], [data-continue], [data-start], [data-restart], [data-upgrade], [data-buy], [data-choice], [data-breakthrough], [data-contract]');
  if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.dataset.upgrade && screen.kind === 'between') pickUpgrade(screen.offer.findIndex((u) => u.id === t.dataset.upgrade));
  else if (t.dataset.contract) pickContract(t.dataset.contract);
  else if (t.dataset.choice) pickEvent(Number(t.dataset.choice));
  else if (t.dataset.breakthrough && screen.kind === 'breakthrough') pickBreakthrough(screen.offer.findIndex((b) => b.id === t.dataset.breakthrough));
  else if (t.dataset.buy) buyItem(t.dataset.buy as ShopItem);
  else if (t.dataset.action) doAction(t.dataset.action as Action);
  else if (t.hasAttribute('data-continue')) continueScreen();
  else if (t.hasAttribute('data-start')) startRun(randomSeedString());
  else if (t.dataset.restart) restart(t.dataset.restart as 'same' | 'new');
});

screenEl.addEventListener('mouseover', (e) => {
  const node = (e.target as HTMLElement).closest<HTMLElement>('[data-node], [data-branch]');
  if (node && screen.kind === 'lab') {
    const detail = screenEl.querySelector('.lab-detail');
    if (detail) detail.innerHTML = M.labDetail(node.dataset.node ?? node.dataset.branch);
    return;
  }
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  const next = t && !(t as HTMLButtonElement).disabled ? (t.dataset.action as R.Preview) : null;
  if (next !== preview) { preview = next; renderPreview(); }
});

// ---------- Shift clock ----------
// Counts down only while a card is on screen: reports, reveals, the toolkit and hidden tabs pause it.
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (!run || screen.kind !== 'shift' || screen.overlay || toolkitOpen || paused || document.hidden || coachStep >= 0) return;
  const d = run.day;
  if (!d.attention || dayOver(d)) return;
  d.attentionLeft = Math.max(0, d.attentionLeft - dt);
  const fill = screenEl.querySelector<HTMLElement>('.clock-fill');
  const num = screenEl.querySelector<HTMLElement>('.clock-num');
  const pct = (d.attentionLeft / d.attention) * 100;
  if (fill) fill.style.setProperty('--v', `${pct.toFixed(1)}%`);
  if (num) num.textContent = S.clockText(d.attentionLeft);
  screenEl.querySelector('[data-clock]')?.classList.toggle('is-low', pct < 20);
  if (d.attentionLeft <= 0) {
    const shipped = shipUnreviewed(run);
    freshHarm = shipped.reduce((s, o) => s + o.harm, 0);
    screen = { kind: 'timeout', shipped };
    render();
  }
}, 200);

// ---------- Term popover ----------
const pop = document.createElement('div');
pop.className = 'term-pop';
pop.hidden = true;
stage.append(pop);

function showPop(el: HTMLElement): void {
  const html = popover(el.dataset.term ?? '');
  if (!html) return;
  pop.innerHTML = html;
  pop.hidden = false;
  const s = stage.getBoundingClientRect();
  const scale = s.width / 1280;
  const r = el.getBoundingClientRect();
  const x = (r.left - s.left) / scale;
  const below = (r.bottom - s.top) / scale + 6;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  pop.style.left = `${Math.min(Math.max(8, x), 1280 - w - 8)}px`;
  const top = below + h > 712 ? (r.top - s.top) / scale - h - 6 : below;
  pop.style.top = `${Math.min(712 - h, Math.max(8, top))}px`;
}
const hidePop = () => { pop.hidden = true; };
stage.addEventListener('mouseover', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-term]'); if (t) showPop(t); });
stage.addEventListener('mouseout', (e) => { if ((e.target as HTMLElement).closest('[data-term]')) hidePop(); });
stage.addEventListener('focusin', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-term]'); if (t) showPop(t); });
stage.addEventListener('focusout', hidePop);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); }, true);

// ---------- Fit the 1280×720 stage to the window ----------
function fit(): void {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.setProperty('--scale', String(Math.min(scale, 1.5)));
}
window.addEventListener('resize', fit);
fit();

resetLattice('title');
render();
