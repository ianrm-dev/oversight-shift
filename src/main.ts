import './fonts';
import './theme.css';
import './ui.css';
import { dayInfo } from './data/days';
import { act, advance, buy, canAct, current, dayOver, endDay, newRun, nextDay, skipUpgrade, takeUpgrade, unwatchedQueue, upgradeOffer, type Action, type Outcome, type RunState, type ShopItem } from './game/state';
import type { Upgrade } from './types';
import { randomSeedString } from './rng';
import { RULES } from './rules';
import * as R from './ui/render';
import { buildArc, type ArcOptions } from './visual/arc';
import { buildLattice } from './visual/lattice';
import { buildModelGlyph } from './visual/modelGlyph';

type Screen =
  | { kind: 'title' }
  | { kind: 'briefing' }
  | { kind: 'shift'; overlay?: { type: 'incident' | 'audit'; outcome: Outcome } }
  | { kind: 'review'; html: string }
  | { kind: 'between'; offer: Upgrade[]; picked: boolean }
  | { kind: 'over' }
  | { kind: 'interim' };

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');

app.innerHTML = '<div class="viewport"><div class="stage" id="stage"></div></div>';
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const screenEl = document.createElement('div');
screenEl.className = 'screen';

let run: RunState | null = null;
let screen: Screen = { kind: 'title' };
let preview: R.Preview = null;
let freshHarm = 0;

function hintsFor(day: number) {
  return dayInfo(day).hints;
}

function startRun(seed: string): void {
  run = newRun(seed, hintsFor(1));
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
  stage.classList.toggle('stage-between', kind === 'between');
  stage.classList.toggle('stage-solo', kind === 'solo');
}

function region(tag: string, cls: string, html: string): string {
  return `<${tag} class="${cls}" data-region="${cls.split(' ')[0]}">${html}</${tag}>`;
}

function render(): void {
  if (!stage.contains(screenEl)) stage.append(screenEl);
  if (screen.kind === 'title') {
    setLayout('solo');
    screenEl.innerHTML = R.title();
  } else if (!run) {
    return;
  } else if (screen.kind === 'briefing') {
    setLayout('solo');
    screenEl.innerHTML = R.briefing(run);
  } else if (screen.kind === 'shift') {
    setLayout('shift');
    const c = current(run.day);
    const overlay = screen.overlay;
    const center = overlay
      ? overlay.type === 'incident' ? R.incident(run, overlay.outcome) : R.auditReveal(run, overlay.outcome)
      : c ? R.card(run, c) : '';
    screenEl.innerHTML =
      region('header', 'topbar', R.topbar(run)) +
      region('aside', 'rail rail-left', R.leftRail(run, overlay ? null : preview, freshHarm)) +
      region('main', 'center', center) +
      region('aside', 'rail rail-right', R.rightRail(run, !overlay)) +
      region('footer', `actionbar${overlay ? ' is-muted' : ''}`, R.actionbar(run, overlay ? null : preview, !!overlay));
  } else if (screen.kind === 'review') {
    setLayout('between');
    screenEl.innerHTML = screen.html;
  } else if (screen.kind === 'between') {
    setLayout('between');
    screenEl.innerHTML = R.between(run, screen.offer, screen.picked);
  } else if (screen.kind === 'over') {
    setLayout('solo');
    screenEl.innerHTML = R.gameOver(run, run.loss?.kind === 'quota' ? unwatchedQueue(run) : []);
  } else {
    setLayout('solo');
    screenEl.innerHTML = R.interim(run);
  }
  hydrate(screenEl);
  screenEl.querySelector<HTMLElement>('[data-continue]:not([disabled]), [data-start]')?.focus({ preventScroll: true });
}

/** Hover previews only touch the meters and buttons, so the card doesn't re-animate. */
function renderPreview(): void {
  if (!run || screen.kind !== 'shift' || screen.overlay) return;
  const left = screenEl.querySelector('[data-region="rail"].rail-left');
  const bar = screenEl.querySelector('[data-region="actionbar"]');
  if (left) { left.innerHTML = R.leftRail(run, preview, freshHarm); hydrate(left); }
  if (bar) bar.innerHTML = R.actionbar(run, preview);
}

// ---------- Flow ----------
function doAction(action: Action): void {
  if (!run || screen.kind !== 'shift' || screen.overlay || !canAct(run, action)) return;
  const outcome = act(run, action);
  freshHarm = outcome?.harm ?? 0;
  preview = null;
  if (!outcome) { render(); return; } // resample: new draft on the same card
  if (outcome.action === 'approve' && outcome.draft.sabotaged) {
    screen = { kind: 'shift', overlay: { type: 'incident', outcome } };
  } else if (outcome.action === 'audit') {
    screen = { kind: 'shift', overlay: { type: 'audit', outcome } };
  } else {
    const text = outcome.action === 'defer'
      ? `Deferred · trusted version shipped · +${outcome.usefulness}`
      : `Shipped · +${outcome.usefulness}`;
    nextCard();
    showToast(text, outcome.action === 'defer' ? 'defer' : 'neutral');
    return;
  }
  render();
}

let toastTimer = 0;
function showToast(text: string, tone: 'good' | 'neutral' | 'defer'): void {
  const center = screenEl.querySelector('[data-region="center"]');
  if (!center) return;
  center.querySelector('.toast')?.remove();
  center.insertAdjacentHTML('beforeend', R.toast(text, tone));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => center.querySelector('.toast')?.remove(), 1600);
}

function nextCard(): void {
  if (!run) return;
  freshHarm = 0;
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

function continueScreen(): void {
  if (!run) return;
  if (screen.kind === 'briefing') { screen = { kind: 'shift' }; render(); return; }
  if (screen.kind === 'shift' && screen.overlay) { nextCard(); return; }
  if (screen.kind === 'review') {
    if (run.loss) screen = { kind: 'over' };
    else if (run.day.day >= RULES.lastPlayableDay) screen = { kind: 'interim' };
    else screen = { kind: 'between', offer: upgradeOffer(run), picked: false };
    render();
    return;
  }
  if (screen.kind === 'between' && (screen.picked || !screen.offer.length)) {
    nextDay(run, hintsFor(run.day.day + 1));
    screen = { kind: 'briefing' };
    render();
  }
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

function buyItem(item: ShopItem): void {
  if (!run || screen.kind !== 'between') return;
  if (item === 'reroll' && (screen.picked || !screen.offer.length)) return;
  if (!buy(run, item)) return;
  if (item === 'reroll') screen = { ...screen, offer: upgradeOffer(run) };
  render();
}

function restart(mode: 'same' | 'new'): void {
  startRun(mode === 'same' && run ? run.seed : randomSeedString());
}

// ---------- Input ----------
const KEYS: Record<string, Action> = { a: 'approve', u: 'audit', d: 'defer', r: 'resample' };

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (screen.kind === 'title' && (k === 'enter' || k === ' ')) { e.preventDefault(); startRun(randomSeedString()); return; }
  if ((screen.kind === 'over' || screen.kind === 'interim') && (k === 'enter' || k === 'n')) { e.preventDefault(); restart(k === 'n' ? 'new' : 'same'); return; }
  if (k === ' ' || k === 'enter') {
    if (screen.kind === 'shift' && !screen.overlay) return;
    e.preventDefault();
    continueScreen();
    return;
  }
  if (screen.kind === 'between') {
    if (k === '1' || k === '2' || k === '3') pickUpgrade(Number(k) - 1);
    else if (k === 's') pickUpgrade('skip');
    return;
  }
  const action = KEYS[k];
  if (action) doAction(action);
});

screenEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-continue], [data-start], [data-restart], [data-upgrade], [data-buy]');
  if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.dataset.upgrade && screen.kind === 'between') pickUpgrade(screen.offer.findIndex((u) => u.id === t.dataset.upgrade));
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
