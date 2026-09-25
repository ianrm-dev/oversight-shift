import './fonts';
import './theme.css';
import './ui.css';
import { dayInfo } from './data/days';
import { contractById } from './ui/metaScreens';
import { gradeFor, loadProgress, recordRun, dailySeed, type RunUpdate } from './game/progress';
import {
  act, advance, breakthroughDue, breakthroughOffer, buy, canAct, chooseContract, chooseEvent, contractOffer, current, dayOver, endDay,
  eventFor, isIncident, modsFor, newRun, nextDay, prepareCard, runScore, skipUpgrade, startDay, takeBreakthrough, takeUpgrade,
  unwatchedQueue, upgradeOffer, type Action, type Outcome, type RunState, type ShopItem,
} from './game/state';
import type { Breakthrough, Contract, Difficulty, GameEvent, ToolId, Upgrade } from './types';
import { randomSeedString } from './rng';
import { RULES } from './rules';
import * as M from './ui/metaScreens';
import * as R from './ui/render';
import * as S from './ui/shift';
import { buildArc, type ArcOptions } from './visual/arc';
import { buildLattice } from './visual/lattice';
import { buildModelGlyph } from './visual/modelGlyph';

type Screen =
  | { kind: 'title' }
  | { kind: 'setup' }
  | { kind: 'codex' }
  | { kind: 'briefing' }
  | { kind: 'shift'; overlay?: { type: 'incident' | 'audit'; outcome: Outcome } }
  | { kind: 'review'; html: string }
  | { kind: 'event'; event: GameEvent; chosen?: number }
  | { kind: 'breakthrough'; offer: Breakthrough[] }
  | { kind: 'between'; offer: Upgrade[]; picked: boolean; contracts: Contract[]; contract?: string }
  | { kind: 'over' }
  | { kind: 'interim' }
  | { kind: 'win' };

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
    ? { difficulty: 'standard' as Difficulty, lab: 'frontier', level: 1, research: progress.research, daily: true }
    : { ...setup, research: progress.research };
  run = newRun(seed, hintsFor(1), opts);
  endUpdate = null;
  // Playtest shortcut: ?day=N starts the run on day N with a fresh budget.
  const jump = Number(new URLSearchParams(location.search).get('day'));
  if (!daily && jump >= 2 && jump <= RULES.days) {
    run.day = startDay(seed, jump, modsFor(run, jump), hintsFor(jump), run.used);
    for (const c of run.day.queue) run.used.add(c.card.id);
  }
  screen = { kind: 'briefing' };
  resetLattice(seed);
  render();
}

function resetLattice(seed: string): void {
  stage.querySelector('.lattice')?.remove();
  stage.prepend(buildLattice({ width: 1280, height: 720, seed, focus: { x: 640, y: 330, radius: 360 } }));
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
  endScore = runScore(run, won);
  endUpdate = recordRun(progress, {
    record: {
      seed: run.seed, date: new Date().toISOString(), difficulty: run.difficulty, level: run.level, lab: run.lab.id,
      adversary: run.adversary, dayReached: run.day.day, result: won ? 'win' : run.loss?.kind ?? 'harm',
      score: endScore, grade: gradeFor(endScore), daily: run.daily,
    },
    tells: [...run.codex],
    fundingEarned: run.fundingEarned,
  });
}

const ADVERSARY_NAME = { sandbagger: 'the sandbagger', colluder: 'the colluder', injector: 'the injector', schemer: 'the patient schemer' } as const;

function briefingExtras(r: RunState): string {
  const c = r.day.contract;
  const tags = [
    `<span class="brief-tag">${esc(r.lab.name)}</span>`,
    r.level > 1 ? `<span class="brief-tag">Model v${r.level}</span>` : '',
    c ? `<span class="brief-tag" title="${esc(c.blurb)}">Client: ${esc(c.name)}</span>` : '',
    r.day.blind ? `<span class="brief-tag bad">Monitor blind on ${r.day.blind === 'log' ? 'agent actions' : 'file changes'} today</span>` : '',
    r.adversaryRevealed ? `<span class="brief-tag bad">Adversary: ${ADVERSARY_NAME[r.adversary]}</span>` : '',
  ].join('');
  return `<div class="brief-tags">${tags}</div>${S.newToolsBlock(r)}`;
}

function render(): void {
  if (!stage.contains(screenEl)) stage.append(screenEl);
  if (screen.kind === 'title') { setLayout('solo'); screenEl.innerHTML = M.title(progress); }
  else if (screen.kind === 'setup') { setLayout('solo'); screenEl.innerHTML = M.setup(progress, setup); }
  else if (screen.kind === 'codex') { setLayout('solo'); screenEl.innerHTML = M.codex(progress); }
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
    screenEl.innerHTML = R.gameOver(run, run.loss?.kind === 'quota' ? unwatchedQueue(run) : [], M.endExtras(run, endScore, endUpdate));
  } else if (screen.kind === 'win') {
    setLayout('solo');
    finishRun(true);
    screenEl.innerHTML = R.win(run, M.endExtras(run, endScore, endUpdate));
  } else { setLayout('solo'); screenEl.innerHTML = R.interim(run); }

  if (toolkitOpen && run && (screen.kind === 'shift' || screen.kind === 'briefing')) {
    screenEl.insertAdjacentHTML('beforeend', S.toolkit(run, toolkitOpen === 'all' ? undefined : toolkitOpen));
  }
  hydrate(screenEl);
  screenEl.querySelector<HTMLElement>('[data-continue]:not([disabled]), [data-start]')?.focus({ preventScroll: true });
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
function doAction(action: Action): void {
  if (!run || screen.kind !== 'shift' || screen.overlay || !canAct(run, action)) return;
  const outcome = act(run, action);
  freshHarm = outcome?.harm ?? 0;
  preview = null;
  if (!outcome) { render(); return; } // a tool ran: same card, new evidence
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
    const summary = endDay(run);
    screen = { kind: 'review', html: R.review(run, summary) };
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

function continueScreen(): void {
  if (!run) return;
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
  if (screen.kind === 'event' && screen.chosen !== undefined) { afterReview('breakthrough'); return; }
  if (screen.kind === 'between' && (screen.picked || !screen.offer.length) && screen.contract) {
    chooseContract(run, screen.contract);
    nextDay(run, hintsFor(run.day.day + 1));
    screen = { kind: 'briefing' };
    render();
  }
}

function pickEvent(i: number): void {
  if (!run || screen.kind !== 'event' || screen.chosen !== undefined || !screen.event.choices[i]) return;
  chooseEvent(run, screen.event, i);
  screen = { ...screen, chosen: i };
  render();
}

function pickBreakthrough(i: number): void {
  if (!run || screen.kind !== 'breakthrough' || !screen.offer[i]) return;
  takeBreakthrough(run, screen.offer[i]!.id);
  afterReview('between');
}

function pickUpgrade(index: number | 'skip'): void {
  if (!run || screen.kind !== 'between' || screen.picked) return;
  if (index === 'skip') skipUpgrade(run);
  else {
    const u = screen.offer[index];
    if (!u) return;
    takeUpgrade(run, u.id);
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
  if (target === 'title' || target === 'setup' || target === 'codex') { screen = { kind: target }; resetLattice('title'); render(); }
}

function setSetup(patch: Partial<M.Setup>): void {
  setup = { ...setup, ...patch };
  saveSetup();
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
  if (screen.kind === 'title') {
    if (k === 'enter' || k === ' ') { e.preventDefault(); go('setup'); }
    else if (k === 'd') go('daily');
    else if (k === 'c') go('codex');
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
  if ((screen.kind === 'over' || screen.kind === 'interim' || screen.kind === 'win') && (k === 'enter' || k === 'n')) { e.preventDefault(); restart(k === 'n' ? 'new' : 'same'); return; }
  if ((screen.kind === 'over' || screen.kind === 'win') && k === 'escape') { go('title'); return; }
  if (screen.kind === 'event' && screen.chosen === undefined) { const i = Number(k) - 1; if (i >= 0) pickEvent(i); return; }
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
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  const next = t && !(t as HTMLButtonElement).disabled ? (t.dataset.action as R.Preview) : null;
  if (next !== preview) { preview = next; renderPreview(); }
});

// ---------- Fit the 1280×720 stage to the window ----------
function fit(): void {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.setProperty('--scale', String(Math.min(scale, 1.5)));
}
window.addEventListener('resize', fit);
fit();

resetLattice('title');
render();
