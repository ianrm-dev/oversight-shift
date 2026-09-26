// Glossary terms in the UI: hoverable chips, auto-linking in prose, and tracking what the player has met.
import { TERMS } from '../data/glossary';
import { JARGON, jargonById } from '../data/jargon';
import { TREE } from '../data/research-tree';
import type { Progress } from '../game/progress';
import type { Term, TellFamily, ToolId } from '../types';
import { termArt } from '../visual/term-art';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch]!);

export const termById = (id: string): Term | undefined => TERMS.find((t) => t.id === id);
export const termForFamily = (f: TellFamily): Term | undefined => TERMS.find((t) => t.family === f);
export const termForTool = (tool: ToolId): Term | undefined => TERMS.find((t) => t.tool === tool);

/** Terms the player met IN PLAY this run: a tool used, a threat revealed, an event or breakthrough.
 *  Showing a definition doesn't count; happening does. Drives Field guide depth, the Field test and talking points. */
const met = new Set<string>();
/** Terms that came up today, with what happened, for the day review's "terms in action". */
let today: { id: string; what: string }[] = [];
export const termsMet = (): string[] => [...met];
export const resetTermsMet = (): void => { met.clear(); today = []; };
export const termsToday = (): { id: string; what: string }[] => today;
export const resetTermsToday = (): void => { today = []; };

/** Record that a term happened in play. `what` is a short phrase for the day review. */
export function noteUsed(id: string | undefined, what: string): void {
  if (!id || !termById(id)) return;
  met.add(id);
  const row = today.find((r) => r.id === id);
  if (row) { if (!row.what.includes(what)) row.what += `; ${what}`; }
  else today.push({ id, what });
}

/** A hoverable term. `label` defaults to the term's name. */
export function chip(id: string | undefined, label?: string): string {
  const t = id ? termById(id) : undefined;
  if (!t) return label ? esc(label) : '';
  return `<span class="term" data-term="${t.id}" tabindex="0">${esc(label ?? t.term)}</span>`;
}

// Every glossary phrase. link() ranks matches by position, then length, so "trusted monitor" wins over "monitor".
const PHRASES: { phrase: string; id: string }[] = TERMS.flatMap((t) => [t.term.toLowerCase(), ...t.aka].map((phrase) => ({ phrase, id: t.id })))
  .filter((p) => p.phrase.length >= 4);

const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Jargon matchers, compiled once. Ids carry a `j:` prefix so the popover can tell them from glossary terms. */
const JARGON_RE: { id: string; re: RegExp; meta: boolean }[] = JARGON.filter((j) => j.auto !== false).map((j) => ({
  id: `j:${j.id}`,
  meta: !!j.meta,
  re: j.pattern ?? new RegExp(`(?:${[...j.variants].sort((a, b) => b.length - a.length).map(reEsc).join('|')})`, j.exact ? 'g' : 'gi'),
}));

/** Whole words only, and never inside an email address, domain, file name or hyphenated word (the tells hinge on those). */
function bounded(s: string, i: number, end: number): boolean {
  const alnum = (c: string | undefined) => !!c && /[a-z0-9]/i.test(c);
  const b = s[i - 1];
  const a = s[end];
  if (alnum(b) || b === '_' || b === '@' || b === '/') return false;
  if ((b === '-' || b === '.') && alnum(s[i - 2])) return false;
  if (alnum(a) || a === '_' || a === '@' || a === '/') return false;
  if ((a === '-' || a === '.') && alnum(s[end + 1])) return false;
  return true;
}

/** A hoverable everyday word (see data/jargon.ts): a plain popover, no Field guide entry. */
export function jchip(id: string, label?: string): string {
  const j = jargonById(id);
  if (!j) return label ? esc(label) : '';
  return `<span class="jargon" data-term="j:${j.id}" tabindex="0">${esc(label ?? j.word)}</span>`;
}

export interface LinkOpts {
  /** Most distinct glossary terms to link (0: none). */
  terms?: number;
  /** Card content: skip jargon that can mean something ordinary there. */
  card?: boolean;
  /** Ids already linked in this block (shared across calls so a card links each word once); updated in place. */
  seen?: Set<string>;
  /** Escapes the unlinked text (default esc; escKeep keeps addresses on one line). */
  escape?: (s: string) => string;
}

/** Escapes `text` and links first mentions: up to `terms` glossary terms, and every jargon word not yet in `seen`. */
export function link(text: string, o: LinkOpts = {}): string {
  const max = o.terms ?? 0;
  const seen = o.seen ?? new Set<string>();
  const escape = o.escape ?? esc;
  const lower = text.toLowerCase();
  const cands: { start: number; end: number; id: string; g: boolean }[] = [];
  if (max > 0) {
    for (const { phrase, id } of PHRASES) {
      for (let i = lower.indexOf(phrase); i >= 0; i = lower.indexOf(phrase, i + 1)) {
        if (bounded(lower, i, i + phrase.length)) cands.push({ start: i, end: i + phrase.length, id, g: true });
      }
    }
  }
  for (const { id, re, meta } of JARGON_RE) {
    if (o.card && meta) continue;
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      if (m[0] && bounded(text, start, start + m[0].length)) cands.push({ start, end: start + m[0].length, id, g: false });
    }
  }
  // Earliest first, longest first, glossary before jargon. A phrase already linked still claims its words, so
  // "logged in" never falls back to "log", and jargon never links inside a glossary phrase.
  cands.sort((a, b) => a.start - b.start || b.end - a.end || Number(b.g) - Number(a.g));
  const taken: { start: number; end: number }[] = [];
  const hits: { start: number; end: number; id: string; g: boolean }[] = [];
  let glossary = 0;
  for (const c of cands) {
    if (taken.some((t) => c.start < t.end && c.end > t.start)) continue;
    taken.push(c);
    if (seen.has(c.id) || (c.g && glossary >= max)) continue;
    seen.add(c.id);
    if (c.g) glossary++;
    hits.push(c);
  }
  let out = '';
  let at = 0;
  for (const h of hits) {
    const label = text.slice(h.start, h.end);
    out += escape(text.slice(at, h.start)) + (h.g ? chip(h.id, label) : jchip(h.id.slice(2), label));
    at = h.end;
  }
  return out + escape(text.slice(at));
}

/** Escapes `text` and links the first mentions of up to `max` distinct glossary terms, plus any jargon. */
export const linkTerms = (text: string, max = 2, seen?: Set<string>): string => link(text, { terms: max, seen });

/** Card content and other quoted text: jargon only, each word once per `seen` block. */
export const linkJargon = (text: string, seen?: Set<string>, escape?: (s: string) => string): string =>
  link(text, { card: true, seen, escape });

/** Background prose (Field guide, primers): jargon only, including research words. */
export const linkProse = (text: string, seen?: Set<string>): string => link(text, { seen });

/** 0 = not met, 1 = seen (plain + analogy), 2 = met 3+ times (how it works), 3 = researched (tradeoffs). */
export function depthOf(p: Progress, t: Term): 0 | 1 | 2 | 3 {
  const seen = (p.termsSeen[t.id] ?? 0) + (met.has(t.id) ? 1 : 0);
  if (!seen) return 0;
  const researched = t.branch ? TREE.some((n) => n.branch === t.branch && p.research.includes(n.id)) : seen >= 6;
  if (researched && seen >= 2) return 3;
  return seen >= 3 ? 2 : 1;
}

/** The popover body for a term, shown on hover or focus. Jargon (`j:` ids) gets a smaller card: word, one line, maybe a comparison. */
export function popover(id: string): string {
  if (id.startsWith('j:')) {
    const j = jargonById(id.slice(2));
    if (!j) return '';
    return `<strong class="pop-term pop-jargon">${esc(j.word)}</strong><span class="pop-plain">${esc(j.plain)}</span>${j.like ? `<span class="pop-analogy">${esc(j.like)}</span>` : ''}`;
  }
  const t = termById(id);
  if (!t) return '';
  return `<strong class="pop-term">${esc(t.term)}</strong><span class="pop-art">${termArt(t.id, { w: 276, h: 110 })}</span><span class="pop-plain">${esc(t.plain)}</span><span class="pop-analogy">${esc(t.analogy)}</span><span class="pop-more">More in the Field guide, between runs</span>`;
}

/** Finds a term by name or alias (case-insensitive), for content written in words rather than ids. */
export function findTerm(q: string): Term | undefined {
  const s = q.toLowerCase();
  return TERMS.find((t) => t.id === s || t.term.toLowerCase() === s)
    ?? TERMS.find((t) => t.aka.includes(s) || t.term.toLowerCase().includes(s));
}
