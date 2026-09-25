import type { Card } from '../types';
import { CARDS_AGENT } from './cards-agent';
import { CARDS_EARLY } from './cards-early';
import { CARDS_FINALE } from './cards-finale';
import { CARDS_THREADS } from './cards-threads';

/** Every card template. Layout and minDay decide which days a card can appear on. */
export const CARDS: Card[] = [...CARDS_EARLY, ...CARDS_AGENT, ...CARDS_THREADS, ...CARDS_FINALE];
