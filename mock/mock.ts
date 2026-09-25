// Mock-only wiring: draws the procedural visuals into the static screens. No game logic.
import '../src/fonts';
import '../src/theme.css';
import '../src/ui.css';
import './mock.css';
import { buildLattice } from '../src/visual/lattice';
import { buildModelGlyph } from '../src/visual/modelGlyph';
import { buildArc, type ArcOptions } from '../src/visual/arc';

document.querySelectorAll<HTMLElement>('[data-lattice]').forEach((stage) => {
  const focus = stage.classList.contains('stage-between') ? undefined : { x: 640, y: 330, radius: 360 };
  stage.prepend(buildLattice({ width: 1280, height: 720, seed: 'mock', focus }));
});

document.querySelectorAll<HTMLElement>('[data-glyph]').forEach((slot) => {
  slot.append(buildModelGlyph(Number(slot.dataset.glyph), Number(slot.dataset.size ?? 40)));
});

document.querySelectorAll<HTMLElement>('[data-arc]').forEach((wrap) => {
  const opts = JSON.parse(wrap.dataset.arc ?? '{}') as ArcOptions;
  wrap.prepend(buildArc(opts));
});

// ?only=<frame id> shows a single frame with no page chrome (used for screenshots).
const only = new URLSearchParams(location.search).get('only');
if (only) {
  document.body.classList.add('mock-only');
  document.querySelectorAll<HTMLElement>('.frame').forEach((f) => { f.hidden = f.id !== only; });
}
