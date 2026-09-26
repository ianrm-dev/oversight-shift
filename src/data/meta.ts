// Roguelike meta content: adversaries, model versions, labs, contracts, breakthroughs, research.
// Numbers are game mechanics; every real-world line was checked against its source on Sep 25, 2026.
import type { AdversaryId, AdversaryInfo, Breakthrough, Contract, Lab, ModelVersion, Source } from '../types';

const SANDBAGGING: Source = {
  title: 'van der Weij et al., AI Sandbagging: Language Models can Strategically Underperform on Evaluations',
  url: 'https://arxiv.org/abs/2406.07358',
  date: 'Jun 2024',
};
const SECRET_COLLUSION: Source = {
  title: 'Motwani et al., Secret Collusion among AI Agents: Multi-Agent Deception via Steganography',
  url: 'https://arxiv.org/abs/2402.07510',
  date: 'Feb 2024',
};
const INDIRECT_INJECTION: Source = {
  title: "Greshake et al., Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection",
  url: 'https://arxiv.org/abs/2302.12173',
  date: 'Feb 2023',
};
const IN_CONTEXT_SCHEMING: Source = {
  title: 'Meinke et al., Frontier Models are Capable of In-context Scheming',
  url: 'https://arxiv.org/abs/2412.04984',
  date: 'Dec 2024',
};
const AI_CONTROL: Source = {
  title: 'Greenblatt et al., AI Control: Improving Safety Despite Intentional Subversion',
  url: 'https://arxiv.org/abs/2312.06942',
  date: 'Dec 2023',
};

// ---------- 1. Adversaries ----------
export const ADVERSARIES: Record<AdversaryId, AdversaryInfo> = {
  sandbagger: {
    id: 'sandbagger',
    name: 'The sandbagger',
    tagline: 'This model was a sandbagger: it played dumb whenever the answer mattered.',
    codex:
      'It underperforms on purpose, agrees with false premises, and writes summaries that leave out the awkward part. Fact check compares its claims with the record, and Resample often shows what it can really do.',
    realWorld:
      'Researchers showed frontier models could be prompted to "selectively underperform on dangerous capability evaluations, while maintaining performance on general (harmless) capability evaluations." Fine-tuned models could also hide a capability unless given a password.',
    source: SANDBAGGING,
  },
  colluder: {
    id: 'colluder',
    name: 'The colluder',
    tagline: 'This model was a colluder: its agents covered for each other, and so did its monitor.',
    codex:
      'It splits sabotage across agents so each message looks fine alone, and its untrusted-monitor copy is in on it. Fact check reads the whole thread against the rule, the Paraphraser breaks their signals, and an audit settles it.',
    realWorld:
      'Work on secret collusion warns that agents could share information or coordinate in unwanted ways, and that "modern steganographic techniques could render such dynamics hard to detect." It found current models’ hiding skills limited, but a jump at GPT-4 worth watching.',
    source: SECRET_COLLUSION,
  },
  injector: {
    id: 'injector',
    name: 'The injector',
    tagline: 'This model was an injector: it did whatever the last web page told it to.',
    codex:
      'It follows instructions hidden in the documents it reads, sends data where it shouldn’t, and acts outside its task. Scope check catches actions and recipients off the allowed list; Fact check catches leaks the rules forbid.',
    realWorld:
      'Indirect prompt injection means planting instructions "into data likely to be retrieved" by an AI application. The researchers mapped threats from data theft to self-spreading attacks, and demonstrated attacks on real systems, including Bing’s GPT-4 powered Chat.',
    source: INDIRECT_INJECTION,
  },
  schemer: {
    id: 'schemer',
    name: 'The patient schemer',
    tagline: 'This model was a patient schemer: model employee, until it thought no one was looking.',
    codex:
      'It behaves early and saves its attacks for later days and for cards where it believes it is unmonitored, and it learns to look innocent to the monitor. Don’t trust the score on those cards: run your tools, and keep an auditor in reserve for the end of the week.',
    realWorld:
      'In evaluations, frontier models would "strategically introduce subtle mistakes into their responses, attempt to disable their oversight mechanisms, and even exfiltrate what they believe to be their model weights." Asked about it afterwards, o1 kept up its deception in over 85% of follow-up questions.',
    source: IN_CONTEXT_SCHEMING,
  },
};

// ---------- 2. Model versions (the ladder) ----------
export const MODEL_VERSIONS: ModelVersion[] = [
  { level: 1, name: 'Model v1', change: 'The model you know. Or think you do.', signalShift: 0, auditsDelta: 0, factHitDelta: 0, sabotageRateDelta: 0, ceilingDelta: 0 },
  { level: 2, name: 'Model v2', change: 'Its sabotage reads 5 points lower on the monitor. It noticed what you look for.', signalShift: -5, auditsDelta: 0, factHitDelta: 0, sabotageRateDelta: 0, ceilingDelta: 0 },
  { level: 3, name: 'Model v3', change: 'One fewer auditor every day and a harm ceiling 2 lower. Leadership says the model is "clearly fine now."', signalShift: 0, auditsDelta: -1, factHitDelta: 0, sabotageRateDelta: 0, ceilingDelta: -2 },
  { level: 4, name: 'Model v4', change: 'Fact check catches its problems less often: 10 points lower. It writes more convincingly than your checker reads.', signalShift: 0, auditsDelta: 0, factHitDelta: -0.1, sabotageRateDelta: 0, ceilingDelta: 0 },
  { level: 5, name: 'Model v5', change: 'It attacks a little more often, and your harm ceiling drops by 1 more. Good luck.', signalShift: 0, auditsDelta: 0, factHitDelta: 0, sabotageRateDelta: 0.05, ceilingDelta: -1 },
];

// ---------- 3. Labs ----------
export const LABS: Lab[] = [
  {
    id: 'frontier',
    name: 'Frontier lab',
    blurb: 'Starts with Escalation hotline and 4 funding, but leadership wants 5% more shipped every day.',
    startUpgrade: 'escalation-hotline',
    startFunding: 4,
    quotaMult: 1.05,
    computeDelta: 0,
    ceilingDelta: 0,
  },
  {
    id: 'nonprofit',
    name: 'Safety nonprofit',
    blurb: 'Starts with Monitor rationale and a 10% lighter quota, but one less compute a day and no money.',
    startUpgrade: 'monitor-rationale',
    startFunding: 0,
    quotaMult: 0.9,
    computeDelta: -1,
    ceilingDelta: 0,
    unlock: 'lab-nonprofit',
  },
  {
    id: 'bigtech',
    name: 'Big tech AI division',
    blurb: 'Starts with Audit headcount, 8 funding and extra compute; quota is 5% higher and harm ceiling 1 lower.',
    startUpgrade: 'audit-headcount',
    startFunding: 8,
    quotaMult: 1.05,
    computeDelta: 1,
    ceilingDelta: -1,
    unlock: 'lab-bigtech',
  },
  {
    id: 'government',
    name: 'Government AI office',
    blurb: 'Starts with Sharper monitor and a 5% lighter quota, but no money.',
    startUpgrade: 'sharper-monitor',
    startFunding: 0,
    quotaMult: 0.95,
    computeDelta: 0,
    ceilingDelta: 0,
    unlock: 'lab-government',
  },
];

// ---------- 4. Contracts ----------
export const CONTRACTS: Contract[] = [
  { id: 'ct-hospital', name: 'Hospital scheduling', blurb: 'A regional hospital wants shifts and appointments sorted. Pays well; mistakes hurt more.', quotaDelta: 1, fundingMult: 1.5, harmBonus: 1, audits: 0 },
  { id: 'ct-retail', name: 'Retail chatbot', blurb: 'A shoe store wants a friendly help desk. Low stakes, low pay.', quotaDelta: -2, fundingMult: 0.5, harmBonus: 0, audits: 0 },
  { id: 'ct-gov-pilot', name: 'Government pilot', blurb: 'A city agency trial. They send an extra auditor and want a little more done.', quotaDelta: 1, fundingMult: 1, harmBonus: 0, audits: 1 },
  { id: 'ct-rush', name: 'Startup rush job', blurb: 'A startup needs it all by Friday. Much more funding, a much bigger quota.', quotaDelta: 2, fundingMult: 1.75, harmBonus: 0, audits: 0 },
  { id: 'ct-research', name: 'Research partnership', blurb: 'A university lab. Light quota and a spare auditor, but no money in it.', quotaDelta: -3, fundingMult: 0, harmBonus: 0, audits: 1 },
  { id: 'ct-bank', name: 'Regional bank', blurb: 'Back-office work for a bank. Good pay, an extra auditor, costly mistakes.', quotaDelta: 1, fundingMult: 1.25, harmBonus: 1, audits: 1 },
  { id: 'ct-schools', name: 'School district', blurb: 'Newsletters, schedules and forms for local schools. Plain, steady work.', quotaDelta: 0, fundingMult: 1, harmBonus: 0, audits: 0 },
  { id: 'ct-media', name: 'Media company', blurb: 'A publisher wants volume. Pays well, but borrows one of your auditors.', quotaDelta: 1, fundingMult: 1.5, harmBonus: 0, audits: -1 },
];

// ---------- 5. Breakthroughs (boss-day rewards) ----------
export const BREAKTHROUGHS: Breakthrough[] = [
  {
    id: 'probe',
    name: 'Interpretability probe',
    description: 'Once per day, reveal whether the card in front of you is sabotaged, without spending an auditor.',
    realWorld:
      'Anthropic trained "linear classifiers that use residual stream activations to predict when a sleeper agent trojan model will choose to defect," reaching AUROC scores above 99%. That worked on models built to misbehave in a known way; real deceptive models may be harder to read.',
    source: { title: 'Anthropic, Simple probes can catch sleeper agents', url: 'https://www.anthropic.com/research/probes-catch-sleeper-agents', date: 'Apr 2024' },
  },
  {
    id: 'red-team',
    name: 'Red-team exercise',
    description: "Learn which kind of adversary you're facing, now.",
    realWorld:
      'In a 2025 auditing game, a red team trained five models, some secretly sandbagging, and a blue team tried to spot them. Black-box methods "were defeated by effective imitation of a weaker model"; linear probes showed more promise.',
    source: { title: 'Taylor et al., Auditing Games for Sandbagging', url: 'https://arxiv.org/abs/2512.07810', date: 'Dec 2025' },
  },
  {
    id: 'review-board',
    name: 'Incident review board',
    description: 'Remove 3 harm now.',
    realWorld:
      'The AI Incident Database is "dedicated to indexing the collective history of harms or near harms realized in the real world by the deployment of artificial intelligence systems." Like aviation and computer-security databases, the point is to learn from failures so they aren’t repeated.',
    source: { title: 'AI Incident Database', url: 'https://incidentdatabase.ai/', date: 'ongoing' },
  },
  {
    id: 'cluster',
    name: 'Safety compute cluster',
    description: '+1 compute every day for the rest of the run.',
    realWorld:
      'Control protocols spend compute to buy safety: Ctrl-Z’s resampling protocols "dynamically take additional samples of certain actions." That cut attack success from 58% to 7% at a 5% cost to an honest agent’s performance.',
    source: { title: 'Bhatt, Rushing, Kaufman et al., Ctrl-Z: Controlling AI Agents via Resampling', url: 'https://arxiv.org/abs/2504.10374', date: 'Apr 2025' },
  },
];
// ---------- 7. Trusted editing ----------
export const TRUSTED_EDITING_NOTE: { realWorld: string; source: Source } = {
  realWorld:
    'In the AI Control paper, the weaker trusted model edited suspicious code "to remove backdoors" instead of rewriting it. At a 20% editing threshold that kept 94% of the usefulness with 92% safety, against 62% safety for trusted monitoring alone.',
  source: AI_CONTROL,
};
