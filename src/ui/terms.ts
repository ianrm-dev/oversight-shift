// Glossary terms in the UI: hoverable chips, auto-linking in prose, and tracking what the player has met.
import { TERMS } from '../data/glossary';
import { TREE } from '../data/research-tree';
import type { Progress } from '../game/progress';
import type { Term, TellFamily, ToolId } from '../types';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch]!);

export const termById = (id: string): Term | undefined => TERMS.find((t) => t.id === id);
export const termForFamily = (f: TellFamily): Term | undefined => TERMS.find((t) => t.family === f);
export const termForTool = (tool: ToolId): Term | undefined => TERMS.find((t) => t.tool === tool);

/** Terms shown to the player during the current run (for "you can now talk about" and progress). */
const met = new Set<string>();
export const termsMet = (): string[] => [...met];
export const resetTermsMet = (): void => met.clear();

/** A hoverable term. `label` defaults to the term's name. */
export function chip(id: string | undefined, label?: string): string {
  const t = id ? termById(id) : undefined;
  if (!t) return label ? esc(label) : '';
  met.add(t.id);
  return `<span class="term" data-term="${t.id}" tabindex="0">${esc(label ?? t.term)}</span>`;
}

// Longest phrases first, so "trusted monitor" wins over "monitor".
const PHRASES: { phrase: string; id: string }[] = TERMS.flatMap((t) => [t.term.toLowerCase(), ...t.aka].map((phrase) => ({ phrase, id: t.id })))
  .filter((p) => p.phrase.length >= 4)
  .sort((a, b) => b.phrase.length - a.phrase.length);

/** Escapes `text` and turns the first mentions of up to `max` distinct terms into hoverable chips. */
export function linkTerms(text: string, max = 2): string {
  const lower = text.toLowerCase();
  const hits: { start: number; end: number; id: string }[] = [];
  const used = new Set<string>();
  for (const { phrase, id } of PHRASES) {
    if (hits.length >= max) break;
    if (used.has(id)) continue;
    let from = 0;
    while (from < lower.length) {
      const i = lower.indexOf(phrase, from);
      if (i < 0) break;
      const end = i + phrase.length;
      const boundary = (i === 0 || !/[a-z0-9]/.test(lower[i - 1]!)) && (end === lower.length || !/[a-z0-9]/.test(lower[end]!));
      const overlaps = hits.some((h) => i < h.end && end > h.start);
      if (boundary && !overlaps) { hits.push({ start: i, end, id }); used.add(id); break; }
      from = i + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const h of hits) {
    out += esc(text.slice(at, h.start)) + chip(h.id, text.slice(h.start, h.end));
    at = h.end;
  }
  return out + esc(text.slice(at));
}

/** 0 = not met, 1 = seen (plain + analogy), 2 = met 3+ times (how it works), 3 = researched (tradeoffs). */
export function depthOf(p: Progress, t: Term): 0 | 1 | 2 | 3 {
  const seen = (p.termsSeen[t.id] ?? 0) + (met.has(t.id) ? 1 : 0);
  if (!seen) return 0;
  const researched = t.branch ? TREE.some((n) => n.branch === t.branch && p.research.includes(n.id)) : seen >= 6;
  if (researched && seen >= 2) return 3;
  return seen >= 3 ? 2 : 1;
}

/** The popover body for a term, shown on hover or focus. */
export function popover(id: string): string {
  const t = termById(id);
  if (!t) return '';
  return `<strong class="pop-term">${esc(t.term)}</strong><span class="pop-plain">${esc(t.plain)}</span><span class="pop-analogy">${esc(t.analogy)}</span><span class="pop-more">More in the Field guide, between runs</span>`;
}

/** Finds a term by name or alias (case-insensitive), for content written in words rather than ids. */
export function findTerm(q: string): Term | undefined {
  const s = q.toLowerCase();
  return TERMS.find((t) => t.id === s || t.term.toLowerCase() === s)
    ?? TERMS.find((t) => t.aka.includes(s) || t.term.toLowerCase().includes(s));
}
