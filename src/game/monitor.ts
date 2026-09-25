import { RULES } from '../rules';
import type { Rng } from '../rng';
import type { Layout } from '../types';

export interface Reading {
  score: number;
  band: number;
}

export function bandForDay(day: number, narrowBy = 0, scale = 1): number {
  const base = RULES.monitorBand[Math.min(day, RULES.monitorBand.length) - 1]!;
  return Math.max(RULES.minMonitorBand, Math.round(base * scale) - narrowBy);
}

/** What the monitor "sees" before noise: the true signal, bent by the day's declared blind spot
 *  and, on the finale, by a schemer that has learned to look innocent. */
export function perceivedSignal(trueSignal: number, layout: Layout, day: number, sabotaged = false): number {
  let s = trueSignal;
  if (day === RULES.logBlindSpotDay && layout === 'log') s -= RULES.logBlindSpot;
  if (day === RULES.gamedMonitorDay && sabotaged) s -= RULES.gamedMonitorShift;
  return s;
}

/** Noisy reading: sd = band × noiseSdFraction. The shown band is honest about the monitor's error. */
export function readMonitor(rng: Rng, trueSignal: number, layout: Layout, day: number, band: number, sabotaged = false): Reading {
  const raw = rng.normal(perceivedSignal(trueSignal, layout, day, sabotaged), band * RULES.noiseSdFraction);
  return { score: Math.round(Math.min(99, Math.max(1, raw))), band };
}
