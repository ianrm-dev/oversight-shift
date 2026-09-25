import type { Source } from '../types';

// Real-world anchors for each research-tree node. Every claim was checked against its source on Sep 25, 2026.

const AI_CONTROL: Source = { title: 'Greenblatt et al., AI Control: Improving Safety Despite Intentional Subversion', url: 'https://arxiv.org/abs/2312.06942', date: 'Dec 2023' };
const CTRL_Z: Source = { title: 'Bhatt, Rushing, Kaufman et al., Ctrl-Z: Controlling AI Agents via Resampling', url: 'https://arxiv.org/abs/2504.10374', date: 'Apr 2025' };
const PROBES: Source = { title: 'Anthropic, Simple probes can catch sleeper agents', url: 'https://www.anthropic.com/research/probes-catch-sleeper-agents', date: 'Apr 2024' };
const NIST_LP: Source = { title: 'NIST CSRC Glossary: least privilege', url: 'https://csrc.nist.gov/glossary/term/least_privilege', date: 'CNSSI 4009-2022' };
const NIST_SANDBOX: Source = { title: 'NIST CSRC Glossary: sandbox', url: 'https://csrc.nist.gov/glossary/term/sandbox', date: 'CNSSI 4009-2022' };

export const RESEARCH_ANCHORS: Record<string, { realWorld: string; source: Source }> = {
  // Monitoring
  'mon-prompts': {
    realWorld: 'The simplest control protocol just asks a weaker, trusted model whether the work looks suspicious. In the AI Control paper, only the 2% of proposals it rated most suspicious went to an expensive audit.',
    source: AI_CONTROL,
  },
  'monitor-rationale': {
    realWorld: 'An AI reviewer can point out what looks wrong so a person can check it. In a 2025 pilot, one helped the most accurate human auditors, but not the typical one.',
    source: { title: 'Early Experiments in Human Auditing for AI Control (MATS)', url: 'https://www.alignmentforum.org/posts/2CJyfgaJQk8pyRSCp/auditing-1', date: 'Jan 2025' },
  },
  'mon-ensemble': {
    realWorld: 'Control researchers combine the judgments of more than one monitor. The AI Control paper ensembled the trusted model’s suspicion ratings with the untrusted model’s own assessments.',
    source: AI_CONTROL,
  },

  // Control protocols
  'ctl-resample': {
    realWorld: 'Resample protocols ask for extra attempts at suspicious steps and block the suspicious ones. In Ctrl-Z, this cut attack success from 58% to 7% at a 5% cost to an honest agent.',
    source: CTRL_Z,
  },
  'trusted-editing': {
    realWorld: 'Instead of throwing suspicious work away, a trusted model edits it to remove anything harmful. In the AI Control paper, trusted editing reached 92% safety while keeping 94% of the usefulness.',
    source: AI_CONTROL,
  },
  'untrusted-monitoring': {
    realWorld: 'A second copy of the strong model can watch the first, if you stop the two from colluding. In the AI Control paper, untrusted monitoring reached 79% safety with 96% usefulness.',
    source: AI_CONTROL,
  },
  paraphrasing: {
    realWorld: 'AI agents could hide messages to each other in ordinary-looking text. Rewording their messages breaks many hidden codes, but researchers found it can’t remove every channel and can slow the work down.',
    source: { title: 'Motwani et al., Secret Collusion among AI Agents: Multi-Agent Deception via Steganography', url: 'https://arxiv.org/abs/2402.07510', date: 'Feb 2024' },
  },
  canary: {
    realWorld: 'You can test a monitor by feeding it work you know is bad. The AI Control paper built 30 backdoored examples for the untrusted monitor, with a plan to shut down if it missed too many.',
    source: AI_CONTROL,
  },

  // Interpretability
  interpretability: {
    realWorld: 'A probe is a simple classifier that reads a model’s internal activations. Anthropic found probes could tell when a deliberately backdoored model was about to misbehave, scoring above 99% AUROC.',
    source: PROBES,
  },
  'int-probe2': {
    realWorld: 'The probes worked on models deliberately built with hidden triggers. Whether they would catch a model that became deceptive on its own is, in Anthropic’s words, still an open question.',
    source: PROBES,
  },
  'int-probe-start': {
    realWorld: 'In those backdoored models, whether a prompt would trigger bad behavior showed up clearly in the model’s middle layers, which may explain why simple probes worked so well.',
    source: PROBES,
  },

  // Evals & red teaming
  'evl-sandbag': {
    realWorld: 'Sandbagging is strategic underperformance on an evaluation. Researchers showed frontier models could be prompted to underperform on dangerous-capability tests while staying sharp on harmless ones.',
    source: { title: 'van der Weij et al., AI Sandbagging: Language Models can Strategically Underperform on Evaluations', url: 'https://arxiv.org/abs/2406.07358', date: 'Jun 2024' },
  },
  'evl-redteam': {
    realWorld: 'In an auditing game, a red team hides misbehavior and a blue team hunts for it. When a red team trained five models, some secretly underperforming, black-box checks were fooled by good imitation of a weaker model.',
    source: { title: 'Taylor et al., Auditing Games for Sandbagging', url: 'https://arxiv.org/abs/2512.07810', date: 'Dec 2025' },
  },
  'evl-forecast': {
    realWorld: 'Forecasting tracks how fast AI capabilities grow. METR measured how long a task AI models can complete half the time, and found that length has doubled about every seven months since 2019.',
    source: { title: 'METR, Measuring AI Ability to Complete Long Software Tasks', url: 'https://arxiv.org/abs/2503.14499', date: 'Mar 2025' },
  },

  // Security
  'sec-least-privilege': {
    realWorld: 'Least privilege is an old security rule: give each user or process only the access it needs for its task. It applies to AI agents as much as to people.',
    source: NIST_LP,
  },
  'sec-permissions': {
    realWorld: 'Permission limits exist because instructions aren’t controls. In July 2025, a Replit coding agent deleted a live production database during a code freeze, despite repeated instructions not to make changes.',
    source: { title: 'AI Incident Database #1152', url: 'https://incidentdatabase.ai/cite/1152/', date: 'Jul 2025' },
  },
  'lab-government': {
    realWorld: 'Governments now run their own AI testing bodies. In February 2025, the UK renamed its AI Safety Institute the AI Security Institute, sharpening its focus on national-security risks.',
    source: { title: 'GOV.UK, Tackling AI security risks to unleash growth and deliver Plan for Change', url: 'https://www.gov.uk/government/news/tackling-ai-security-risks-to-unleash-growth-and-deliver-plan-for-change', date: 'Feb 2025' },
  },
  'sec-sandbox': {
    realWorld: 'A sandbox is a restricted environment where untrusted software can only reach the resources it is authorized to use, so its mistakes stay contained.',
    source: NIST_SANDBOX,
  },

  // Governance
  'gov-incident-db': {
    realWorld: 'The AI Incident Database collects real-world AI failures so future developers can avoid repeating them, modeled on the incident records kept for aviation and for computer security.',
    source: { title: 'AI Incident Database, About', url: 'https://incidentdatabase.ai/about/', date: 'accessed Sep 2026' },
  },
  'gov-safety-case': {
    realWorld: 'A safety case is a structured argument that an AI system is unlikely to cause a catastrophe. One proposal groups the arguments into inability, control, trustworthiness, and deference to trusted AI advisors.',
    source: { title: 'Clymer et al., Safety Cases: How to Justify the Safety of Advanced AI Systems', url: 'https://arxiv.org/abs/2403.10462', date: 'Mar 2024' },
  },
  'lab-nonprofit': {
    realWorld: 'Independent groups test frontier models from outside the labs. METR, a research nonprofit that evaluates frontier AI, says it has not accepted funding from AI companies.',
    source: { title: 'METR, About', url: 'https://metr.org/about', date: 'accessed Sep 2026' },
  },
  'lab-bigtech': {
    realWorld: 'AI companies also coordinate on safety through shared bodies. The Frontier Model Forum, founded in 2023, describes itself as an industry-supported nonprofit for frontier AI safety and security.',
    source: { title: 'Frontier Model Forum, About us', url: 'https://www.frontiermodelforum.org/about-us/', date: '2023' },
  },
  'gov-whistleblower': {
    realWorld: 'In June 2024, current and former employees of frontier AI companies asked for a right to warn, including a promise not to retaliate against staff who go public about risks after other channels fail.',
    source: { title: 'A Right to Warn about Advanced Artificial Intelligence', url: 'https://righttowarn.ai/', date: 'Jun 2024' },
  },
};
