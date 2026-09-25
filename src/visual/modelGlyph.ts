// The model's sigil: nested rotating polygons that gain vertices and layers as capability grows.
// Day 1 is a simple triangle pair; by Day 7 it's a dense star lattice.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function buildModelGlyph(day: number, size = 40): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-50 -50 100 100');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'model-glyph');
  svg.setAttribute('aria-hidden', 'true');

  const layers = Math.min(1 + Math.ceil(day / 2), 4);
  const sides = 2 + day; // 3 on Day 1 → 9 on Day 7
  for (let l = 0; l < layers; l++) {
    const r = 44 - l * 9;
    // Alternate layers draw a star when one exists for this vertex count, else a rotated polygon.
    const star = l % 2 === 1 && sides >= 5 && sides % 2 === 1;
    const step = star ? 2 : 1;
    const offset = l % 2 === 1 && !star ? Math.PI / sides : 0;
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
      const a = ((i * step) / sides) * Math.PI * 2 - Math.PI / 2 + offset;
      pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
    }
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `glyph-layer glyph-layer-${l}`);
    g.style.animationDuration = `${18 + l * 7}s`;
    g.style.animationDirection = l % 2 ? 'reverse' : 'normal';
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts.join(' '));
    g.append(poly);
    svg.append(g);
  }
  const core = document.createElementNS(SVG_NS, 'circle');
  core.setAttribute('r', '5');
  core.setAttribute('class', 'glyph-core');
  svg.append(core);
  return svg;
}
