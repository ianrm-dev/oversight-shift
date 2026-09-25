// Procedural network lattice drawn behind the game: jittered nodes, links to near neighbours,
// and a few "packets" travelling along links. Seeded so it's stable for a run.
import { Rng } from '../rng';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface LatticeOptions {
  width: number;
  height: number;
  seed: string;
  /** Grid spacing in px; smaller = denser. */
  spacing?: number;
  /** Number of travelling packets. */
  packets?: number;
  /** Tints links near a point (e.g. behind the active card). */
  focus?: { x: number; y: number; radius: number };
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function buildLattice(opts: LatticeOptions): SVGSVGElement {
  const { width, height, seed, spacing = 72, packets = 7, focus } = opts;
  const rng = new Rng(`lattice:${seed}`);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'lattice', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' });

  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const pts: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offset = r % 2 ? spacing / 2 : 0;
      pts.push({ x: c * spacing + offset + rng.range(-spacing, spacing) * 0.32, y: r * spacing + rng.range(-spacing, spacing) * 0.32 });
    }
  }

  const links = el('g', { class: 'lattice-links' });
  const edges: [number, number][] = [];
  const maxD = spacing * 1.35;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i]!, b = pts[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < maxD && rng.chance(0.62)) {
        edges.push([i, j]);
        const near = focus ? Math.hypot((a.x + b.x) / 2 - focus.x, (a.y + b.y) / 2 - focus.y) < focus.radius : false;
        links.append(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: near ? 'lattice-link is-near' : 'lattice-link' }));
      }
    }
  }
  svg.append(links);

  const nodes = el('g', { class: 'lattice-nodes' });
  pts.forEach((p) => {
    const pulse = rng.chance(0.08);
    const n = el('circle', { cx: p.x, cy: p.y, r: pulse ? 2.2 : 1.3, class: pulse ? 'lattice-node is-pulse' : 'lattice-node' });
    if (pulse) n.style.animationDelay = `${rng.range(0, 6).toFixed(2)}s`;
    nodes.append(n);
  });
  svg.append(nodes);

  // Packets: short dashes animated along a link.
  const packetLayer = el('g', { class: 'lattice-packets' });
  for (let k = 0; k < packets && edges.length; k++) {
    const [i, j] = edges[rng.int(0, edges.length - 1)]!;
    const a = pts[i]!, b = pts[j]!;
    const len = Math.hypot(a.x - b.x, a.y - b.y);
    const line = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'lattice-packet', 'stroke-dasharray': `8 ${len + 8}` });
    line.style.setProperty('--len', `${len + 16}`);
    line.style.animationDelay = `${rng.range(0, 5).toFixed(2)}s`;
    line.style.animationDuration = `${rng.range(3.5, 7).toFixed(2)}s`;
    packetLayer.append(line);
  }
  svg.append(packetLayer);
  return svg;
}
