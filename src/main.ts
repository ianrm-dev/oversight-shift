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
  act, advance, coveredDays, loadoutFull, nextDayNumber, replaceUpgrade, breakthroughDue, breakthroughOffer, buy, canAct, chooseContract, chooseEvent, contractOffer, current, dayOver, endDay,
  eventChoices, eventFor, isIncident, modsFor, newRun, nextDay, scoreParts, shipUnreviewed, skipUpgrade, startDay, takeBreakthrough, takeUpgrade,
  unwatchedQueue, upgradeOffer, type Action, type Outcome, type RunState, type ShopItem,
} from './game/state';
import { upgradeById } from './data/upgrades';
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
  | { kind: 'made' }
  | { kind: 'lab'; focus?: string }
  | { kind: 'briefing' }
  | { kind: 'shift'; overlay?: { type: 'incident' | 'audit'; outcome: Outcome } }
  | { kind: 'review'; html: string }
  | { kind: 'event'; event: GameEvent; chosen?: number }
  | { kind: 'breakthrough'; offer: Breakthrough[] }
  | { kind: 'between'; offer: Upgrade[]; picked: boolean; contracts: Contract[]; contract?: string; pending?: string }
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
/** The clock-start card after Day 1's training: shown in full the first time, then as a short notice. */
let clockIntro = false;
const clockIntroKey = 'oversight-shift:clock-intro';
let fieldTestTaken = false;
/** Tours: the first time a player sees each screen, tips walk through what's on it and what to do next.
 *  Every tip advances with a button, never by forcing a move. `anchor` places a tip beside a different
 *  element than the one it highlights, so it doesn't cover what it describes. */
interface CoachStep { target: string; text: string; anchor?: string }
type TourId = 'setup' | 'briefing' | 'shift' | 'audit' | 'incident' | 'review' | 'event' | 'between' | 'breakthrough' | 'end' | 'lab';
const TOURS: Record<TourId, { title: string; steps: CoachStep[] }> = {
  setup: { title: 'New shift', steps: [
    { target: '.len-picker', text: 'The quick shift is a demo: Days 1, 3, 5 and 7 on a fast clock, about 15 minutes. The full week is the whole game, with research, more labs and stronger models.' },
    { target: '.diff-picker', text: 'Difficulty sets how much time, compute and help you get. Guided is the gentlest place to start.' },
    { target: '.lab-picker', text: 'Your lab sets your starting funding and one perk. Research unlocks more labs.' },
    { target: '[data-start]', text: 'Press Enter to start. You come back here after every run.' },
  ] },
  briefing: { title: 'Morning briefing', steps: [
    { target: '.brief-headline', text: 'Each day starts here. The big line is what changes today; the line under it is the one tip that matters most.' },
    { target: '.brief-budget', text: 'You can\'t check everything. You get a few auditors, a little compute and a clock, and they run out fast. Ship enough useful work to meet the quota, and keep harm under its limit.' },
    { target: '.brief-new', text: 'What\'s new today. Hover a name for what it does; press T during a shift for the full toolkit.' },
    { target: '.briefing-main [data-continue]', text: 'Begin when you\'re ready. The clock only runs while a card is on screen.' },
  ] },
  shift: { title: 'First shift', steps: [
    { target: '.scard-glance', text: 'The job at a glance: what kind of work it is, how much is at stake, and what the model can touch.' },
    { target: '.scard-task', anchor: '.scard-did', text: 'The task, the rules on file, and what the model did. Reading is your main tool: most sabotage shows up as work that doesn\'t match the request or the rules.' },
    { target: '.ev-monitor', text: 'The trusted monitor scores every card for free. It\'s a hint, not proof: the shaded box shows how far off it may be.' },
    { target: '[data-action="fact"]', text: 'Fact check costs 1 compute and compares the work with the rules on file. You only get a few a day, so save them for cards you can\'t settle by reading.' },
    { target: '[data-action="audit"]', text: 'A human audit is always right, but you get one or two a day. Spend it when a card could do real damage and you\'re not sure.' },
    { target: '[data-clock]', text: 'Your first 3 cards are untimed, to learn the ropes. Then the clock starts, and it only runs while a card is on screen. When it hits zero, every card left in the queue ships unreviewed.' },
    { target: '[data-region="decide"]', text: 'Then decide. Approve (A) ships the work. Defer (D) throws it out and a weaker, safe model redoes it for less. Defer too often and you miss the quota.' },
  ] },
  audit: { title: 'Human audit', steps: [
    { target: '.card.reveal', text: 'An audit shows the truth. If it was sabotage, you caught it: the safe model redoes the work, and the evidence earns funding.' },
    { target: '.incident-foot [data-continue]', text: 'The clock is paused while you read. Continue when you\'re ready.' },
  ] },
  incident: { title: 'Incident report', steps: [
    { target: '.incident-headline', text: 'Something got past you. This is what happened when the work shipped.' },
    { target: '.tell', text: 'The tell: the clue on the card, what researchers call this, and which tool would have caught it.' },
    { target: '.hud-meter.harm', text: 'Harm adds up over the whole run, and the run ends when it reaches the limit. Your first miss (two on Guided) is a free warning.' },
  ] },
  review: { title: 'End of day', steps: [
    { target: '.review-body', text: 'How the day went: what got past you, what you caught, and the terms you saw in action.' },
    { target: '.ledger', text: 'Funding. Shipping more than the quota and catching sabotage earn it; incidents cost it. You spend it at the budget meeting.' },
    { target: '.review-foot [data-continue]', text: 'Continue to see what happens overnight, then plan tomorrow.' },
  ] },
  event: { title: 'Between shifts', steps: [
    { target: '.event-card', text: 'Something happens between shifts. Every choice has a cost as well as a benefit, listed under it.' },
    { target: '.ev-choices', text: 'Pick one (1, 2 or 3). Some effects last one day; some last the whole run.' },
  ] },
  between: { title: 'Budget meeting', steps: [
    { target: '.pick', text: 'Pick one upgrade (1 to 3). It stays for the rest of the run. Or skip (S) for an extra auditor tomorrow.' },
    { target: '.loadout', text: 'Your upgrades. You can hold four; when you\'re full, a new one replaces an old one.' },
    { target: '.shop', text: 'Spend funding on help for tomorrow only: an auditor, compute, a sharper monitor, or new upgrade offers. Prices rise each time you buy.' },
    { target: '.next-day', text: 'Tomorrow, and who it\'s for. Pick a client (Q or W): each changes the quota, the pay or your auditors.' },
    { target: '.next-day [data-continue]', text: 'Start the next day once you\'ve picked an upgrade and a client.' },
  ] },
  breakthrough: { title: 'Breakthrough', steps: [
    { target: '.bt-grid', text: 'The field just learned something. Pick one (1 or 2): it lasts for the rest of the run.' },
  ] },
  end: { title: 'Run over', steps: [
    { target: '.over-grid', text: 'How it went: what got past you, how you compare with real auditors, and your week at a glance.' },
    { target: '.end-extras', text: 'The hidden adversary you faced and your score. Full-week runs also earn Insight for research, and failed runs earn the most, as in real research.' },
    { target: '.over-actions [data-go="lab"]', text: 'Spend Insight in the Research lab: research makes every future run easier. The Field test checks what stuck.' },
    { target: '.over-actions', text: 'Play again, try a new seed, or go back to the menu.' },
  ] },
  lab: { title: 'Research lab', steps: [
    { target: '.branches', text: 'Six research agendas. Each node costs Insight and makes future runs easier. Branches your failures pointed at are half price.' },
    { target: '.lab-detail', text: 'Hover a node to see what it does and the real research behind it. Click to fund it.' },
  ] },
};
const toursKey = 'oversight-shift:tours';
function toursSeen(): Set<string> {
  try {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(toursKey) ?? '[]') as string[]);
    if (localStorage.getItem('oversight-shift:coached')) seen.add('shift'); // players from before per-screen tours
    return seen;
  } catch { return new Set(Object.keys(TOURS)); }
}
function markSeen(ids: string[]): void {
  try { localStorage.setItem(toursKey, JSON.stringify([...new Set([...toursSeen(), ...ids])])); } catch { /* storage unavailable */ }
}
function resetTours(): void {
  try { localStorage.removeItem(toursKey); localStorage.removeItem('oversight-shift:coached'); localStorage.removeItem('oversight-shift:clock-intro'); } catch { /* storage unavailable */ }
}
let tour: { id: TourId; step: number } | null = null;

/** Which tour belongs to the screen on show, if any. */
function tourFor(): TourId | null {
  if (paused || toolkitOpen) return null;
  switch (screen.kind) {
    case 'setup': return 'setup';
    case 'briefing': return 'briefing';
    case 'shift': return screen.overlay ? (screen.overlay.type === 'audit' ? 'audit' : 'incident') : 'shift';
    case 'review': return 'review';
    case 'event': return screen.chosen === undefined ? 'event' : null;
    case 'between': return screen.pending ? null : 'between';
    case 'breakthrough': return 'breakthrough';
    case 'over': case 'win': return 'end';
    case 'lab': return 'lab';
    default: return null;
  }
}
function clearCoach(): void {
  screenEl.querySelector('.coach')?.remove();
  screenEl.querySelector('.coach-spot')?.remove();
  stage.querySelectorAll('.coach-ring').forEach((e) => e.classList.remove('coach-ring'));
}
/** Starts the screen's tour the first time it's seen, and draws the current tip. */
function syncTour(): void {
  const id = tourFor();
  if (tour && tour.id !== id) tour = null;
  if (!tour && id && !toursSeen().has(id)) tour = { id, step: 0 };
  drawCoach();
}
function endTour(all = false): void {
  if (tour) markSeen(all ? Object.keys(TOURS) : [tour.id]);
  tour = null;
  coachKey = '';
  clearCoach();
}
function nextTip(): void {
  if (!tour) return;
  tour.step++;
  if (tour.step >= TOURS[tour.id].steps.length) endTour(); else drawCoach();
}
/** The tip on screen, so redrawing it (after a re-render, or once animations settle) doesn't replay its fade-in. */
let coachKey = '';
function drawCoach(): void {
  clearCoach();
  if (!tour) return;
  const { title, steps } = TOURS[tour.id];
  // Skip tips whose element isn't on this screen (e.g. no new tools today).
  while (tour.step < steps.length && !screenEl.querySelector(steps[tour.step]!.target)) tour.step++;
  if (tour.step >= steps.length) { endTour(); return; }
  const step = steps[tour.step]!;
  const target = screenEl.querySelector<HTMLElement>(step.target)!;
  target.classList.add('coach-ring');
  const s = stage.getBoundingClientRect();
  const scale = s.width / 1280;
  const toStage = (r: DOMRect) => ({ l: (r.left - s.left) / scale, t: (r.top - s.top) / scale, r: (r.right - s.left) / scale, b: (r.bottom - s.top) / scale });
  const a = toStage((step.anchor ? screenEl.querySelector(step.anchor) ?? target : target).getBoundingClientRect());
  const t = toStage(target.getBoundingClientRect());
  // Spotlight: dim everything but the highlighted element, so the tip reads as the one thing to look at.
  const pad = 6;
  const spot = document.createElement('div');
  spot.className = 'coach-spot';
  Object.assign(spot.style, { left: `${t.l - pad}px`, top: `${t.t - pad}px`, width: `${t.r - t.l + pad * 2}px`, height: `${t.b - t.t + pad * 2}px` });
  const last = tour.step === steps.length - 1;
  const box = document.createElement('div');
  box.className = 'coach';
  // The dimmed backdrop fades in once per tour; the tip box animates once per tip.
  const key = `${tour.id}:${tour.step}`;
  if (coachKey.startsWith(`${tour.id}:`)) spot.style.animation = 'none';
  if (key === coachKey) box.style.animation = 'none';
  coachKey = key;
  box.innerHTML = `<span class="eyebrow">${title} · ${tour.step + 1} of ${steps.length}</span><p>${step.text}</p><div class="coach-actions"><button class="btn-primary" data-coach="next"><kbd>Space</kbd> ${last ? 'Got it' : 'Next'}</button><button class="link-btn" data-coach="skip">Skip all tips</button></div>`;
  screenEl.append(spot, box);
  const w = box.offsetWidth, h = box.offsetHeight;
  // Below, above, right, then left of the anchor: the first place that fits on the stage.
  const spots = [
    { left: a.l, top: a.b + 12 }, { left: a.l, top: a.t - h - 12 },
    { left: a.r + 14, top: a.t }, { left: a.l - w - 14, top: a.t },
  ];
  const fits = (p: { left: number; top: number }) => p.top >= 8 && p.top + h <= 712 && p.left >= 8 && p.left + w <= 1272;
  const clamp = (p: { left: number; top: number }) => ({ left: Math.min(Math.max(12, p.left), 1268 - w), top: Math.min(Math.max(8, p.top), 712 - h) });
  // Side placements may slide up or down to stay on the stage; if nothing fits, sit inside the target's lower corner.
  const side = (p: { left: number; top: number }) => ({ left: p.left, top: Math.min(Math.max(8, p.top), 712 - h) });
  const at = clamp(spots.slice(0, 2).find(fits) ?? spots.slice(2).map(side).find(fits) ?? { left: a.l + 12, top: a.b - h - 12 });
  box.style.left = `${at.left}px`;
  box.style.top = `${at.top}px`;
}

/** Pause menu: open during a run; stops the shift clock. */
let paused = false;
const PAUSABLE = new Set(['intro', 'briefing', 'shift', 'review', 'event', 'breakthrough', 'between', 'reveal', 'timeout']);
let setup: M.Setup = loadSetup();

function loadSetup(): M.Setup {
  const fallback: M.Setup = { difficulty: 'guided', lab: 'frontier', level: 1, quick: true };
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

/** Layout hints for the days a shift covers; the day itself wins over a skipped day. */
/** Play counts: a same-origin image request when a run starts and ends, counted from the server's request log.
 *  No cookies and no identifiers; production builds only. */
function ping(event: 'start' | 'end', params: Record<string, string | number>): void {
  if (!import.meta.env.PROD) return;
  const q = new URLSearchParams({ e: event, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), r: Math.random().toString(36).slice(2, 8) });
  new Image().src = `${import.meta.env.BASE_URL}ping.gif?${q}`;
}
const runMode = (r: RunState): string => (r.daily ? 'daily' : r.quick ? 'quick' : 'full');

// ---------- Feedback: a short note sent to the site's own request log, like the play counter ----------
let feedback: null | { sent: boolean } = null;
function openFeedback(): void { feedback = { sent: false }; render(); screenEl.querySelector<HTMLTextAreaElement>('.feedback textarea')?.focus(); }
function closeFeedback(): void { feedback = null; render(); }
/** Plain text only: no control characters, invisible characters or direction overrides, whitespace collapsed. */
const cleanText = (v: string, max: number): string =>
  v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const feedbackSends: number[] = [];
function sendFeedback(): void {
  const box = screenEl.querySelector<HTMLTextAreaElement>('.feedback textarea');
  const text = cleanText(box?.value ?? '', 800);
  if (!text) { box?.focus(); return; }
  // At most 5 notes a session, 20 seconds apart, so one visitor can't flood the log.
  const now = Date.now();
  if (feedbackSends.length >= 5 || now - (feedbackSends.at(-1) ?? 0) < 20000) { feedback = { sent: true }; render(); return; }
  feedbackSends.push(now);
  const contact = cleanText(screenEl.querySelector<HTMLInputElement>('.feedback input')?.value ?? '', 120);
  const q = new URLSearchParams({ e: 'feedback', t: text, c: contact, m: run ? runMode(run) : '', d: run?.difficulty ?? '', day: String(run?.day.day ?? ''), r: Math.random().toString(36).slice(2, 8) });
  if (import.meta.env.PROD) new Image().src = `${import.meta.env.BASE_URL}ping.gif?${q}`;
  else console.info('feedback (dev, not sent):', Object.fromEntries(q));
  feedback = { sent: true };
  render();
}

const hintsFor = (days: number[]) => Object.assign({}, ...days.map((d) => dayInfo(d).hints)) as ReturnType<typeof dayInfo>['hints'];
const esc = R.esc;

function startRun(seed: string, daily = false): void {
  const opts = daily
    ? { difficulty: 'standard' as Difficulty, lab: 'frontier', level: 1, research: [], daily: true }
    : setup.quick
      // The quick shift is a demo, tuned apart from the full game: fixed lab and model, no research.
      ? { difficulty: setup.difficulty, lab: 'frontier', level: 1, research: [], quick: true }
      : { ...setup, quick: false, research: progress.research };
  run = newRun(seed, hintsFor([1]), opts);
  ping('start', { m: runMode(run), d: run.difficulty, v: run.level });
  endUpdate = null;
  revealShown = false;
  fieldTestTaken = false;
  paused = false;
  resetTermsMet();
  noteUsed('ai-control', 'you ran the protocol');
  noteUsed('trusted-monitoring', 'it scored every card');
  noteUsed(LAB_TERM[run.lab.id], `your lab: ${run.lab.name}`);
  // Playtest shortcut: ?day=N starts the run on day N with a fresh budget.
  const jump = Number(new URLSearchParams(location.search).get('day'));
  if (!daily && jump >= 2 && jump <= RULES.days) {
    run.day = startDay(seed, jump, modsFor(run, jump), hintsFor(coveredDays(run.quick, jump)), run.used);
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
  ping('end', { m: runMode(run), d: run.difficulty, res: won ? 'win' : run.loss?.kind ?? 'harm', day: run.day.day });
  endGrade = gradeFor(parts.graded);
  endUpdate = recordRun(progress, {
    record: {
      seed: run.seed, date: new Date().toISOString(), difficulty: run.difficulty, level: run.level, lab: run.lab.id,
      adversary: run.adversary, dayReached: run.day.day, result: won ? 'win' : run.loss?.kind ?? 'harm',
      score: endScore, grade: endGrade, daily: run.daily, quick: run.quick,
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
  return `Forecast: ${Math.max(0, n - 1)}–${n + 1} attacks today.`;
}

function briefingExtras(r: RunState): R.BriefingParts {
  const c = r.day.contract;
  const tools = S.newTools(r);
  return {
    meta: [esc(r.lab.name), r.level > 1 ? `Model v${r.level}` : '', c ? `<span title="${esc(c.blurb)}">Client: ${esc(c.name)}</span>` : ''].filter(Boolean),
    alerts: [
      ...(r.day.blind ? [{ text: `The monitor is blind on ${r.day.blind === 'log' ? 'agent actions' : 'file changes'} today.`, tone: 'bad' as const }] : []),
      ...(r.adversaryRevealed ? [{ text: `You're facing ${ADVERSARY_NAME[r.adversary]}.`, tone: 'bad' as const }] : []),
      ...r.harmLog.filter((h) => h.day === r.day.day - 1).map((h) => ({ text: `Harm ${h.amount > 0 ? '+' : ''}${h.amount} from ${esc(h.reason)}.`, tone: h.amount < 0 ? 'good' as const : 'bad' as const })),
      ...(r.research.includes('evl-forecast') ? [{ text: forecast(r), tone: 'info' as const }] : []),
    ],
    tools: tools.chips,
    terms: L.dayTermChips(r, tools.ids),
  };
}

function render(): void {
  if (!stage.contains(screenEl)) stage.append(screenEl);
  pop.hidden = true;
  setMood(run && !['title', 'setup', 'codex', 'guide', 'lab', 'daily-info', 'made'].includes(screen.kind) ? run.day.day : null);
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
  else if (screen.kind === 'made') { setLayout('solo'); screenEl.innerHTML = M.howMade(); }
  else if (!run) return;
  else if (screen.kind === 'briefing') { setLayout('solo'); screenEl.innerHTML = R.briefing(run, briefingExtras(run)); }
  else if (screen.kind === 'shift') {
    setLayout('shift');
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
    screenEl.innerHTML = R.between(run, screen.offer, screen.picked, M.contractPanel(screen.contracts, screen.contract), !!screen.contract, screen.pending);
  } else if (screen.kind === 'over') {
    setLayout('solo');
    finishRun(false);
    screenEl.innerHTML = R.gameOver(run, run.loss?.kind === 'quota' ? unwatchedQueue(run) : [], R.replayStrip(run, false), M.endExtras(run, endScore, endUpdate, endGrade));
  } else if (screen.kind === 'win') {
    setLayout('solo');
    finishRun(true);
    screenEl.innerHTML = R.win(run, R.replayStrip(run, true), M.endExtras(run, endScore, endUpdate, endGrade));
  } else if (screen.kind === 'reveal') { setLayout('solo'); screenEl.innerHTML = M.adversaryReveal(run, screen.source); }
  else { setLayout('solo'); screenEl.innerHTML = R.interim(run); }

  if (feedback) screenEl.insertAdjacentHTML('beforeend', R.feedbackDialog(feedback.sent));
  else if (paused && run) screenEl.insertAdjacentHTML('beforeend', R.pauseMenu(run));
  else if (clockIntro && run && screen.kind === 'shift' && !screen.overlay) screenEl.insertAdjacentHTML('beforeend', R.clockIntro(run));
  if (toolkitOpen && run && (screen.kind === 'shift' || screen.kind === 'briefing')) {
    screenEl.insertAdjacentHTML('beforeend', S.toolkit(run, toolkitOpen === 'all' ? undefined : toolkitOpen));
  }
  hydrate(screenEl);
  requestAnimationFrame(markScroll);
  screenEl.querySelector<HTMLElement>('[data-continue]:not([disabled]), [data-start]')?.focus({ preventScroll: true });
  // Place the tip now, and again once entrance animations have settled, so the spotlight lines up.
  requestAnimationFrame(syncTour);
  window.setTimeout(() => { if (tour) drawCoach(); }, 700);
}

/** Panels that scroll get a fade at the bottom while there's more below, so hidden content is never a surprise. */
const SCROLLERS = '.scard, .evidence-panel, .incident-body, .review-scroll, .unwatched, .over-grid > *, .missed-list, .gd-body, .toolkit';
function markScroll(): void {
  screenEl.querySelectorAll<HTMLElement>(SCROLLERS).forEach((el) => {
    if (getComputedStyle(el).overflowY === 'visible') return;
    el.classList.toggle('has-more', el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  });
}
screenEl.addEventListener('scroll', markScroll, true);

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
function showToast(text: string, tone: 'good' | 'neutral' | 'defer', ms = 1600): void {
  const center = screenEl.querySelector('[data-region="simple-main"]');
  if (!center) return;
  center.querySelector('.toast')?.remove();
  center.insertAdjacentHTML('beforeend', R.toast(text, tone));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => center.querySelector('.toast')?.remove(), ms);
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
    if (run.day.untimed && run.day.index === run.day.untimed) {
      let seen = false;
      try { seen = !!localStorage.getItem(clockIntroKey); } catch { /* storage unavailable */ }
      if (!seen) clockIntro = true;
      // After the caller's own toast (e.g. "Shipped"), so this one isn't replaced straight away.
      else { render(); window.setTimeout(() => showToast('Training done: the clock is running', 'defer', 2600), 0); return; }
    }
  }
  render();
}

function startClock(): void {
  clockIntro = false;
  try { localStorage.setItem(clockIntroKey, '1'); } catch { /* storage unavailable */ }
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
    nextDay(run, hintsFor(coveredDays(run.quick, nextDayNumber(run))));
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
  if (index === 'skip') { skipUpgrade(run); screen = { ...screen, picked: true, pending: undefined }; render(); return; }
  const u = screen.offer[index];
  if (!u) return;
  // A full loadout asks which upgrade to swap out.
  if (loadoutFull(run)) { screen = { ...screen, pending: u.id }; render(); return; }
  takeUpgrade(run, u.id);
  noteUsed(UPGRADE_TERM[u.id], `upgrade: ${u.name}`);
  screen = { ...screen, picked: true };
  render();
}

function replaceWith(oldId: string): void {
  if (!run || screen.kind !== 'between' || !screen.pending) return;
  if (oldId === 'keep') { skipUpgrade(run); screen = { ...screen, picked: true, pending: undefined }; render(); return; }
  const id = screen.pending;
  replaceUpgrade(run, oldId, id);
  noteUsed(UPGRADE_TERM[id], `upgrade: ${upgradeById(id)?.name ?? id}`);
  screen = { ...screen, picked: true, pending: undefined };
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
  if (target === 'title' || target === 'setup' || target === 'lab' || target === 'daily-info' || target === 'made') { screen = { kind: target }; resetLattice('title'); render(); }
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
  if (feedback) {
    if (e.key === 'Escape') { e.preventDefault(); closeFeedback(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !feedback.sent) { e.preventDefault(); sendFeedback(); }
    else if (feedback.sent && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); closeFeedback(); }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (toolkitOpen) {
    if (k === 'escape' || k === 't') { e.preventDefault(); toggleToolkit(null); }
    return;
  }
  if (clockIntro) {
    if (k === ' ' || k === 'enter') { e.preventDefault(); startClock(); }
    return;
  }
  // While a tip is up, the game waits: Space or Enter for the next tip, Esc skips them all.
  if (tour) {
    e.preventDefault();
    if (k === ' ' || k === 'enter') nextTip();
    else if (k === 'escape') endTour(true);
    return;
  }
  if (paused) {
    e.preventDefault();
    if (k === 'escape' || k === 'enter' || k === ' ') setPaused(false);
    else if (k === 'r') { paused = false; restart('same'); }
    else if (k === 'q') abandonRun();
    else if (k === 'h') { resetTours(); setPaused(false); }
    else if (k === 'f') { e.preventDefault(); openFeedback(); }
    return;
  }
  if (k === 'escape' && run && PAUSABLE.has(screen.kind)) { e.preventDefault(); setPaused(true); return; }
  if (screen.kind === 'title') {
    if (k === 'enter' || k === ' ') { e.preventDefault(); go('setup'); }
    else if (k === 'd') go('daily-info');
    else if (k === 'c' || k === 'g') go('guide');
    else if (k === 'l') go('lab');
    else if (k === 'h') go('made');
    else if (k === 'f') { e.preventDefault(); openFeedback(); }
    return;
  }
  if (screen.kind === 'made') { if (k === 'escape' || k === 'h') go('title'); return; }
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
    else if (k === 'q') setSetup({ quick: !setup.quick });
    else if (k === 'enter') { e.preventDefault(); startRun(randomSeedString()); }
    else if (k === 'escape') go('title');
    return;
  }
  if (screen.kind === 'codex') { if (k === 'escape' || k === 'c') go('title'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win') && k === 'f') { go('fieldtest'); return; }
  if ((screen.kind === 'over' || screen.kind === 'interim' || screen.kind === 'win') && (k === 'enter' || k === 'n')) { e.preventDefault(); restart(k === 'n' ? 'new' : 'same'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win' || screen.kind === 'interim') && k === 'escape') { go('title'); return; }
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
  if (screen.kind === 'between' && screen.pending) {
    const i = Number(k) - 1;
    if (run && run.upgrades[i]) replaceWith(run.upgrades[i]!);
    else if (k === 'k' || k === 'escape') replaceWith('keep');
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
  const rep = el.closest<HTMLElement>('[data-replace]');
  if (rep && rep.dataset.replace) { replaceWith(rep.dataset.replace); return; }
  if (el.closest('[data-clock-start]')) { startClock(); return; }
  if (clockIntro) return;
  const coach = el.closest<HTMLElement>('[data-coach]');
  if (coach) {
    if (coach.dataset.coach === 'skip') endTour(true); else nextTip();
    return;
  }
  const fb = el.closest<HTMLElement>('[data-feedback]');
  if (fb) {
    const a = fb.dataset.feedback;
    if (a === 'open') openFeedback(); else if (a === 'send') sendFeedback(); else if (a === 'close') closeFeedback();
    return;
  }
  if (feedback) return; // clicks behind the dialog do nothing
  if (tour) return; // the screen waits while a tip is up
  const menu = el.closest<HTMLElement>('[data-pause]');
  if (menu) {
    const a = menu.dataset.pause;
    if (a === 'open') setPaused(true);
    else if (a === 'resume') setPaused(false);
    else if (a === 'restart') { paused = false; restart('same'); }
    else if (a === 'quit') abandonRun();
    else if (a === 'tips') { resetTours(); setPaused(false); }
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
  const info = el.closest<HTMLElement>('[data-toolkit], [data-toolkit-close], [data-expand], [data-difficulty], [data-length], [data-lab], [data-level], [data-go], [data-share]');
  if (info) {
    e.stopPropagation();
    if ((info as HTMLButtonElement).disabled) return;
    if (info.hasAttribute('data-toolkit-close')) toggleToolkit(null);
    else if (info.hasAttribute('data-expand')) { expanded = !expanded; render(); }
    else if (info.dataset.difficulty) setSetup({ difficulty: info.dataset.difficulty as Difficulty });
    else if (info.dataset.length) setSetup({ quick: info.dataset.length === 'quick' });
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
  if (!run || screen.kind !== 'shift' || screen.overlay || toolkitOpen || paused || document.hidden || tour) return;
  const d = run.day;
  if (!d.attention || dayOver(d) || d.index < d.untimed || clockIntro) return;
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

// Dev-only hook for headless screen audits: exposes run state to a test browser. Stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __os: {
      get run() { return run; },
      get screen() { return screen; },
      get coach() { return tour ? tour.step : -1; },
      get tour() { return tour?.id ?? null; },
      /** A veteran profile: all research, every model version, some Insight. */
      veteran(ids: string[]) { progress.research = ids; progress.maxModel = 5; progress.insight = 40; render(); },
    },
  });
}
