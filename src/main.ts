import './fonts';
import './theme.css';
import './ui.css';
import { randomSeedString } from './rng';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');

function renderTitle(root: HTMLElement): void {
  root.innerHTML = `
    <main class="title-screen">
      <h1>Oversight Shift</h1>
      <p class="tagline">You run the AI-control protocol on shift.</p>
      <button type="button" id="start">Start shift</button>
    </main>
  `;
  root.querySelector<HTMLButtonElement>('#start')?.addEventListener('click', () => {
    renderComingSoon(root, randomSeedString());
  });
}

function renderComingSoon(root: HTMLElement, seed: string): void {
  root.innerHTML = `
    <main class="title-screen">
      <h1>Day 1 — coming soon</h1>
      <p class="seed">Seed ${seed}</p>
      <button type="button" id="back">Back</button>
    </main>
  `;
  root.querySelector<HTMLButtonElement>('#back')?.addEventListener('click', () => renderTitle(root));
}

renderTitle(app);
