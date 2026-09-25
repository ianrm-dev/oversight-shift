// Arc meters: a 240° gauge, open at the bottom. Continuous (usefulness, with a quota tick)
// or segmented (harm, one segment per point up to the ceiling).
const SVG_NS = 'http://www.w3.org/2000/svg';
const START = -120;
const SWEEP = 240;

export interface ArcOptions {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  tone: 'accent' | 'harm';
  /** Draw one segment per unit instead of a continuous arc. */
  segmented?: boolean;
  /** Units at the top of the value that just arrived (drawn with a glow). */
  fresh?: number;
  /** Units a hovered action would add (drawn as a ghost). */
  preview?: number;
  /** Value to mark with a tick, e.g. the day's quota. */
  marker?: number;
}

function point(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = point(cx, cy, r, a0);
  const [x1, y1] = point(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function path(d: string, cls: string): SVGPathElement {
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('class', cls);
  return p;
}

export function buildArc(o: ArcOptions): SVGSVGElement {
  const size = o.size ?? 140;
  const stroke = o.stroke ?? 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - stroke;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${Math.round(size * 0.84)}`);
  svg.setAttribute('class', `arc arc-${o.tone}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.setProperty('--arc-stroke', `${stroke}px`);
  const angle = (v: number) => START + (Math.min(v, o.max) / o.max) * SWEEP;

  if (o.segmented) {
    const gap = 3;
    const segSweep = SWEEP / o.max;
    for (let i = 0; i < o.max; i++) {
      const a0 = START + i * segSweep + gap / 2;
      const a1 = START + (i + 1) * segSweep - gap / 2;
      let cls = 'arc-track';
      if (i < o.value) cls = i >= o.value - (o.fresh ?? 0) ? 'arc-fill is-fresh' : 'arc-fill';
      else if (i < o.value + (o.preview ?? 0)) cls = 'arc-preview';
      svg.append(path(arcPath(cx, cy, r, a0, a1), cls));
    }
  } else {
    svg.append(path(arcPath(cx, cy, r, START, START + SWEEP), 'arc-track'));
    if (o.preview) svg.append(path(arcPath(cx, cy, r, START, angle(o.value + o.preview)), 'arc-preview'));
    if (o.value > 0) svg.append(path(arcPath(cx, cy, r, START, angle(o.value)), 'arc-fill'));
  }

  if (o.marker !== undefined) {
    const a = angle(o.marker);
    const [x0, y0] = point(cx, cy, r - stroke, a);
    const [x1, y1] = point(cx, cy, r + stroke * 0.9, a);
    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', x0.toFixed(2));
    tick.setAttribute('y1', y0.toFixed(2));
    tick.setAttribute('x2', x1.toFixed(2));
    tick.setAttribute('y2', y1.toFixed(2));
    tick.setAttribute('class', 'arc-marker');
    svg.append(tick);
  }
  return svg;
}
