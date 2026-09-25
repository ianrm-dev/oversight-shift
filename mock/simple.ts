// Mock-only wiring for the simpler-screen proposal.
import '../src/fonts';
import '../src/theme.css';
import '../src/ui.css';
import './mock.css';
import './simple.css';
import { buildLattice } from '../src/visual/lattice';
import { buildModelGlyph } from '../src/visual/modelGlyph';

document.querySelectorAll<HTMLElement>('[data-lattice]').forEach((stage) => {
  stage.prepend(buildLattice({ width: 1280, height: 720, seed: 'mock', focus: { x: 640, y: 360, radius: 420 } }));
});
document.querySelectorAll<HTMLElement>('[data-glyph]').forEach((slot) => {
  slot.append(buildModelGlyph(Number(slot.dataset.glyph), Number(slot.dataset.size ?? 40)));
});
const only = new URLSearchParams(location.search).get('only');
if (only) {
  document.body.classList.add('mock-only');
  document.querySelectorAll<HTMLElement>('.frame').forEach((f) => { f.hidden = f.id !== only; });
}
