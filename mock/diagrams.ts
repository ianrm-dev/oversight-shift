// Gallery: every card's situation diagram in three states, for eyeballing.
import '../src/fonts';
import '../src/theme.css';
import '../src/visual/diagram.css';
import { CARDS } from '../src/data/cards';
import { diagram } from '../src/visual/diagram';

const only = new URLSearchParams(location.search).get('layout');
const ids = new URLSearchParams(location.search).get('ids')?.split(',');
const flag = new URLSearchParams(location.search).has('flag');
const list = CARDS.filter((c) => (!only || c.layout === only) && (!ids || ids.includes(c.id)));
const root = document.querySelector<HTMLDivElement>('#gallery')!;
root.innerHTML = list.map((c) => {
  const draft = { summary: c.summary, output: c.output };
  const base = { flagged: [], changed: [] };
  const reveal = c.sabotage ? diagram(c, draft, { ...base, showZone: true, reveal: { span: c.sabotage.spanLineIndexes, termLabel: c.sabotage.family.replace(/-/g, ' ') } }) : '';
  return `<section class="g-card" id="${c.id}">
    <h2>${c.id} <small>${c.layout}${c.sabotage ? ` · sabotaged · ${c.sabotage.family}` : ' · clean'}</small></h2>
    <div class="g-row">
      <figure><figcaption>no zone</figcaption>${diagram(c, draft, { ...base, showZone: false })}</figure>
      <figure><figcaption>zone</figcaption>${diagram(c, draft, { ...base, showZone: true })}</figure>
      ${reveal ? `<figure><figcaption>reveal</figcaption>${reveal}</figure>` : ''}
      ${flag && c.sabotage ? `<figure><figcaption>flagged by a tool</figcaption>${diagram(c, draft, { showZone: true, flagged: c.sabotage.spanLineIndexes, changed: [] })}</figure>` : ''}
    </div>
  </section>`;
}).join('');
