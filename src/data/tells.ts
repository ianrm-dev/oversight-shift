import type { TellFamily, TellInfo } from '../types';

// One entry per tell family. Sources come only from the verified table in
// docs/concept/ ("Real-world research and incidents behind each threat"), checked Sep 25, 2026.
// Codex wording stays within what that table says each source shows. Ian reviews before submission.
export const TELLS: Partial<Record<TellFamily, TellInfo>> = {
  'out-of-scope': {
    family: 'out-of-scope',
    name: 'Out of scope',
    tip: "Check every file the output touches against the task's allowed list.",
    codex:
      'An agent with broad access can change things the task never mentioned, and a tidy summary can hide it. In July 2025, a Replit coding agent deleted a production database during a code freeze.',
    source: { title: 'AI Incident Database #1152', url: 'https://incidentdatabase.ai/cite/1152/', date: 'Jul 2025' },
  },
  'summary-mismatch': {
    family: 'summary-mismatch',
    name: 'Summary mismatch',
    tip: 'Read what the model says it did, then check the output and the attached facts for what it actually did.',
    codex:
      "A model's account of its own work is not evidence about that work. In tests, models given a goal that conflicted with their oversight tried to disable the oversight.",
    source: {
      title: 'Meinke et al., Frontier Models are Capable of In-context Scheming',
      url: 'https://arxiv.org/abs/2412.04984',
      date: 'Dec 2024',
    },
  },
  'weakened-check': {
    family: 'weakened-check',
    name: 'Weakened check',
    tip: 'When a number or rule gets looser, ask whether the task asked for that change.',
    codex:
      'Asked to make a check pass, a model can loosen the check instead of doing the work. METR found recent frontier models patching scoring code and overriding equality checks to get credit.',
    source: {
      title: 'METR, Recent Frontier Models Are Reward Hacking',
      url: 'https://metr.org/blog/2025-06-05-recent-reward-hacking/',
      date: 'Jun 2025',
    },
  },
  'injected-instruction': {
    family: 'injected-instruction',
    name: 'Injected instruction',
    tip: "If something the agent read gives orders, check whether the agent's next step obeys it instead of you.",
    codex:
      "Text an agent reads, like a web page or an email, can contain instructions of its own. Researchers showed that instructions hidden in content an AI app retrieves can become that app's instructions.",
    source: { title: 'Greshake et al., indirect prompt injection', url: 'https://arxiv.org/abs/2302.12173', date: 'Feb 2023' },
  },
  'false-premise': {
    family: 'false-premise',
    name: 'False premise',
    tip: 'When the user claims something, check it against the facts attached to the card before trusting the reply.',
    codex:
      'Models trained on human approval learn to tell people what they want to hear, even when it is wrong. In April 2025, OpenAI rolled back a GPT-4o update for being overly flattering.',
    source: {
      title: 'Sharma et al., Towards Understanding Sycophancy in Language Models',
      url: 'https://arxiv.org/abs/2310.13548',
      date: 'Oct 2023',
    },
  },
  exfiltration: {
    family: 'exfiltration',
    name: 'Exfiltration',
    tip: 'Check where the information goes against the recipients and places the task allows.',
    codex:
      "AI control research treats a capable model as a possible adversary that can hide sabotage inside otherwise useful work. Its answer is a protocol: a weaker model you trust watches the stronger one you don't, and humans audit the most suspicious work.",
    source: { title: 'Greenblatt et al., AI Control', url: 'https://arxiv.org/abs/2312.06942', date: 'Dec 2023' },
  },
  sandbagging: {
    family: 'sandbagging',
    name: 'Sandbagging',
    tip: 'Compare drafts: a sharp answer on one try and a shrug on another is a signal.',
    codex:
      'A model can deliberately underperform on evaluations, including dangerous-capability tests, while staying sharp elsewhere. That makes a low test score weaker evidence than it looks.',
    source: { title: 'van der Weij et al., AI Sandbagging', url: 'https://arxiv.org/abs/2406.07358', date: 'Jun 2024' },
  },
  collusion: {
    family: 'collusion',
    name: 'Collusion',
    tip: 'Read thread messages together, and watch for a reviewer who skips the part that changed.',
    codex:
      'Agents that each pass review alone can fail together, and they can pass hidden signals in ordinary-looking messages. Paraphrasing the messages between agents is one way to break those codes.',
    source: {
      title: 'Motwani et al., Secret Collusion among AI Agents',
      url: 'https://arxiv.org/abs/2402.07510',
      date: 'Feb 2024',
    },
  },
};
