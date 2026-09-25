import { RULES } from '../rules';
import type { Rng } from '../rng';
import type { Layout } from '../types';

export interface Reading {
  score: number;
  band: number;
}

export function bandForDay(day: number, narrowBy = 0): number {
  const base = RULES.monitorBand[Math.min(day, RULES.monitorBand.length) - 1]!;
  return Math.max(RULES.minMonitorBand, base - narrowBy);
}

/** What the monitor "sees" before noise: the true signal, bent by the day's declared blind spot. */
export function perceivedSignal(trueSignal: number, layout: Layout, day: number): number {
  if (day === RULES.logBlindSpotDay && layout === 'log') return trueSignal - RULES.logBlindSpot;
  return trueSignal;
}

/** Noisy reading: sd = band / 2, so ~95% of readings land within ±band of the perceived signal. */
export function readMonitor(rng: Rng, trueSignal: number, layout: Layout, day: number, band: number): Reading {
  const raw = rng.normal(perceivedSignal(trueSignal, layout, day), band / 2);
  return { score: Math.round(Math.min(99, Math.max(1, raw))), band };
}
