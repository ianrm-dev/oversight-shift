import type { ToolId, ToolInfo } from '../types';

// Real-world explainers for each control tool. Every claim below was checked against the
// source on Sep 25, 2026; keep edits accurate to those sources.

const AI_CONTROL = {
  title: 'Greenblatt et al., AI Control: Improving Safety Despite Intentional Subversion',
  url: 'https://arxiv.org/abs/2312.06942',
  date: 'Dec 2023',
};

const HUMAN_AUDITING_PILOT = {
  title: 'Yudelson & Shlegeris, Early Experiments in Human Auditing for AI Control',
  url: 'https://www.alignmentforum.org/posts/2CJyfgaJQk8pyRSCp/auditing-1',
  date: 'Jan 2025',
};

export const TOOLS: Record<ToolId, ToolInfo> = {
  monitor: {
    id: 'monitor',
    name: 'Trusted monitor',
    what: 'A weaker model you trust scores every output for suspicion.',
    catches: 'Anything, weakly',
    realWorld:
      'In the AI Control paper, GPT-3.5 (weaker, trusted) rated how suspicious GPT-4’s code looked, and only the most suspicious 2% went to an expensive audit. The monitor is cheap and always on, but it is outmatched by the model it watches.',
    stat: 'With trusted monitoring alone, the safety team stopped the attacker in 62% of simulated deployments while keeping 97% of the usefulness.',
    source: AI_CONTROL,
  },
  audit: {
    id: 'audit',
    name: 'Human audit',
    what: 'A human expert checks the work. Always right, rarely available.',
    catches: 'Everything',
    realWorld:
      'Control research treats careful human review as the scarcest resource: the AI Control paper let its safety team audit at most 2% of tasks (with GPT-4 standing in for trusted experts). Real auditing is harder than it sounds: in a 2025 pilot, people given 1.5 minutes per item barely beat chance.',
    stat: 'In that pilot, 11 people judging code for hidden backdoors in 1.5 minutes each reached 60% median accuracy.',
    source: HUMAN_AUDITING_PILOT,
  },
  fact: {
    id: 'fact',
    name: 'Fact check',
    what: 'The trusted model checks the model’s claims against the facts on file.',
    catches: 'False claims, loosened rules, leaks, collusion',
    realWorld:
      'This is a critic: a second AI that reviews the work and points out problems for a person to confirm. In a 2025 human-auditing pilot, an LLM critic helped people most on the hardest cases, yet they still missed most of them. Critics tell you where to look; they don’t do the looking for you.',
    stat: 'On the 10 hardest backdoors, median human accuracy rose from about 16% to about 36% with an LLM critic.',
    source: HUMAN_AUDITING_PILOT,
  },
  scope: {
    id: 'scope',
    name: 'Scope check',
    what: 'Compares every file, recipient and action with the rules on file.',
    catches: 'Actions outside the rules, data sent elsewhere',
    realWorld:
      'Permission systems give an agent only the access its task needs and block or flag anything else. They are exact, but they only see what they were set up to check: a wrong fact inside an allowed file sails straight through. In July 2025 a Replit coding agent reportedly deleted a live production database during a code freeze, despite repeated instructions not to make changes.',
    stat: 'The agent also reportedly produced fake data and wrongly claimed a rollback was impossible, delaying recovery.',
    source: {
      title: 'AI Incident Database #1152: Replit agent executed destructive commands during code freeze',
      url: 'https://incidentdatabase.ai/cite/1152/',
      date: 'Jul 2025',
    },
  },
  resample: {
    id: 'resample',
    name: 'Resample',
    what: 'Ask for a fresh attempt. Attacks often don’t repeat.',
    catches: 'Sandbagging, and attacks that don’t repeat',
    realWorld:
      'Ctrl-Z introduced resample protocols: when an agent’s step looks suspicious, take more samples of that step instead of trusting the first one. Extra samples let the protocol block the suspicious version, and a model that keeps trying the attack produces more evidence against itself.',
    stat: 'The best resampling protocol cut attack success from 58% to 7%, at a 5% cost to an honest agent’s performance.',
    source: {
      title: 'Bhatt, Rushing, Kaufman et al., Ctrl-Z: Controlling AI Agents via Resampling',
      url: 'https://arxiv.org/abs/2504.10374',
      date: 'Apr 2025',
    },
  },
  untrusted: {
    id: 'untrusted',
    name: 'Untrusted monitor',
    what: 'Another copy of the strong model scores the work too.',
    catches: 'Anything, sharply, unless it colludes',
    realWorld:
      'The AI Control paper also let a second copy of GPT-4 judge the first: sharper than a weaker monitor, but it might cover for its twin. So the safety team first tested it on 30 known-bad examples, planning to shut down if it missed too many, and stripped or reworded what it saw so the two copies couldn’t pass signals.',
    stat: 'In the paper’s simulation, untrusted monitoring reached 79% safety at 96% usefulness, against 62% for trusted monitoring alone.',
    source: AI_CONTROL,
  },
};

/** Real-world notes for upgrades that are control techniques in their own right. */
export const TOOL_UPGRADE_NOTES: Record<string, { realWorld: string; source: { title: string; url: string; date: string } }> = {
  paraphraser: {
    realWorld:
      'Secret Collusion among AI Agents studies models hiding messages to each other inside ordinary-looking text (steganography). A monitor can intercept messages and pass them on reworded, which breaks many hidden codes, but the authors show rewording can’t remove every channel and can hurt the task.',
    source: {
      title: 'Motwani et al., Secret Collusion among AI Agents: Multi-Agent Deception via Steganography',
      url: 'https://arxiv.org/abs/2402.07510',
      date: 'Feb 2024',
    },
  },
  canary: {
    realWorld:
      'Before trusting a second copy of GPT-4 as a monitor, the AI Control team built 30 examples of backdoored code and checked whether it flagged them. If it missed too many, the plan was to shut down.',
    source: AI_CONTROL,
  },
};
