import type { Card } from '../types';
import { CARDS_EARLY } from './cards-early';

/** Every card template. Layout decides which days a card can appear on. */
export const CARDS: Card[] = [...CARDS_EARLY];
